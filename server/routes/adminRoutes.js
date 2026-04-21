const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// 1. System Logs (We built this earlier)
router.get('/logs', verifyToken, authorize(['admin']), adminController.getSystemLogs);

// 2. User Management (NEW)
router.get('/users', verifyToken, authorize(['admin']), adminController.getAllUsers);
router.put('/users/:userId/assign-manager', verifyToken, authorize(['admin']), adminController.assignManager);

module.exports = router;