const Bill = require('../models/Bill');
const moment = require('moment');

const generateBillNumber = async () => {
  try {
    const today = moment().format('DDMMYYYY');
    const prefix = `SMJ${today}`;
    
    // Find the last bill number for today
    const lastBill = await Bill.findOne({
      billNumber: new RegExp(`^${prefix}`)
    }).sort({ billNumber: -1 });
    
    let sequence = 1;
    if (lastBill) {
      const lastSeq = parseInt(lastBill.billNumber.slice(-3));
      sequence = lastSeq + 1;
    }
    
    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('Error generating bill number:', error);
    // Fallback to timestamp-based number
    return `SMJ${Date.now()}`;
  }
};

module.exports = { generateBillNumber };
