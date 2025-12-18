const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { 
  createBill, 
  getBill, 
  getBillByNumber, 
  getBills, 
  deleteBill 
} = require('../controllers/billController');
const { auth } = require('../middleware/auth');

// @route   POST /api/bills
// @desc    Create a new bill
// @access  Private
router.post('/', auth, [
  body('billType').isIn(['sale', 'exchange', 'sale_exchange']).withMessage('Invalid bill type'),
  body('customerName').notEmpty().withMessage('Customer name is required'),
  body('customerPhone').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').notEmpty().withMessage('Item description is required'),
  body('items.*.metalType').isIn(['gold', 'silver']).withMessage('Invalid metal type'),
  body('items.*.purity').isIn(['24K', '22K', '18K', '999', '925']).withMessage('Invalid purity'),
  body('items.*.grossWeight').isNumeric().withMessage('Gross weight is required'),
  body('items.*.netWeight').isNumeric().withMessage('Net weight is required'),
  body('items.*.makingChargeType').isIn(['percentage', 'fixed']).withMessage('Invalid making charge type'),
  body('items.*.makingChargeValue').isNumeric().withMessage('Making charge value is required'),
  body('exchangeItems').optional().isArray(),
  body('paymentMethod').optional().isIn(['cash', 'card', 'upi', 'bank_transfer']),
  body('paymentStatus').optional().isIn(['paid', 'pending', 'partial']),
  body('paidAmount').optional().isNumeric()
], createBill);

// @route   GET /api/bills
// @desc    Get all bills with filters
// @access  Private
router.get('/', auth, getBills);

// @route   GET /api/bills/:id
// @desc    Get bill by ID
// @access  Private
router.get('/:id', auth, getBill);

// @route   GET /api/bills/number/:billNumber
// @desc    Get bill by bill number
// @access  Private
router.get('/number/:billNumber', auth, getBillByNumber);

// @route   DELETE /api/bills/:id
// @desc    Delete a bill (soft delete)
// @access  Private
router.delete('/:id', auth, deleteBill);

module.exports = router;
