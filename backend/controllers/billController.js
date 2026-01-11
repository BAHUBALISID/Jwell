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
      discountType = 'amount',
      paymentMode = 'cash',
      paymentStatus = 'paid',
      exchangeItems = [],
      isIntraState = true,
      gstOnMetal = 3,
      gstOnMaking = 5,
      huidCharges = 0
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
    let totalItemHuidCharges = 0;
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
          makingChargesDiscount: item.makingChargesDiscount || 0,
          itemHuidCharges: item.itemHuidCharges || 0
        }, 
        perGramRate, 
        itemGstOnMaking,
        itemGstOnMetal,
        isIntraState
      );
      
      calculatedItems.push({
        ...item,
        // Include all new fields
        unit: item.unit || 'GM',
        quantity: item.quantity || 1,
        grossWeight: item.grossWeight || 0,
        lessWeight: item.lessWeight || 0,
        weight: netWeight,
        rate: perGramRate,
        makingChargesAmount: itemCalc.makingCharges,
        makingChargesDiscount: item.makingChargesDiscount || 0,
        itemHuidCharges: item.itemHuidCharges || 0,
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
        tunch: item.tunch || '',
        isExchangeItem: false
      });

      subTotal += itemCalc.total;
      totalMetalAmount += itemCalc.metalAmount;
      totalMakingCharges += itemCalc.makingCharges;
      totalItemHuidCharges += item.itemHuidCharges || 0;
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
          unit: 'GM',
          quantity: 1,
          grossWeight: oldItem.grossWeight || 0,
          lessWeight: oldItem.lessWeight || 0,
          weight: oldItem.weight,
          rate: perGramRate,
          makingChargesType: 'fixed',
          makingCharges: 0,
          makingChargesAmount: 0,
          amount: -exchangeValue,
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

    // Calculate total HUID charges (item level + bill level)
    const totalHuidCharges = totalItemHuidCharges + (huidCharges || 0);

    // Calculate GST on final sale value
    const gstCalculation = calculateGST(
      totalMetalAmount,
      totalMakingCharges,
      totalHuidCharges,
      gstOnMetal,
      gstOnMaking,
      isIntraState
    );

    // Calculate discount amount
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = (totalMetalAmount + totalMakingCharges + totalHuidCharges) * (discount / 100);
    } else {
      discountAmount = discount;
    }
    
    // Calculate total before GST
    const totalBeforeGST = totalMetalAmount + totalMakingCharges + totalHuidCharges - discountAmount;
    
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

    // Create bill with complete details
    const billData = {
      billNumber,
      billDate: new Date(),
      customer,
      items: calculatedItems,
      subTotal,
      discount: discountAmount,
      discountType,
      gst: gstCalculation.totalGST,
      gstDetails: {
        metalAmount: totalMetalAmount,
        makingCharges: totalMakingCharges,
        huidCharges: totalHuidCharges,
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
      huidCharges: totalHuidCharges,
      grandTotal,
      amountInWords,
      paymentMode,
      paymentStatus,
      exchangeDetails,
      qrCodes,
      createdBy: req.user._id,
      isActive: true,
      isIntraState,
      gstOnMetal,
      gstOnMaking
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
      },
      gstSummary: {
        totalGST: 0,
        cgst: 0,
        sgst: 0,
        igst: 0
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

      // GST summary
      report.gstSummary.totalGST += bill.gst || 0;
      if (bill.gstDetails) {
        if (bill.isIntraState) {
          report.gstSummary.cgst += bill.gstDetails.totalCGST || 0;
          report.gstSummary.sgst += bill.gstDetails.totalSGST || 0;
        } else {
          report.gstSummary.igst += bill.gstDetails.totalIGST || 0;
        }
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
      address: 'Anisabad, Patna, Bihar',
      gstType: bill.isIntraState ? 'CGST+SGST' : 'IGST',
      gstNumber: bill.isIntraState ? '10XXXXXX' : 'IGSTXXXXXXXXXX'
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
      discountType = 'amount',
      isIntraState = true,
      gstOnMetal = 3,
      gstOnMaking = 5,
      huidCharges = 0
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
    let totalItemHuidCharges = 0;
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
          makingChargesDiscount: item.makingChargesDiscount || 0,
          itemHuidCharges: item.itemHuidCharges || 0
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
        itemHuidCharges: item.itemHuidCharges || 0,
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
      totalItemHuidCharges += item.itemHuidCharges || 0;
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

    // Calculate total HUID charges
    const totalHuidCharges = totalItemHuidCharges + (huidCharges || 0);

    // Calculate discount
    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = (totalMetalAmount + totalMakingCharges + totalHuidCharges) * (discount / 100);
    } else {
      discountAmount = discount;
    }

    // Calculate GST
    const gstCalculation = calculateGST(
      totalMetalAmount,
      totalMakingCharges,
      totalHuidCharges,
      gstOnMetal,
      gstOnMaking,
      isIntraState
    );

    // Calculate totals
    const totalBeforeGST = totalMetalAmount + totalMakingCharges + totalHuidCharges - discountAmount;
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
        totalHuidCharges,
        discount: discountAmount,
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

// Get bill statistics
exports.getBillStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const todayBills = await Bill.countDocuments({
      billDate: { $gte: startOfToday, $lte: endOfToday },
      isActive: true
    });

    const monthBills = await Bill.countDocuments({
      billDate: { $gte: startOfMonth, $lte: endOfMonth },
      isActive: true
    });

    const totalBills = await Bill.countDocuments({ isActive: true });

    const todaySales = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: startOfToday, $lte: endOfToday },
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);

    const monthSales = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: startOfMonth, $lte: endOfMonth },
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);

    const totalSales = await Bill.aggregate([
      {
        $match: { isActive: true }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$grandTotal" }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        todayBills,
        monthBills,
        totalBills,
        todaySales: todaySales.length > 0 ? todaySales[0].total : 0,
        monthSales: monthSales.length > 0 ? monthSales[0].total : 0,
        totalSales: totalSales.length > 0 ? totalSales[0].total : 0
      }
    });

  } catch (error) {
    console.error('Get bill stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Search bills with advanced filters
exports.searchBills = async (req, res) => {
  try {
    const {
      query,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      paymentMode,
      paymentStatus,
      metalType,
      page = 1,
      limit = 20
    } = req.body;

    const searchQuery = { isActive: true };

    // Text search
    if (query) {
      searchQuery.$or = [
        { billNumber: { $regex: query, $options: 'i' } },
        { 'customer.name': { $regex: query, $options: 'i' } },
        { 'customer.mobile': { $regex: query, $options: 'i' } },
        { 'customer.address': { $regex: query, $options: 'i' } }
      ];
    }

    // Date range
    if (startDate || endDate) {
      searchQuery.billDate = {};
      if (startDate) searchQuery.billDate.$gte = new Date(startDate);
      if (endDate) searchQuery.billDate.$lte = new Date(endDate);
    }

    // Amount range
    if (minAmount || maxAmount) {
      searchQuery.grandTotal = {};
      if (minAmount) searchQuery.grandTotal.$gte = parseFloat(minAmount);
      if (maxAmount) searchQuery.grandTotal.$lte = parseFloat(maxAmount);
    }

    // Payment filters
    if (paymentMode) searchQuery.paymentMode = paymentMode;
    if (paymentStatus) searchQuery.paymentStatus = paymentStatus;

    // Metal type filter
    if (metalType) {
      searchQuery['items.metalType'] = metalType;
    }

    const bills = await Bill.find(searchQuery)
      .populate('createdBy', 'name')
      .sort({ billDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Bill.countDocuments(searchQuery);

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
    console.error('Search bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Export bills to CSV/Excel
exports.exportBills = async (req, res) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;

    const query = { isActive: true };

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    const bills = await Bill.find(query)
      .populate('createdBy', 'name')
      .sort({ billDate: -1 })
      .lean();

    // Format data for export
    const exportData = bills.map(bill => ({
      'Bill Number': bill.billNumber,
      'Date': new Date(bill.billDate).toLocaleDateString('en-IN'),
      'Customer Name': bill.customer.name,
      'Customer Mobile': bill.customer.mobile,
      'Metal Value': bill.gstDetails?.metalAmount || 0,
      'Making Charges': bill.gstDetails?.makingCharges || 0,
      'HUID Charges': bill.huidCharges || 0,
      'Discount': bill.discount || 0,
      'GST': bill.gst || 0,
      'Grand Total': bill.grandTotal,
      'Payment Mode': bill.paymentMode,
      'Payment Status': bill.paymentStatus,
      'GST Type': bill.isIntraState ? 'Intra-State' : 'Inter-State',
      'Created By': bill.createdBy?.name || 'Unknown',
      'Items Count': bill.items.filter(item => !item.isExchangeItem).length,
      'Exchange Items': bill.items.filter(item => item.isExchangeItem).length,
      'Has Exchange': bill.exchangeDetails?.hasExchange ? 'Yes' : 'No'
    }));

    if (format === 'json') {
      res.json({
        success: true,
        bills: exportData
      });
    } else {
      // For CSV, you would typically use a CSV library
      // Here's a simple CSV generation
      const csvHeaders = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' ? `"${value}"` : value
        ).join(',')
      );
      
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=bills-export.csv');
      res.send(csvContent);
    }

  } catch (error) {
    console.error('Export bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Bulk delete bills
exports.bulkDeleteBills = async (req, res) => {
  try {
    const { billIds } = req.body;

    if (!billIds || !Array.isArray(billIds) || billIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide bill IDs to delete'
      });
    }

    const result = await Bill.updateMany(
      { _id: { $in: billIds } },
      { $set: { isActive: false } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} bills deleted successfully`,
      deletedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Bulk delete bills error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Update bill payment status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMode, remarks } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    if (paymentStatus) bill.paymentStatus = paymentStatus;
    if (paymentMode) bill.paymentMode = paymentMode;
    
    // Add payment history
    if (!bill.paymentHistory) {
      bill.paymentHistory = [];
    }
    
    bill.paymentHistory.push({
      date: new Date(),
      previousStatus: bill.paymentStatus,
      newStatus: paymentStatus || bill.paymentStatus,
      mode: paymentMode || bill.paymentMode,
      remarks: remarks || '',
      updatedBy: req.user._id
    });

    await bill.save();

    res.json({
      success: true,
      bill,
      message: 'Payment status updated successfully'
    });

  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get bill payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id)
      .select('paymentHistory paymentStatus paymentMode')
      .populate('paymentHistory.updatedBy', 'name')
      .lean();

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    res.json({
      success: true,
      paymentHistory: bill.paymentHistory || [],
      currentStatus: bill.paymentStatus,
      currentMode: bill.paymentMode
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Generate duplicate bill
exports.duplicateBill = async (req, res) => {
  try {
    const { id } = req.params;

    const originalBill = await Bill.findById(id).lean();
    if (!originalBill) {
      return res.status(404).json({
        success: false,
        message: 'Original bill not found'
      });
    }

    // Remove old bill properties
    const { _id, __v, createdAt, updatedAt, billNumber, billDate, qrCodes, ...billData } = originalBill;

    // Generate new bill number
    const newBillNumber = await generateBillNumber();

    // Create new bill with updated data
    const newBillData = {
      ...billData,
      billNumber: newBillNumber,
      billDate: new Date(),
      qrCodes: { billQR: '', itemProofQR: '' },
      createdBy: req.user._id,
      isActive: true
    };

    // Generate QR code for new bill
    const billQRData = {
      shop: 'Shri Mahakaleshwar Jewellers',
      billNumber: newBillNumber,
      customerName: newBillData.customer.name,
      totalAmount: newBillData.grandTotal,
      date: new Date().toISOString().split('T')[0],
      address: 'Anisabad, Patna, Bihar',
      gstType: newBillData.isIntraState ? 'CGST+SGST' : 'IGST',
      gstNumber: newBillData.isIntraState ? '10XXXXXX' : 'IGSTXXXXXXXXXX'
    };

    const qrImage = qr.imageSync(JSON.stringify(billQRData), { type: 'png' });
    newBillData.qrCodes.billQR = qrImage.toString('base64');

    const newBill = await Bill.create(newBillData);

    res.status(201).json({
      success: true,
      bill: newBill,
      message: 'Bill duplicated successfully'
    });

  } catch (error) {
    console.error('Duplicate bill error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Get bill analytics
exports.getBillAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    let startDate, endDate;

    const now = new Date();
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        endDate = new Date();
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const analytics = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: startDate, $lte: endDate },
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalSales: { $sum: "$grandTotal" },
          totalGST: { $sum: "$gst" },
          totalDiscount: { $sum: "$discount" },
          avgBillValue: { $avg: "$grandTotal" },
          minBillValue: { $min: "$grandTotal" },
          maxBillValue: { $max: "$grandTotal" }
        }
      },
      {
        $project: {
          _id: 0,
          totalBills: 1,
          totalSales: { $round: ["$totalSales", 2] },
          totalGST: { $round: ["$totalGST", 2] },
          totalDiscount: { $round: ["$totalDiscount", 2] },
          avgBillValue: { $round: ["$avgBillValue", 2] },
          minBillValue: 1,
          maxBillValue: 1
        }
      }
    ]);

    // Payment mode breakdown
    const paymentBreakdown = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: startDate, $lte: endDate },
          isActive: true
        }
      },
      {
        $group: {
          _id: "$paymentMode",
          count: { $sum: 1 },
          totalAmount: { $sum: "$grandTotal" }
        }
      },
      {
        $project: {
          paymentMode: "$_id",
          count: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
          _id: 0
        }
      }
    ]);

    // Metal type breakdown
    const metalBreakdown = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: startDate, $lte: endDate },
          isActive: true
        }
      },
      { $unwind: "$items" },
      {
        $match: {
          "items.isExchangeItem": false
        }
      },
      {
        $group: {
          _id: "$items.metalType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$items.amount" },
          totalWeight: { $sum: "$items.weight" }
        }
      },
      {
        $project: {
          metalType: "$_id",
          count: 1,
          totalAmount: { $round: ["$totalAmount", 2] },
          totalWeight: { $round: ["$totalWeight", 3] },
          _id: 0
        }
      }
    ]);

    // Daily sales trend
    const dailySales = await Bill.aggregate([
      {
        $match: {
          billDate: { $gte: startDate, $lte: endDate },
          isActive: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$billDate" },
            month: { $month: "$billDate" },
            day: { $dayOfMonth: "$billDate" }
          },
          date: { $first: "$billDate" },
          count: { $sum: 1 },
          totalSales: { $sum: "$grandTotal" }
        }
      },
      {
        $sort: { date: 1 }
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$date"
            }
          },
          count: 1,
          totalSales: { $round: ["$totalSales", 2] },
          _id: 0
        }
      }
    ]);

    res.json({
      success: true,
      analytics: analytics[0] || {
        totalBills: 0,
        totalSales: 0,
        totalGST: 0,
        totalDiscount: 0,
        avgBillValue: 0,
        minBillValue: 0,
        maxBillValue: 0
      },
      paymentBreakdown,
      metalBreakdown,
      dailySales,
      period: {
        start: startDate,
        end: endDate,
        type: period
      }
    });

  } catch (error) {
    console.error('Get bill analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
