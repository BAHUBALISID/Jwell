const Bill = require('../models/Bill');
const Rate = require('../models/Rate');
const AIAnalyzer = require('../utils/aiAnalyzer');
const ExcelJS = require('exceljs');
const moment = require('moment');

const aiAnalyzer = new AIAnalyzer();

exports.getSalesReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      metalType, 
      groupBy = 'day',
      format = 'json' 
    } = req.query;

    const query = { isActive: true };

    // Date filter
    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    // Metal type filter
    if (metalType) {
      query['items.metalType'] = metalType;
    }

    const bills = await Bill.find(query).lean();

    // Group data
    const groupedData = {};
    const dateFormat = groupBy === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';

    bills.forEach(bill => {
      const dateKey = moment(bill.billDate).format(dateFormat);
      
      if (!groupedData[dateKey]) {
        groupedData[dateKey] = {
          date: dateKey,
          totalBills: 0,
          totalSales: 0,
          totalItems: 0,
          metalWise: {},
          paymentMode: {}
        };
      }

      groupedData[dateKey].totalBills += 1;
      groupedData[dateKey].totalSales += bill.grandTotal;

      // Count items
      const newItems = bill.items.filter(item => !item.isExchangeItem);
      groupedData[dateKey].totalItems += newItems.length;

      // Metal-wise data
      newItems.forEach(item => {
        if (!groupedData[dateKey].metalWise[item.metalType]) {
          groupedData[dateKey].metalWise[item.metalType] = {
            count: 0,
            amount: 0
          };
        }
        groupedData[dateKey].metalWise[item.metalType].count += 1;
        groupedData[dateKey].metalWise[item.metalType].amount += item.amount;
      });

      // Payment mode
      if (!groupedData[dateKey].paymentMode[bill.paymentMode]) {
        groupedData[dateKey].paymentMode[bill.paymentMode] = 0;
      }
      groupedData[dateKey].paymentMode[bill.paymentMode] += bill.grandTotal;
    });

    // Convert to array and sort by date
    const result = Object.values(groupedData).sort((a, b) => 
      moment(a.date).diff(moment(b.date))
    );

    // Calculate summary
    const summary = {
      totalPeriodBills: result.reduce((sum, day) => sum + day.totalBills, 0),
      totalPeriodSales: result.reduce((sum, day) => sum + day.totalSales, 0),
      averageDailySales: result.length > 0 ? 
        result.reduce((sum, day) => sum + day.totalSales, 0) / result.length : 0,
      highestSaleDay: result.length > 0 ? 
        result.reduce((max, day) => day.totalSales > max.totalSales ? day : max) : null,
      metalWiseTotal: {}
    };

    // Calculate metal-wise totals
    result.forEach(day => {
      Object.keys(day.metalWise).forEach(metal => {
        if (!summary.metalWiseTotal[metal]) {
          summary.metalWiseTotal[metal] = {
            count: 0,
            amount: 0
          };
        }
        summary.metalWiseTotal[metal].count += day.metalWise[metal].count;
        summary.metalWiseTotal[metal].amount += day.metalWise[metal].amount;
      });
    });

    if (format === 'excel') {
      return await generateExcelReport(res, result, summary, startDate, endDate);
    }

    res.json({
      success: true,
      report: {
        period: { startDate, endDate },
        summary,
        dailyData: result
      }
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getAIAnalysis = async (req, res) => {
  try {
    const { 
      timeFilter = 'current_month',
      startDate,
      endDate,
      metalType,
      paymentStatus 
    } = req.query;

    const filter = {
      timeFilter,
      startDate,
      endDate,
      metalType,
      paymentStatus
    };

    const analysis = await aiAnalyzer.analyzeSalesData(filter);

    res.json({
      success: true,
      analysis,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate AI analysis'
    });
  }
};

exports.getCustomerReport = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate,
      minPurchase = 0,
      limit = 100 
    } = req.query;

    const query = { isActive: true };

    if (startDate || endDate) {
      query.billDate = {};
      if (startDate) query.billDate.$gte = new Date(startDate);
      if (endDate) query.billDate.$lte = new Date(endDate);
    }

    // Aggregate customer data
    const customerData = await Bill.aggregate([
      { $match: query },
      { $group: {
          _id: '$customer.mobile',
          name: { $first: '$customer.name' },
          totalBills: { $sum: 1 },
          totalPurchase: { $sum: '$grandTotal' },
          firstPurchase: { $min: '$billDate' },
          lastPurchase: { $max: '$billDate' },
          averageBillValue: { $avg: '$grandTotal' },
          exchangeCount: {
            $sum: { $cond: [{ $eq: ['$exchangeDetails.hasExchange', true] }, 1, 0] }
          }
        }
      },
      { $match: { totalPurchase: { $gte: parseFloat(minPurchase) } } },
      { $sort: { totalPurchase: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Calculate customer segments
    const segments = {
      premium: { count: 0, total: 0 },
      regular: { count: 0, total: 0 },
      new: { count: 0, total: 0 }
    };

    customerData.forEach(customer => {
      const avg = customer.averageBillValue;
      if (avg > 50000) {
        segments.premium.count++;
        segments.premium.total += customer.totalPurchase;
      } else if (customer.totalBills > 1) {
        segments.regular.count++;
        segments.regular.total += customer.totalPurchase;
      } else {
        segments.new.count++;
        segments.new.total += customer.totalPurchase;
      }
    });

    res.json({
      success: true,
      customers: customerData,
      segments,
      totalCustomers: customerData.length
    });

  } catch (error) {
    console.error('Customer report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getStockReport = async (req, res) => {
  try {
    const { lowStockOnly = false } = req.query;

    // In a real application, you would query your Item model
    // This is a simplified version
    const items = [
      {
        code: 'G-RING-001',
        name: 'Gold Ring 22K',
        category: 'Ring',
        metalType: 'Gold',
        stock: 15,
        reorderLevel: 10,
        lastSold: '2024-01-15'
      },
      {
        code: 'S-CHAIN-001',
        name: 'Silver Chain',
        category: 'Chain',
        metalType: 'Silver',
        stock: 5,
        reorderLevel: 10,
        lastSold: '2024-01-20'
      },
      {
        code: 'D-EAR-001',
        name: 'Diamond Earring',
        category: 'Earring',
        metalType: 'Diamond',
        stock: 8,
        reorderLevel: 5,
        lastSold: '2024-01-18'
      }
    ];

    const filteredItems = lowStockOnly ? 
      items.filter(item => item.stock <= item.reorderLevel) : 
      items;

    const summary = {
      totalItems: filteredItems.length,
      lowStockItems: filteredItems.filter(item => item.stock <= item.reorderLevel).length,
      outOfStockItems: filteredItems.filter(item => item.stock === 0).length,
      metalWiseStock: {}
    };

    filteredItems.forEach(item => {
      if (!summary.metalWiseStock[item.metalType]) {
        summary.metalWiseStock[item.metalType] = {
          count: 0,
          totalStock: 0
        };
      }
      summary.metalWiseStock[item.metalType].count++;
      summary.metalWiseStock[item.metalType].totalStock += item.stock;
    });

    res.json({
      success: true,
      items: filteredItems,
      summary
    });

  } catch (error) {
    console.error('Stock report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

exports.getGSTReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    
    const targetMonth = month || moment().month() + 1;
    const targetYear = year || moment().year();

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const bills = await Bill.find({
      billDate: { $gte: startDate, $lte: endDate },
      isActive: true
    }).lean();

    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalGST = 0;

    bills.forEach(bill => {
      const taxableValue = bill.subTotal - bill.discount;
      const gst = bill.gst;
      
      totalTaxableValue += taxableValue;
      totalGST += gst;
      
      // Assuming equal CGST and SGST for intra-state (Bihar)
      totalCGST += gst / 2;
      totalSGST += gst / 2;
    });

    const report = {
      period: `${targetMonth}/${targetYear}`,
      totalBills: bills.length,
      totalTaxableValue,
      gstBreakdown: {
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        total: totalGST
      },
      bills: bills.map(bill => ({
        billNumber: bill.billNumber,
        date: bill.billDate,
        taxableValue: bill.subTotal - bill.discount,
        gst: bill.gst,
        total: bill.grandTotal
      }))
    };

    res.json({
      success: true,
      report
    });

  } catch (error) {
    console.error('GST report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

async function generateExcelReport(res, data, summary, startDate, endDate) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add headers
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Bills', key: 'bills', width: 10 },
      { header: 'Sales (₹)', key: 'sales', width: 15 },
      { header: 'Items', key: 'items', width: 10 },
      { header: 'Gold Sales', key: 'gold', width: 15 },
      { header: 'Silver Sales', key: 'silver', width: 15 },
      { header: 'Diamond Sales', key: 'diamond', width: 15 },
      { header: 'Cash', key: 'cash', width: 15 },
      { header: 'Card', key: 'card', width: 15 },
      { header: 'UPI', key: 'upi', width: 15 }
    ];

    // Add data
    data.forEach(day => {
      worksheet.addRow({
        date: day.date,
        bills: day.totalBills,
        sales: day.totalSales,
        items: day.totalItems,
        gold: day.metalWise.Gold?.amount || 0,
        silver: day.metalWise.Silver?.amount || 0,
        diamond: day.metalWise.Diamond?.amount || 0,
        cash: day.paymentMode.cash || 0,
        card: day.paymentMode.card || 0,
        upi: day.paymentMode.upi || 0
      });
    });

    // Add summary
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.addRow(['Total Bills', summary.totalPeriodBills]);
    worksheet.addRow(['Total Sales', summary.totalPeriodSales]);
    worksheet.addRow(['Average Daily Sales', summary.averageDailySales]);
    if (summary.highestSaleDay) {
      worksheet.addRow(['Highest Sale Day', summary.highestSaleDay.date, summary.highestSaleDay.totalSales]);
    }

    // Set response headers for Excel file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${moment().format('YYYY-MM-DD')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel generation error:', error);
    throw error;
  }
}
