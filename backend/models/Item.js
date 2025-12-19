const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Ring', 'Chain', 'Bangle', 'Earring', 'Necklace', 'Bracelet', 'Pendant', 'Nose Pin', 'Anklet', 'Others']
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
  defaultWeight: {
    type: Number,
    min: 0
  },
  defaultMakingCharges: {
    type: Number,
    default: 10
  },
  makingChargesType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  reorderLevel: {
    type: Number,
    default: 5
  },
  image: {
    type: String
  },
  description: {
    type: String
  },
  basePrice: {
    type: Number,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp before saving
itemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Item = mongoose.model('Item', itemSchema);

module.exports = Item;
