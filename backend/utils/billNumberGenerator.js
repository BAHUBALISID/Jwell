const Bill = require('../models/Bill');
const moment = require('moment');

const generateBillNumber = async () => {
  const today = moment().format('YYYYMMDD');
  const prefix = `SMJ-${today}-`;
  
  try {
    // Find the last bill number for today
    const lastBill = await Bill.findOne({
      billNumber: { $regex: `^${prefix}` }
    }).sort({ billNumber: -1 });
    
    let sequence = 1;
    
    if (lastBill && lastBill.billNumber) {
      const lastSequence = parseInt(lastBill.billNumber.split('-')[2]);
      if (!isNaN(lastSequence)) {
        sequence = lastSequence + 1;
      }
    }
    
    // Format sequence as 4-digit number
    const sequenceStr = sequence.toString().padStart(4, '0');
    return `${prefix}${sequenceStr}`;
    
  } catch (error) {
    console.error('Error generating bill number:', error);
    // Fallback to timestamp-based number
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${timestamp}`;
  }
};

module.exports = { generateBillNumber };
