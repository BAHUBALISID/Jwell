const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'staff'],
    default: 'admin'
  },
  shopName: {
    type: String,
    default: 'Shri Mahakaleshwar Jewellers'
  },
  address: {
    type: String,
    default: 'Anisabad, Patna, Bihar'
  },
  gstin: {
    type: String,
    default: '10AABCU9603R1Z1'
  },
  phone: {
    type: String,
    default: '0612-XXXXXX'
  },
  email: {
    type: String,
    default: 'mahakaleshwarjewellers@gmail.com'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Remove any userId field that might have been causing issues
userSchema.index({ username: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
