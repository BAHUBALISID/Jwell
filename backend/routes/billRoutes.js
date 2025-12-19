const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const billController = require('../controllers/billController');
const { auth, staffOrAdmin } = require('../middleware/auth');

// Validation rules
const createBillValidation = [
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.mobile').matches(/^[0-9]{10}$/).withMessage('Valid mobile number is required'),
  body('customer.address').trim().notEmpty().withMessage('Address is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.description').trim().notEmpty().withMessage('Item description is required'),
  body('items.*.metalType').isIn(['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others'])
    .withMessage('Valid metal type is required'),
  body('items.*.purity').trim().notEmpty().withMessage('Purity is required'),
  body('items.*.weight').isFloat({ min: 0 }).withMessage('Valid weight is required'),
  body('items.*.makingCharges').isFloat({ min: 0 }).withMessage('Valid making charges is required'),
  body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be a positive number')
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

module.exports = router;
