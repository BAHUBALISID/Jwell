const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Create exchange
router.post('/', exchangeController.createExchange);

// Get all exchanges
router.get('/', exchangeController.getAllExchanges);

// Get exchange by number
router.get('/:exchangeNumber', exchangeController.getExchangeByNumber);

// Convert exchange to bill
router.put('/:id/convert-to-bill', exchangeController.convertToBill);

// Delete exchange
router.delete('/:id', exchangeController.deleteExchange);

// Get exchange statistics
router.get('/stats/summary', exchangeController.getExchangeStats);

module.exports = router;
