const db = require('../config/db');
//const { logAction } = require('../utils/logger'); // Ensure you created this in Phase 1 Part A

exports.createReport = async (req, res) => {
    // 1. Get a dedicated connection from the pool for the transaction
    const connection = await db.getConnection(); 

    try {
        const { title, description, tasks } = req.body; 
        const userId = req.user.id; // From authMiddleware

        // Calculate total hours from the tasks array
        const totalHours = tasks.reduce((sum, task) => sum + parseFloat(task.hours), 0);

        // --- START TRANSACTION ---
        await connection.beginTransaction();

        // 2. Insert into 'reports' table
        const [reportResult] = await connection.execute(
            'INSERT INTO reports (user_id, title, description, total_hours) VALUES (?, ?, ?, ?)',
            [userId, title, description, totalHours]
        );
        const reportId = reportResult.insertId;

        // 3. Insert all tasks into 'report_tasks' table
        // We use map to create an array of insert promises
        const taskPromises = tasks.map(task => {
            return connection.execute(
                'INSERT INTO report_tasks (report_id, task_name, hours) VALUES (?, ?, ?)',
                [reportId, task.task_name, task.hours]
            );
        });
        
        await Promise.all(taskPromises);

        // 4. Log the activity in audit_logs
        await connection.execute(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
            [userId, 'REPORT_CREATED', 'reports', reportId]
        );

        // --- COMMIT TRANSACTION ---
        // If we reach here, it means everything was successful
        await connection.commit(); 

        res.status(201).json({ 
            success: true, 
            message: "Report and tasks submitted successfully", 
            reportId 
        });

    } catch (error) {
        // --- ROLLBACK TRANSACTION ---
        // If ANY error happens above, undo everything
        await connection.rollback(); 
        console.error("Transaction Error:", error);
        res.status(500).json({ success: false, message: "Failed to submit report", error: error.message });
    } finally {
        // Always release the connection back to the pool
        connection.release();
    }
};



// GET: Fetch pending reports for the manager's team
exports.getPendingReports = async (req, res) => {
    try {
        const managerId = req.user.id;

        // Join reports with users to filter by manager_id
        const [reports] = await db.execute(`
            SELECT r.*, u.name as employee_name, u.department 
            FROM reports r
            JOIN users u ON r.user_id = u.id
            WHERE u.manager_id = ? AND r.status = 'pending' AND r.is_deleted = FALSE
            ORDER BY r.submitted_at DESC
        `, [managerId]);

        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// PUT: Approve or Reject a report
exports.reviewReport = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params; // Report ID
        const { status, comment } = req.body; // 'approved' or 'rejected'
        const managerId = req.user.id;

        await connection.beginTransaction();

        // 1. Update Report Status
        await connection.execute(
            'UPDATE reports SET status = ? WHERE id = ?',
            [status, id]
        );

        // 2. If Rejected, add feedback
        if (status === 'rejected' && comment) {
            await connection.execute(
                'INSERT INTO report_feedback (report_id, manager_id, comment) VALUES (?, ?, ?)',
                [id, managerId, comment]
            );
        }

        // 3. Log the action in audit_logs
        await connection.execute(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
            [managerId, `REPORT_${status.toUpperCase()}`, 'reports', id]
        );

        await connection.commit();
        res.status(200).json({ success: true, message: `Report ${status} successfully` });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
};


exports.getMyReports = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Fetch reports + join feedback so employee sees WHY they were rejected
        const [reports] = await db.execute(`
            SELECT r.*, f.comment as manager_comment, f.created_at as feedback_date
            FROM reports r
            LEFT JOIN report_feedback f ON r.id = f.report_id
            WHERE r.user_id = ? AND r.is_deleted = FALSE
            ORDER BY r.submitted_at DESC
        `, [userId]);

        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        let stats = {};

        if (role === 'employee') {
            // Stats for the logged-in employee
            const [rows] = await db.execute(`
                SELECT 
                    COUNT(*) as totalReports,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
                    IFNULL(SUM(total_hours), 0) as totalHours
                FROM reports 
                WHERE user_id = ? AND is_deleted = FALSE
            `, [userId]);
            stats = rows[0];

        } else if (role === 'manager') {
            // Stats for the manager (viewing their team)
            const [rows] = await db.execute(`
                SELECT 
                    COUNT(*) as teamPendingReports,
                    (SELECT COUNT(*) FROM users WHERE manager_id = ?) as teamSize,
                    IFNULL(SUM(total_hours), 0) as teamTotalHours
                FROM reports r
                JOIN users u ON r.user_id = u.id
                WHERE u.manager_id = ? AND r.status = 'pending'
            `, [userId, userId]);
            stats = rows[0];

        } else if (role === 'admin') {
            // Global stats for the Admin
            const [rows] = await db.execute(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as totalUsers,
                    (SELECT COUNT(*) FROM reports WHERE status = 'pending') as globalPending,
                    (SELECT COUNT(*) FROM audit_logs) as totalLogs
            `);
            stats = rows[0];
        }

        res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error("Stats Error:", error);
        res.status(500).json({ success: false, message: "Could not fetch stats" });
    }
};

exports.getChartData = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // This query gets the tasks from the VERY LAST report submitted by the user
        const [rows] = await db.execute(`
            SELECT 
                rt.task_name as name, 
                rt.hours as hours
            FROM report_tasks rt
            JOIN reports r ON rt.report_id = r.id
            WHERE r.user_id = ? 
            AND DATE(r.submitted_at) = (SELECT MAX(DATE(submitted_at)) FROM reports WHERE user_id = ?)
            ORDER BY rt.id ASC
        `, [userId, userId]);

        res.json({ success: true, chartData: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};