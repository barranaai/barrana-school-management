const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting simple auth server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Basic middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Database connection status
let dbConnected = false;

// MongoDB connection (non-blocking)
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
    console.log('🔍 MongoDB URI set:', !!mongoURI);
    
    if (!mongoURI) {
      console.warn('⚠️ No MongoDB URI found, running without database');
      return;
    }
    
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    dbConnected = true;
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    dbConnected = false;
  }
};

// Start database connection (but don't wait for it)
connectDB();

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Simple Auth Server',
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    database: dbConnected ? 'connected' : 'disconnected',
    mongoState: mongoose.connection.readyState
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Simple auth test endpoint (no database required)
app.post('/api/auth/test', (req, res) => {
  const { email, password } = req.body;
  
  res.json({
    success: true,
    message: 'Auth endpoint working',
    received: {
      email: email || 'not provided',
      password: password ? 'provided' : 'not provided'
    },
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Database test endpoint
app.get('/api/auth/db-test', async (req, res) => {
  try {
    if (!dbConnected) {
      return res.json({
        success: false,
        message: 'Database not connected',
        mongoState: mongoose.connection.readyState
      });
    }
    
    // Simple database query without models
    const adminData = await mongoose.connection.db.collection('users').findOne({ role: 'super_admin' });
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    
    res.json({
      success: true,
      message: 'Database accessible',
      userCount: userCount,
      superAdminFound: !!adminData,
      superAdminEmail: adminData ? adminData.email : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database query failed',
      error: error.message
    });
  }
});

// Simple login test (direct database query)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }
    
    if (!dbConnected) {
      return res.status(500).json({
        success: false,
        message: 'Database not connected'
      });
    }
    
    // Direct database query without mongoose models
    const user = await mongoose.connection.db.collection('users').findOne({
      email: email.toLowerCase()
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // For now, just return user info (password check will be added later)
    res.json({
      success: true,
      message: 'User found in database',
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive
      },
      note: 'Password verification disabled for testing'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple Auth Server listening on 0.0.0.0:${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔍 DB Test: http://localhost:${PORT}/api/auth/db-test`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  if (dbConnected) {
    mongoose.connection.close();
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = app;
