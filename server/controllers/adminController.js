const db = require('../config/db');

exports.getSystemLogs = async (req, res) => {
    try {
        const [logs] = await db.execute(`
            SELECT a.*, u.name as user_name, u.role as user_role
            FROM audit_logs a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.timestamp DESC
            LIMIT 100
        `);

        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// GET ALL USERS (with manager names)
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT u1.*, u2.name as manager_name 
            FROM users u1 
            LEFT JOIN users u2 ON u1.manager_id = u2.id
            ORDER BY u1.role ASC
        `);
        res.json({ users });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ASSIGN MANAGER
exports.assignManager = async (req, res) => {
    try {
        const { userId } = req.params;
        const { managerId } = req.body;
        await db.execute('UPDATE users SET manager_id = ? WHERE id = ?', [managerId || null, userId]);
        res.json({ message: "Manager assigned successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};