const Rate = require('../models/Rate');
const { validationResult } = require('express-validator');

const getCurrentRates = async (req, res) => {
  try {
    const rates = await Rate.findOne().sort({ createdAt: -1 });
    
    if (!rates) {
      return res.status(404).json({ 
        success: false, 
        message: 'Rates not found' 
      });
    }
    
    // Add per gram rates
    const ratesWithPerGram = rates.toObject();
    ratesWithPerGram.gold24KPerGram = rates.gold24KPerGram;
    ratesWithPerGram.gold22KPerGram = rates.gold22KPerGram;
    ratesWithPerGram.gold18KPerGram = rates.gold18KPerGram;
    ratesWithPerGram.silver999PerGram = rates.silver999PerGram;
    ratesWithPerGram.silver925PerGram = rates.silver925PerGram;
    
    res.json({
      success: true,
      rates: ratesWithPerGram
    });
  } catch (error) {
    console.error('Get rates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const updateRates = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { gold24K, gold22K, gold18K, silver999, silver925 } = req.body;
    
    const newRates = await Rate.create({
      gold24K,
      gold22K,
      gold18K,
      silver999,
      silver925,
      lastUpdated: new Date()
    });
    
    // Add per gram rates
    const ratesWithPerGram = newRates.toObject();
    ratesWithPerGram.gold24KPerGram = newRates.gold24KPerGram;
    ratesWithPerGram.gold22KPerGram = newRates.gold22KPerGram;
    ratesWithPerGram.gold18KPerGram = newRates.gold18KPerGram;
    ratesWithPerGram.silver999PerGram = newRates.silver999PerGram;
    ratesWithPerGram.silver925PerGram = newRates.silver925PerGram;
    
    res.json({
      success: true,
      message: 'Rates updated successfully',
      rates: ratesWithPerGram
    });
  } catch (error) {
    console.error('Update rates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const getRateHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const rates = await Rate.find()
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');
    
    const count = await Rate.countDocuments();
    
    res.json({
      success: true,
      rates,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalRecords: count
    });
  } catch (error) {
    console.error('Get rate history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = { getCurrentRates, updateRates, getRateHistory };
