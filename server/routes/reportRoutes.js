const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Static routes FIRST — must come before any /:id routes
router.post('/submit',  verifyToken, authorize(['employee']), reportController.createReport);
router.get('/pending',  verifyToken, authorize(['manager']),  reportController.getPendingReports);
router.get('/my',       verifyToken, authorize(['employee']), reportController.getMyReports);
router.get('/stats',    verifyToken,                          reportController.getDashboardStats);
router.get('/chart',    verifyToken,                          reportController.getChartData);

router.put('/review/:id', verifyToken, authorize(['manager']), reportController.reviewReport);

// Dynamic /:id routes LAST — so they never shadow static paths above
router.get('/:id/tasks', verifyToken, authorize(['manager']), reportController.getReportTasks);

module.exports = router;
