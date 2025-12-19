const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { auth, adminOnly } = require('../middleware/auth');

// All report routes are protected
router.use(auth);

// Sales reports (admin only)
router.get('/sales', adminOnly, reportController.getSalesReport);
router.get('/ai-analysis', adminOnly, reportController.getAIAnalysis);
router.get('/customer', adminOnly, reportController.getCustomerReport);
router.get('/stock', adminOnly, reportController.getStockReport);
router.get('/gst', adminOnly, reportController.getGSTReport);

module.exports = router;
