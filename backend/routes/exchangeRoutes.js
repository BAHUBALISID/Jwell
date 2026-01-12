const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { auth } = require('../middleware/auth'); // Fixed: destructure auth

// Apply auth middleware to all routes
router.use(auth);

// Create exchange
router.post('/', exchangeController.createExchange);

// Get all exchanges
router.get('/', exchangeController.getAllExchanges);

// Convert exchange to bill
router.put('/:id/convert-to-bill', exchangeController.convertToBill);

module.exports = router;
