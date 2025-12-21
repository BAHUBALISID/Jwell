const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const { auth, staffOrAdmin } = require('../middleware/auth');

// Validation rules - Fixed to handle optional fields properly
const createBillValidation = [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.mobile').matches(/^[0-9]{10}$/).withMessage('Valid mobile number is required'),
  body('customer.address').optional({ checkFalsy: true }).trim(),
  body('customer.dob').optional({ checkFalsy: true }).isISO8601().withMessage('Valid date format required'),
  body('customer.pan').optional({ checkFalsy: true }).matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).withMessage('Valid PAN format required'),
  body('customer.aadhaar').optional({ checkFalsy: true }).matches(/^[0-9]{12}$/).withMessage('Valid 12-digit Aadhaar required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').optional({ checkFalsy: true }).trim(),
  body('items.*.metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'])
    .withMessage('Valid metal type is required'),
  body('items.*.purity').trim().notEmpty().withMessage('Purity is required'),
  body('items.*.weight').isFloat({ min: 0.001 }).withMessage('Valid weight is required (min 0.001)'),
  body('items.*.makingCharges').isFloat({ min: 0 }).withMessage('Valid making charges is required'),
  body('discount').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Discount must be a positive number'),
  body('isIntraState').optional({ checkFalsy: true }).isBoolean(),
  body('gstOnMetal').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('GST on metal must be between 0-100'),
  body('gstOnMaking').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('GST on making must be between 0-100')
];

// Protected routes (staff and admin)
router.use(auth);
router.use(staffOrAdmin);

// Bill CRUD operations
router.post('/create', createBillValidation, billController.createBill);
router.get('/', billController.getAllBills);
router.get('/:id', billController.getBill);
router.get('/number/:billNumber', billController.getBillByNumber);
router.put('/:id', billController.updateBill);
router.delete('/:id', billController.deleteBill);

// Reports
router.get('/report/daily', billController.getDailyReport);

// QR operations
router.post('/:id/regenerate-qr', billController.regenerateQR);

// Real-time calculation
router.post('/calculate', billController.calculateBill);

module.exports = router;
