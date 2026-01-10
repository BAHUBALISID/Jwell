const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: true,
    trim: true
  },
  metalType: {
    type: String,
    required: true,
    enum: ['Gold', 'Silver', 'Diamond', 'Platinum', 'Antique / Polki', 'Others']
  },
  purity: {
    type: String,
    required: true
  },
  // NEW: Unit field
  unit: {
    type: String,
    enum: ['PCS', 'GM'],
    default: 'GM'
  },
  // NEW: Quantity field
  quantity: {
    type: Number,
    default: 1
  },
  // NEW: Gross Weight field
  grossWeight: {
    type: Number,
    default: 0
  },
  // NEW: Less Weight field
  lessWeight: {
    type: Number,
    default: 0
  },
  // UPDATED: Weight becomes Net Weight
  weight: {
    type: Number,
    required: true
  },
  rate: {
    type: Number,
    required: true
  },
  // UPDATED: Making Charge Type
  makingChargesType: {
    type: String,
    enum: ['percentage', 'fixed', 'GRM'],
    default: 'percentage'
  },
  makingCharges: {
    type: Number,
    required: true
  },
  // NEW: Discount on Making
  makingChargesDiscount: {
    type: Number,
    default: 0
  },
  makingChargesAmount: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  image: {
    type: String
  },
  // NEW: HUID / Hallmark ID
  huid: {
    type: String
  },
  // NEW: Tunch (Purity Touch)
  tunch: {
    type: String
  },
  isExchangeItem: {
    type: Boolean,
    default: false
  },
  exchangeDetails: {
    oldItemWeight: Number,
    oldItemRate: Number,
    wastageDeduction: Number,
    meltingCharges: Number,
    netValue: Number
  }
});

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  customer: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    mobile: {
      type: String,
      required: true
    },
    address: {
      type: String,
      required: true
    },
    dob: {
      type: Date
    },
    pan: {
      type: String
    },
    aadhaar: {
      type: String
    }
  },
  items: [itemSchema],
  subTotal: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  gst: {
    type: Number,
    required: true
  },
  // FIXED: Add comprehensive gstDetails schema
  gstDetails: {
    metalAmount: {
      type: Number,
      required: true
    },
    makingCharges: {
      type: Number,
      required: true
    },
    gstOnMetal: {
      type: Number,
      required: true
    },
    gstOnMaking: {
      type: Number,
      required: true
    },
    isIntraState: {
      type: Boolean,
      default: true
    },
    gstOnMetalRate: Number,
    gstOnMakingRate: Number,
    // Intra-state specific
    cgstOnMetal: Number,
    sgstOnMetal: Number,
    cgstOnMaking: Number,
    sgstOnMaking: Number,
    totalCGST: Number,
    totalSGST: Number,
    // Inter-state specific
    igstOnMetal: Number,
    igstOnMaking: Number,
    totalIGST: Number
  },
  grandTotal: {
    type: Number,
    required: true
  },
  amountInWords: {
    type: String,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'credit'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial'],
    default: 'paid'
  },
  exchangeDetails: {
    hasExchange: {
      type: Boolean,
      default: false
    },
    oldItemsTotal: {
      type: Number,
      default: 0
    },
    newItemsTotal: {
      type: Number,
      default: 0
    },
    balancePayable: {
      type: Number,
      default: 0
    },
    balanceRefundable: {
      type: Number,
      default: 0
    }
  },
  qrCodes: {
    billQR: String,
    itemProofQR: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isIntraState: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
billSchema.index({ billNumber: 1 });
billSchema.index({ 'customer.mobile': 1 });
billSchema.index({ billDate: -1 });
billSchema.index({ 'customer.name': 'text' });
billSchema.index({ 'items.metalType': 1 });
billSchema.index({ createdBy: 1 });

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;
