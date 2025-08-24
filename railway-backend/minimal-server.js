const express = require('express');
require('dotenv').config();

// Test database connection
const connectDB = require('./config/database');
const { logger } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting minimal server with database...');
console.log('  PORT:', process.env.PORT);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  Final PORT:', PORT);

// Connect to MongoDB
connectDB();

// Basic middleware
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Minimal Barrana AI Server is running!',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Auth test endpoint
app.get('/api/auth/test', (req, res) => {
  res.status(200).json({
    message: 'Auth endpoint working',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Minimal Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
  
  // Test logger
  logger.info(`🚀 Minimal Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
