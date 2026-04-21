const jwt = require('jsonwebtoken');

/**
 * Middleware to verify if the user is authenticated via JWT
 */
const verifyToken = (req, res, next) => {
    // Get token from header (Format: Bearer <token>)
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ 
            success: false, 
            message: "Access denied. No token provided." 
        });
    }

    try {
        // Verify the token using your secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach the user data (id, role, manager_id) to the request object
        req.user = decoded; 
        next(); // Move to the next function (the Controller)
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: "Invalid or expired token." 
        });
    }
};

/**
 * Middleware to restrict access based on user roles
 * @param {Array} roles - Allowed roles, e.g., ['admin', 'manager']
 */
const authorize = (roles = []) => {
    return (req, res, next) => {
        // req.user was populated by verifyToken
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `Forbidden: You do not have permission (${req.user.role}) to access this.` 
            });
        }
        next();
    };
};

module.exports = { verifyToken, authorize };