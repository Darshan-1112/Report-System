const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwtHelper');

exports.register = async (req, res) => {
    try {
        const { name, email, password, role, manager_id, department } = req.body;

        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) return res.status(400).json({ message: "User already exists" });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save User
        await User.create({
            name, email, password: hashedPassword, role, manager_id, department
        });

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findByEmail(email);

        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        // Generate JWT (Payload includes role and manager_id for frontend logic)
        const token = generateToken(user);

        res.json({
            token,
            user: { id: user.id, name: user.name, role: user.role, manager_id: user.manager_id }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};