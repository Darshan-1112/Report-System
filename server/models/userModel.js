const db = require('../config/db');

const User = {
    findByEmail: async (email) => {
        const [rows] = await db.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0];
    },

    create: async (userData) => {
        let { name, email, password, role, manager_id, department } = userData;
        if (!name || !email || !password || !role) {
            throw new Error("Missing required fields");
        }
        // 🔥 Fix: Convert undefined → null
        manager_id = manager_id ?? null;
        department = department ?? null;

        const query = `
            INSERT INTO users (name, email, password, role, manager_id, department) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        return await db.execute(query, [
            name,
            email,
            password,
            role,
            manager_id,
            department
        ]);
    }
};

module.exports = User;