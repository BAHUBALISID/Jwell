const express = require('express');
const router = express.Router();
const { 
  getDailyReport, 
  getMonthlyReport, 
  getCustomerReport, 
  getSalesSummary 
} = require('../controllers/reportController');
const { auth } = require('../middleware/auth');

// @route   GET /api/reports/daily
// @desc    Get daily sales report
// @access  Private
router.get('/daily', auth, getDailyReport);

// @route   GET /api/reports/monthly
// @desc    Get monthly sales report
// @access  Private
router.get('/monthly', auth, getMonthlyReport);

// @route   GET /api/reports/customer
// @desc    Get customer purchase history
// @access  Private
router.get('/customer', auth, getCustomerReport);

// @route   GET /api/reports/sales-summary
// @desc    Get sales summary for date range
// @access  Private
router.get('/sales-summary', auth, getSalesSummary);

module.exports = router;
