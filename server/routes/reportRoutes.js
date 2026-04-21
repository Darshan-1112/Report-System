const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Only 'employee' role can access this
router.post('/submit', verifyToken, authorize(['employee']), reportController.createReport);

// Manager: Get team's pending reports
router.get('/pending', verifyToken, authorize(['manager']), reportController.getPendingReports);

// Manager: Review (Approve/Reject) a report
router.put('/review/:id', verifyToken, authorize(['manager']), reportController.reviewReport);

router.get('/my', verifyToken, authorize(['employee']), reportController.getMyReports);

router.get('/stats', verifyToken, reportController.getDashboardStats);

router.get('/chart', verifyToken, reportController.getChartData);

module.exports = router;