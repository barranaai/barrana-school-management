const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();
require('./models/User');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4OGUzZThmZTk5MDA2ZTllNzE5MmJlNiIsInJvbGUiOiJ0ZWFjaGVyIiwic2Nob29sSWQiOiI2ODhlMTkzZmU5OTAwNmU5ZTcxOTI3MGQiLCJpYXQiOjE3NTQxNTk0OTR9._-_DDSp3ntGeZdTaMfsyK1-oUGnB6ZSTMsoa_gxVXRw';

async function testAuth() {
  try {
    await mongoose.connect('mongodb://localhost:27017/barrana_ai');
    
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
    
    // Test token verification
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded);
    
    // Test user lookup
    const User = mongoose.model('User');
    const user = await User.findById(decoded.id).select('-password');
    console.log('User found:', user ? {
      id: user._id,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    } : 'Not found');
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    mongoose.connection.close();
  }
}

testAuth();