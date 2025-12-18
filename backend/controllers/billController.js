const Bill = require('../models/Bill');
const Item = require('../models/Item');
const Rate = require('../models/Rate');
const { generateBillNumber } = require('../utils/billNumberGenerator');
const { 
  calculateBillTotals, 
  calculateNetPayable,
  numberToWords
} = require('../utils/calculations');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

const createBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const {
      billType,
      customerName,
      customerPhone,
      customerAddress,
      items,
      exchangeItems,
      paymentMethod,
      paymentStatus,
      paidAmount,
      notes
    } = req.body;
    
    // Get current rates
    const rates = await Rate.findOne().sort({ createdAt: -1 }).session(session);
    if (!rates) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'Rates not found. Please set rates first.' 
      });
    }
    
    // Generate bill number
    const billNumber = await generateBillNumber();
    
    // Process items
    const itemPromises = items.map(async (itemData) => {
      const rateMap = {
        '24K': { perKg: rates.gold24K, perGram: rates.gold24KPerGram },
        '22K': { perKg: rates.gold22K, perGram: rates.gold22KPerGram },
        '18K': { perKg: rates.gold18K, perGram: rates.gold18KPerGram },
        '999': { perKg: rates.silver999, perGram: rates.silver999PerGram },
        '925': { perKg: rates.silver925, perGram: rates.silver925PerGram }
      };
      
      const rate = rateMap[itemData.purity];
      if (!rate) {
        throw new Error(`Invalid purity: ${itemData.purity}`);
      }
      
      const metalValue = itemData.netWeight * rate.perGram;
      const makingChargeAmount = itemData.makingChargeType === 'percentage' 
        ? (metalValue * itemData.makingChargeValue) / 100
        : itemData.makingChargeValue;
      
      const totalBeforeTax = metalValue + makingChargeAmount;
      const gst = {
        cgst: (totalBeforeTax * 3) / 100,
        sgst: (totalBeforeTax * 3) / 100
      };
      
      const item = new Item({
        description: itemData.description,
        metalType: itemData.metalType,
        purity: itemData.purity,
        grossWeight: itemData.grossWeight,
        netWeight: itemData.netWeight,
        ratePerKg: rate.perKg,
        ratePerGram: rate.perGram,
        metalValue,
        makingChargeType: itemData.makingChargeType,
        makingChargeValue: itemData.makingChargeValue,
        makingChargeAmount,
        totalBeforeTax,
        cgst: gst.cgst,
        sgst: gst.sgst,
        total: totalBeforeTax + gst.cgst + gst.sgst
      });
      
      return await item.save({ session });
    });
    
    const savedItems = await Promise.all(itemPromises);
    
    // Calculate totals
    const totals = calculateBillTotals(savedItems);
    
    // Process exchange items
    let totalExchangeValue = 0;
    const processedExchangeItems = exchangeItems?.map(exItem => {
      const rateMap = {
        '24K': { perKg: rates.gold24K, perGram: rates.gold24KPerGram },
        '22K': { perKg: rates.gold22K, perGram: rates.gold22KPerGram },
        '18K': { perKg: rates.gold18K, perGram: rates.gold18KPerGram },
        '999': { perKg: rates.silver999, perGram: rates.silver999PerGram },
        '925': { perKg: rates.silver925, perGram: rates.silver925PerGram }
      };
      
      const rate = rateMap[exItem.purity];
      if (!rate) {
        throw new Error(`Invalid purity: ${exItem.purity}`);
      }
      
      const metalValue = exItem.weight * rate.perGram;
      const wastageDeduction = exItem.wastageDeduction || 0;
      const exchangeValue = metalValue - (metalValue * wastageDeduction) / 100;
      
      totalExchangeValue += exchangeValue;
      
      return {
        ...exItem,
        ratePerKg: rate.perKg,
        ratePerGram: rate.perGram,
        metalValue,
        exchangeValue
      };
    }) || [];
    
    // Calculate net payable
    const netPayableCalc = calculateNetPayable(totals.totalAmount, totalExchangeValue);
    
    // Calculate due amount
    const dueAmount = paymentStatus === 'paid' ? 0 : 
                     paymentStatus === 'partial' ? (netPayableCalc.netPayable - paidAmount) :
                     netPayableCalc.netPayable;
    
    // Create bill
    const bill = new Bill({
      billNumber,
      billType,
      customerName,
      customerPhone,
      customerAddress,
      items: savedItems.map(item => item._id),
      exchangeItems: processedExchangeItems,
      totalMetalValue: totals.totalMetalValue,
      totalMakingCharge: totals.totalMakingCharge,
      totalBeforeTax: totals.totalBeforeTax,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      totalTax: totals.totalTax,
      totalAmount: totals.totalAmount,
      totalExchangeValue,
      netPayable: netPayableCalc.netPayable,
      balanceType: netPayableCalc.balanceType,
      paymentMethod,
      paymentStatus,
      paidAmount: paidAmount || (paymentStatus === 'paid' ? netPayableCalc.netPayable : 0),
      dueAmount,
      notes,
      createdBy: req.user._id
    });
    
    const savedBill = await bill.save({ session });
    
    await session.commitTransaction();
    
    // Populate bill details
    const populatedBill = await Bill.findById(savedBill._id)
      .populate('items')
      .populate('createdBy', 'username');
    
    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      bill: populatedBill,
      amountInWords: numberToWords(populatedBill.netPayable)
    });
    
  } catch (error) {
    await session.abortTransaction();
    console.error('Create bill error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error' 
    });
  } finally {
    session.endSession();
  }
};

const getBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findById(id)
      .populate('items')
      .populate('createdBy', 'username shopName address gstin phone');
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }
    
    res.json({
      success: true,
      bill,
      amountInWords: numberToWords(bill.netPayable)
    });
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const getBillByNumber = async (req, res) => {
  try {
    const { billNumber } = req.params;
    
    const bill = await Bill.findOne({ billNumber })
      .populate('items')
      .populate('createdBy', 'username shopName address gstin phone');
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }
    
    res.json({
      success: true,
      bill,
      amountInWords: numberToWords(bill.netPayable)
    });
  } catch (error) {
    console.error('Get bill by number error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const getBills = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      startDate,
      endDate,
      customerName,
      billType,
      paymentStatus
    } = req.query;
    
    const filter = { isDeleted: false };
    
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (customerName) {
      filter.customerName = { $regex: customerName, $options: 'i' };
    }
    
    if (billType) {
      filter.billType = billType;
    }
    
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }
    
    const bills = await Bill.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'username')
      .select('-exchangeItems -items');
    
    const count = await Bill.countDocuments(filter);
    
    res.json({
      success: true,
      bills,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalRecords: count
    });
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    const bill = await Bill.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    
    if (!bill) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bill not found' 
      });
    }
    
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

module.exports = { 
  createBill, 
  getBill, 
  getBillByNumber, 
  getBills, 
  deleteBill 
};
