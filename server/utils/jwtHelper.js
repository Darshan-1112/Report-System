const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            role: user.role, 
            manager_id: user.manager_id 
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '24h' }
    );
};

module.exports = { generateToken };