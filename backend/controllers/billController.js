const Bill = require('../models/Bill');
const Rate = require('../models/Rate');
const { generateBillNumber } = require('../utils/billNumberGenerator');
const { 
  numberToWords, 
  calculateItemAmount, 
  calculateExchangeValue,
  calculateGST 
} = require('../utils/calculations');
const qr = require('qr-image');
const { validationResult } = require('express-validator');

exports.createBill = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array().map(err => ({ 
          field: err.path, 
          message: err.msg 
        }))
      });
    }

    const {
      customer,
      items,
      discount = 0,
      paymentMode = 'cash',
      paymentStatus = 'paid',
      exchangeItems = [],
      isIntraState = true,
      gstOnMetal = 3,
      gstOnMaking = 5
    } = req.body;

    // FIXED: Clean up optional fields - set to empty string if undefined or empty
    if (customer) {
      customer.address = customer.address || '';
      customer.dob = customer.dob || '';
      customer.pan = customer.pan || '';
      customer.aadhaar = customer.aadhaar || '';
      
      // Validate optional fields only if they have content
      if (customer.dob && customer.dob.trim() !== '') {
        const dobDate = new Date(customer.dob);
        if (isNaN(dobDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid date format for Date of Birth'
          });
        }
      }
      
      if (customer.pan && customer.pan.trim() !== '') {
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(customer.pan)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid PAN format. Should be ABCDE1234F format'
          });
        }
      }
      
      if (customer.aadhaar && customer.aadhaar.trim() !== '') {
        const aadhaarRegex = /^[0-9]{12}$/;
        if (!aadhaarRegex.test(customer.aadhaar)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid Aadhaar number. Should be 12 digits'
          });
        }
      }
    }

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required'
      });
    }

    // Generate bill number
    const billNumber = await generateBillNumber();

    // Get current rates
    const rates = await Rate.find({ active: true });
    const rateMap = {};
    rates.forEach(rate => {
      rateMap[rate.metalType] = rate;
    });

    // Calculate items
    let subTotal = 0;
    let totalMetalAmount = 0;
    let totalMakingCharges = 0;
    const calculatedItems = [];
    const exchangeDetails = {
      hasExchange: exchangeItems.length > 0,
      oldItemsTotal: 0,
      newItemsTotal: 0,
      balancePayable: 0,
      balanceRefundable: 0
    };

    // Process new items
    for (const item of items) {
      const rateInfo = rateMap[item.metalType];
      if (!rateInfo) {
        return res.status(400).json({
          success: false,
          message: `Rate not found for ${item.metalType}`
        });
      }

      // Get per gram rate (convert from kg if needed)
      let perGramRate = rateInfo.rate;
      if (rateInfo.unit === 'kg') {
        perGramRate = rateInfo.rate / 1000;
      }
      
      // Calculate net weight if gross and less weight provided
      let netWeight = item.weight;
      if (item.grossWeight && item.lessWeight) {
        netWeight = item.grossWeight - item.lessWeight;
      }
      
      // Use item's GST rates or default from request
      const itemGstOnMaking = item.gstOnMaking || gstOnMaking;
      const itemGstOnMetal = item.gstOnMetal || gstOnMetal;
      
      const itemCalc = calculateItemAmount(
        { 
          ...item, 
          rate: perGramRate,
          weight: netWeight,
          makingChargesDiscount: item.makingChargesDiscount || 0
        }, 
        perGramRate, 
        itemGstOnMaking,
        itemGstOnMetal,
        isIntraState
      );
      
      calculatedItems.push({
        ...item,
        // NEW: Include the additional fields
        unit: item.unit || 'GM',
        quantity: item.quantity || 1,
        grossWeight: item.grossWeight || 0,
        lessWeight: item.lessWeight || 0,
        weight: netWeight,
        rate: perGramRate,
        makingChargesAmount: itemCalc.makingCharges,
        makingChargesDiscount: item.makingChargesDiscount || 0,
        gstOnMaking: itemGstOnMaking,
        gstOnMetal: itemGstOnMetal,
        amount: itemCalc.total,
        gstDetails: isIntraState ? {
          cgstOnMetal: itemCalc.gstOnMetalCGST,
          sgstOnMetal: itemCalc.gstOnMetalSGST,
          cgstOnMaking: itemCalc.gstOnMakingCGST,
          sgstOnMaking: itemCalc.gstOnMakingSGST
        } : {
          igstOnMetal: itemCalc.gstOnMetalIGST,
          igstOnMaking: itemCalc.gstOnMakingIGST
        },
        metalAmount: itemCalc.metalAmount,
        makingCharges: itemCalc.makingCharges,
        huid: item.huid || '',
        tunch: item.tunch || ''
      });

      subTotal += itemCalc.total;
      totalMetalAmount += itemCalc.metalAmount;
      totalMakingCharges += itemCalc.makingCharges;
    }

    // Process exchange items
    if (exchangeItems.length > 0) {
      for (const oldItem of exchangeItems) {
        const rateInfo = rateMap[oldItem.metalType];
        if (!rateInfo) {
          return res.status(400).json({
            success: false,
            message: `Rate not found for exchange item ${oldItem.metalType}`
          });
        }

        let perGramRate = rateInfo.rate;
        if (rateInfo.unit === 'kg') {
          perGramRate = rateInfo.rate / 1000;
        }

        const exchangeValue = calculateExchangeValue(oldItem, perGramRate);
        exchangeDetails.oldItemsTotal += exchangeValue;

        calculatedItems.push({
          description: oldItem.description || 'Old Item Exchange',
          metalType: oldItem.metalType,
          purity: oldItem.purity,
          weight: oldItem.weight,
          rate: perGramRate,
          makingChargesType: 'fixed',
          makingCharges: 0,
          makingChargesAmount: 0,
          amount: -exchangeValue, // Negative amount for exchange
          isExchangeItem: true,
          exchangeDetails: {
            oldItemWeight: oldItem.weight,
            oldItemRate: perGramRate,
            wastageDeduction: oldItem.wastageDeduction || 0,
            meltingCharges: oldItem.meltingCharges || 0,
            netValue: exchangeValue
          }
        });
      }
    }

    // Calculate GST on final sale value (excluding exchange)
    const gstCalculation = calculateGST(
      totalMetalAmount,
      totalMakingCharges,
      gstOnMetal,
      gstOnMaking,
      isIntraState
    );

    // Calculate total before GST
    const totalBeforeGST = totalMetalAmount + totalMakingCharges - discount;
    
    // Calculate grand total including GST
    const grandTotal = totalBeforeGST + gstCalculation.totalGST;

    // Calculate exchange balances
    if (exchangeDetails.hasExchange) {
      exchangeDetails.newItemsTotal = grandTotal;
      const balance = exchangeDetails.oldItemsTotal - grandTotal;
      
      if (balance > 0) {
        exchangeDetails.balanceRefundable = balance;
      } else {
        exchangeDetails.balancePayable = Math.abs(balance);
      }
    }

    // Generate amount in words
    const amountInWords = numberToWords(grandTotal);

    // Generate QR codes
    const billQRData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber,
      customerName: customer.name,
      totalAmount: grandTotal,
      date: new Date().toISOString().split('T')[0],
      address: 'Anisabad, Patna, Bihar',
      gstType: isIntraState ? 'CGST+SGST' : 'IGST',
      gstNumber: isIntraState ? '10XXXXXX' : 'IGSTXXXXXXXXXX'
    };

    const qrImage = qr.imageSync(JSON.stringify(billQRData), { type: 'png' });
    const qrCodes = {
      billQR: qrImage.toString('base64'),
      itemProofQR: ''
    };

    // FIXED: Create bill with complete gstDetails object for frontend
    const billData = {
      billNumber,
      billDate: new Date(), // FIXED: Explicitly set billDate
      customer,
      items: calculatedItems,
      subTotal,
      discount,
      gst: gstCalculation.totalGST,
      gstDetails: {
        metalAmount: totalMetalAmount,
        makingCharges: totalMakingCharges,
        gstOnMetal: gstCalculation.gstOnMetal,
        gstOnMaking: gstCalculation.gstOnMaking,
        isIntraState: isIntraState,
        gstOnMetalRate: gstOnMetal,
        gstOnMakingRate: gstOnMaking,
        ...(isIntraState ? {
          cgstOnMetal: gstCalculation.gstOnMetalCGST,
          sgstOnMetal: gstCalculation.gstOnMetalSGST,
          cgstOnMaking: gstCalculation.gstOnMakingCGST,
          sgstOnMaking: gstCalculation.gstOnMakingSGST,
          totalCGST: gstCalculation.gstOnMetalCGST + gstCalculation.gstOnMakingCGST,
          totalSGST: gstCalculation.gstOnMetalSGST + gstCalculation.gstOnMakingSGST
        } : {
          igstOnMetal: gstCalculation.gstOnMetalIGST,
          igstOnMaking: gstCalculation.gstOnMakingIGST,
          totalIGST: gstCalculation.gstOnMetalIGST + gstCalculation.gstOnMakingIGST
        })
      },
      grandTotal,
      amountInWords,
      paymentMode,
      paymentStatus,
      exchangeDetails,
      qrCodes,
      createdBy: req.user._id,
      isActive: true,
      isIntraState
    };

    const bill = await Bill.create(billData);

    res.status(201).json({
      success: true,
      bill,
      message: 'Bill created successfully'
    });

  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};

exports.getBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id)
      .populate('createdBy', 'name')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      bill
    });

  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getBillByNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;
    
    const bill = await Bill.findOne({ billNumber })
      .populate('createdBy', 'name')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      bill
    });

  } catch (error) {
    console.error('Get bill by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getAllBills = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      startDate, 
      endDate,
      search,
      metalType,
      paymentStatus 
    } = req.query;

    const query = { isActive: true };

    // Date filter
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      query.$or = [
        { billNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.mobile': { $regex: search, $options: 'i' } }
      ];
    }

    // Metal type filter
    if (metalType) {
      query['items.metalType'] = metalType;
    }

    // Payment status filter
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'name')
      .sort({ billDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Bill.countDocuments(query);

    res.json({
      success: true,
      bills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.updateBill = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Don't allow updating certain fields
    delete updateData.billNumber;
    delete updateData.createdBy;
    delete updateData.createdAt;

    const updatedBill = await Bill.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name');

    res.json({
      success: true,
      bill: updatedBill,
      message: 'Bill updated successfully'
    });

  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.deleteBill = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Soft delete
    bill.isActive = false;
    await bill.save();

    res.json({
      success: true,
      message: 'Bill deleted successfully'
    });

  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const bills = await Bill.find({
      billDate: { $gte: startOfDay, $lte: endOfDay },
      isActive: true
    }).lean();

    const report = {
      date: startOfDay,
      totalBills: bills.length,
      totalSales: bills.reduce((sum, bill) => sum + bill.grandTotal, 0),
      cashSales: 0,
      cardSales: 0,
      upiSales: 0,
      metalWise: {},
      exchangeSummary: {
        totalExchanges: 0,
        totalExchangeValue: 0
      }
    };

    bills.forEach(bill => {
      // Payment mode breakdown
      if (bill.paymentMode === 'cash') report.cashSales += bill.grandTotal;
      if (bill.paymentMode === 'card') report.cardSales += bill.grandTotal;
      if (bill.paymentMode === 'upi') report.upiSales += bill.grandTotal;

      // Metal-wise sales
      bill.items.forEach(item => {
        if (!item.isExchangeItem) {
          report.metalWise[item.metalType] = report.metalWise[item.metalType] || {
            count: 0,
            amount: 0
          };
          report.metalWise[item.metalType].count += 1;
          report.metalWise[item.metalType].amount += item.amount;
        }
      });

      // Exchange summary
      if (bill.exchangeDetails?.hasExchange) {
        report.exchangeSummary.totalExchanges += 1;
        report.exchangeSummary.totalExchangeValue += bill.exchangeDetails.oldItemsTotal;
      }
    });

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.regenerateQR = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Regenerate bill QR
    const billQRData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber: bill.billNumber,
      customerName: bill.customer.name,
      totalAmount: bill.grandTotal,
      date: bill.billDate.toISOString().split('T')[0],
      address: 'Anisabad, Patna, Bihar'
    };

    const qrImage = qr.imageSync(JSON.stringify(billQRData), { type: 'png' });
    bill.qrCodes.billQR = qrImage.toString('base64');
    
    await bill.save();

    res.json({
      success: true,
      message: 'QR code regenerated',
      qrCode: bill.qrCodes.billQR
    });

  } catch (error) {
    console.error('Regenerate QR error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Calculate bill in real-time for frontend
exports.calculateBill = async (req, res) => {
  try {
    const {
      items,
      exchangeItems = [],
      discount = 0,
      isIntraState = true,
      gstOnMetal = 3,
      gstOnMaking = 5
    } = req.body;

    // Get current rates
    const rates = await Rate.find({ active: true });
    const rateMap = {};
    rates.forEach(rate => {
      rateMap[rate.metalType] = rate;
    });

    // Calculate items
    let subTotal = 0;
    let totalMetalAmount = 0;
    let totalMakingCharges = 0;
    let totalGST = 0;
    const calculatedItems = [];
    const exchangeDetails = {
      hasExchange: exchangeItems.length > 0,
      oldItemsTotal: 0,
      newItemsTotal: 0,
      balancePayable: 0,
      balanceRefundable: 0
    };

    // Process new items
    for (const item of items) {
      const rateInfo = rateMap[item.metalType];
      if (!rateInfo) {
        continue;
      }

      // Get per gram rate
      let perGramRate = rateInfo.rate;
      if (rateInfo.unit === 'kg') {
        perGramRate = rateInfo.rate / 1000;
      }
      
      // Calculate net weight if gross and less weight provided
      let netWeight = item.weight;
      if (item.grossWeight && item.lessWeight) {
        netWeight = item.grossWeight - item.lessWeight;
      }
      
      const itemCalc = calculateItemAmount(
        { 
          ...item, 
          rate: perGramRate,
          weight: netWeight,
          makingChargesDiscount: item.makingChargesDiscount || 0
        }, 
        perGramRate, 
        gstOnMaking,
        gstOnMetal,
        isIntraState
      );
      
      calculatedItems.push({
        ...item,
        unit: item.unit || 'GM',
        quantity: item.quantity || 1,
        grossWeight: item.grossWeight || 0,
        lessWeight: item.lessWeight || 0,
        weight: netWeight,
        rate: perGramRate,
        makingChargesAmount: itemCalc.makingCharges,
        makingChargesDiscount: item.makingChargesDiscount || 0,
        amount: itemCalc.total,
        metalAmount: itemCalc.metalAmount,
        makingCharges: itemCalc.makingCharges,
        gstOnItem: isIntraState ? 
          (itemCalc.gstOnMetalCGST + itemCalc.gstOnMetalSGST + itemCalc.gstOnMakingCGST + itemCalc.gstOnMakingSGST) :
          (itemCalc.gstOnMetalIGST + itemCalc.gstOnMakingIGST),
        huid: item.huid || '',
        tunch: item.tunch || ''
      });

      subTotal += itemCalc.total;
      totalMetalAmount += itemCalc.metalAmount;
      totalMakingCharges += itemCalc.makingCharges;
      totalGST += isIntraState ? 
        (itemCalc.gstOnMetalCGST + itemCalc.gstOnMetalSGST + itemCalc.gstOnMakingCGST + itemCalc.gstOnMakingSGST) :
        (itemCalc.gstOnMetalIGST + itemCalc.gstOnMakingIGST);
    }

    // Process exchange items
    for (const oldItem of exchangeItems) {
      const rateInfo = rateMap[oldItem.metalType];
      if (!rateInfo) {
        continue;
      }

      let perGramRate = rateInfo.rate;
      if (rateInfo.unit === 'kg') {
        perGramRate = rateInfo.rate / 1000;
      }

      const exchangeValue = calculateExchangeValue(oldItem, perGramRate);
      exchangeDetails.oldItemsTotal += exchangeValue;
    }

    // Calculate GST
    const gstCalculation = calculateGST(
      totalMetalAmount,
      totalMakingCharges,
      gstOnMetal,
      gstOnMaking,
      isIntraState
    );

    // Calculate totals
    const totalBeforeGST = totalMetalAmount + totalMakingCharges - discount;
    const grandTotal = totalBeforeGST + gstCalculation.totalGST;

    // Calculate exchange balances
    if (exchangeDetails.hasExchange) {
      exchangeDetails.newItemsTotal = grandTotal;
      const balance = exchangeDetails.oldItemsTotal - grandTotal;
      
      if (balance > 0) {
        exchangeDetails.balanceRefundable = balance;
      } else {
        exchangeDetails.balancePayable = Math.abs(balance);
      }
    }

    res.json({
      success: true,
      calculation: {
        subTotal,
        totalMetalAmount,
        totalMakingCharges,
        discount,
        gst: gstCalculation.totalGST,
        grandTotal,
        exchangeDetails,
        items: calculatedItems,
        gstDetails: gstCalculation
      }
    });

  } catch (error) {
    console.error('Calculate bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
