const Rate = require('../models/Rate');
const { validationResult } = require('express-validator');

exports.getRates = async (req, res) => {
  try {
    const rates = await Rate.find({ active: true }).lean();
    
    // Format rates for frontend
    const formattedRates = rates.map(rate => ({
      ...rate,
      perGramRate: rate.unit === 'kg' ? rate.rate / 1000 : rate.rate
    }));

    res.json({
      success: true,
      rates: formattedRates
    });
  } catch (error) {
    console.error('Get rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.updateRate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { metalType } = req.params;
    const { rate, makingChargesDefault, gstRate, purityLevels } = req.body;

    const rateDoc = await Rate.findOne({ metalType, active: true });
    if (!rateDoc) {
      return res.status(404).json({
        success: false,
        message: 'Metal type not found'
      });
    }

    // Update fields
    if (rate !== undefined) rateDoc.rate = rate;
    if (makingChargesDefault !== undefined) rateDoc.makingChargesDefault = makingChargesDefault;
    if (gstRate !== undefined) rateDoc.gstRate = gstRate;
    if (purityLevels) rateDoc.purityLevels = purityLevels;
    
    rateDoc.lastUpdated = Date.now();
    rateDoc.updatedBy = req.user._id;

    await rateDoc.save();

    res.json({
      success: true,
      rate: rateDoc,
      message: 'Rate updated successfully'
    });

  } catch (error) {
    console.error('Update rate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.addMetalCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, unit, purityLevels, makingChargesDefault = 10, gstRate = 3 } = req.body;

    // Check if category already exists
    const existing = await Rate.findOne({ metalType: name });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Metal category already exists'
      });
    }

    const rate = await Rate.create({
      metalType: name,
      rate: 0,
      unit,
      purityLevels: purityLevels || ['Standard'],
      makingChargesDefault,
      gstRate,
      lastUpdated: Date.now(),
      updatedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      rate,
      message: 'Metal category added successfully'
    });

  } catch (error) {
    console.error('Add metal category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.toggleMetalCategory = async (req, res) => {
  try {
    const { metalType } = req.params;
    const { active } = req.body;

    const rate = await Rate.findOne({ metalType });
    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Metal category not found'
      });
    }

    rate.active = active;
    await rate.save();

    res.json({
      success: true,
      message: `Metal category ${active ? 'activated' : 'deactivated'}`
    });

  } catch (error) {
    console.error('Toggle metal category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getRateHistory = async (req, res) => {
  try {
    const { metalType, days = 30 } = req.query;
    
    // In a real application, you would have a RateHistory model
    // For now, we'll return the current rate with timestamp
    const rate = await Rate.findOne({ 
      metalType,
      active: true 
    }).lean();

    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Metal type not found'
      });
    }

    // Simulate rate history (in production, store historical rates)
    const history = [{
      rate: rate.rate,
      date: rate.lastUpdated,
      updatedBy: rate.updatedBy
    }];

    res.json({
      success: true,
      metalType,
      currentRate: rate.rate,
      history,
      perGramRate: rate.unit === 'kg' ? rate.rate / 1000 : rate.rate
    });

  } catch (error) {
    console.error('Get rate history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.calculateItemPrice = async (req, res) => {
  try {
    const { metalType, purity, weight, makingCharges, makingChargesType } = req.body;

    const rate = await Rate.findOne({ metalType, active: true });
    if (!rate) {
      return res.status(404).json({
        success: false,
        message: 'Metal type not found'
      });
    }

    // Calculate base price
    let basePrice = 0;
    if (rate.unit === 'kg') {
      basePrice = (rate.rate / 1000) * weight;
    } else if (rate.unit === 'carat') {
      basePrice = rate.rate * weight;
    } else {
      basePrice = rate.rate;
    }

    // Apply purity adjustment for gold
    if (metalType === 'Gold') {
      if (purity === '22K') basePrice = basePrice * 0.9167;
      else if (purity === '18K') basePrice = basePrice * 0.75;
      else if (purity === '14K') basePrice = basePrice * 0.5833;
    }

    // Calculate making charges
    let makingChargesAmount = 0;
    const charges = makingCharges || rate.makingChargesDefault;
    const chargesType = makingChargesType || rate.makingChargesType;

    if (chargesType === 'percentage') {
      makingChargesAmount = (basePrice * charges) / 100;
    } else {
      makingChargesAmount = charges;
    }

    const itemTotal = basePrice + makingChargesAmount;

    res.json({
      success: true,
      calculation: {
        basePrice,
        makingCharges: makingChargesAmount,
        total: itemTotal,
        perGramRate: rate.unit === 'kg' ? rate.rate / 1000 : rate.rate
      }
    });

  } catch (error) {
    console.error('Calculate item price error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
