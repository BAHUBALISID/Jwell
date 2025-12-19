const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateController = require('../controllers/rateController');
const { auth, staffOrAdmin } = require('../middleware/auth');

// Validation rules
const updateRateValidation = [
  body('rate').isFloat({ min: 0 }).withMessage('Rate must be a positive number'),
  body('makingChargesDefault').optional().isFloat({ min: 0 }).withMessage('Making charges must be positive'),
  body('gstRate').optional().isFloat({ min: 0, max: 100 }).withMessage('GST rate must be between 0-100'),
  body('purityLevels').optional().isArray().withMessage('Purity levels must be an array')
];

const addCategoryValidation = [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('unit').isIn(['kg', 'carat', 'piece']).withMessage('Valid unit is required'),
  body('purityLevels').isArray().withMessage('Purity levels must be an array'),
  body('makingChargesDefault').optional().isFloat({ min: 0 }).withMessage('Making charges must be positive'),
  body('gstRate').optional().isFloat({ min: 0, max: 100 }).withMessage('GST rate must be between 0-100')
];

// Public routes (rates are public)
router.get('/', rateController.getRates);
router.post('/calculate', rateController.calculateItemPrice);

// Protected routes (staff and admin)
router.use(auth);
router.use(staffOrAdmin);

router.put('/:metalType', updateRateValidation, rateController.updateRate);
router.post('/category', addCategoryValidation, rateController.addMetalCategory);
router.put('/category/:metalType/toggle', rateController.toggleMetalCategory);
router.get('/:metalType/history', rateController.getRateHistory);

module.exports = router;
