const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Fix any existing indexes before initialization
    await fixDatabaseIndexes();
    
    // Initialize admin user if not exists
    await initializeAdmin();
    
    // Initialize default rates if not exists
    await initializeRates();
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const fixDatabaseIndexes = async () => {
  try {
    const User = require('../models/User');
    
    // Get all indexes on users collection
    const indexes = await User.collection.indexes();
    console.log('Current indexes on users collection:', indexes.map(idx => idx.name));
    
    // Drop any problematic userId index if it exists
    if (indexes.some(idx => idx.name === 'userId_1')) {
      await User.collection.dropIndex('userId_1');
      console.log('Dropped problematic userId_1 index');
    }
  } catch (error) {
    console.log('Index fix completed (some indexes may not exist):', error.message);
  }
};

const initializeAdmin = async () => {
  const User = require('../models/User');
  const bcrypt = require('bcryptjs');
  
  try {
    const adminExists = await User.findOne({ username: process.env.ADMIN_USERNAME });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
      
      await User.create({
        username: process.env.ADMIN_USERNAME,
        password: hashedPassword,
        role: 'admin',
        shopName: 'Shri Mahakaleshwar Jewellers',
        address: 'Anisabad, Patna, Bihar',
        gstin: '10AABCU9603R1Z1',
        phone: '0612-XXXXXX',
        email: 'mahakaleshwarjewellers@gmail.com'
      });
      
      console.log('Default admin user created');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error initializing admin:', error.message);
    // Don't crash if admin already exists or there's a minor issue
  }
};

const initializeRates = async () => {
  const Rate = require('../models/Rate');
  
  try {
    const ratesExist = await Rate.findOne();
    
    if (!ratesExist) {
      await Rate.create({
        gold24K: 6000000, // ₹60,000 per 10g = ₹6,000,000 per kg
        gold22K: 5500000,
        gold18K: 4500000,
        silver999: 75000, // ₹75 per g = ₹75,000 per kg
        silver925: 69375,
        lastUpdated: new Date()
      });
      
      console.log('Default rates initialized');
    } else {
      console.log('Rates already exist');
    }
  } catch (error) {
    console.error('Error initializing rates:', error.message);
  }
};

module.exports = connectDB;
