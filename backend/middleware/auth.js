const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ _id: decoded.userId, isActive: true });

    if (!user) {
      throw new Error();
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Please authenticate' 
    });
  }
};

const adminOnly = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      throw new Error();
    }
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
};

const staffOrAdmin = async (req, res, next) => {
  try {
    if (req.user.role === 'viewer') {
      throw new Error();
    }
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false, 
      message: 'Staff or admin access required' 
    });
  }
};

module.exports = { auth, adminOnly, staffOrAdmin };
