const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Essential imports only
const connectDB = require('./config/database');
const { logger } = require('./utils/logger');

// Import essential routes only - test one by one
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
// const schoolRoutes = require('./routes/schools');
// const studentRoutes = require('./routes/students');
// const teacherRoutes = require('./routes/teachers');
// const classRoutes = require('./routes/classes');
// const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting medium server with essential features...');
console.log('  PORT:', process.env.PORT);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  Final PORT:', PORT);

// Connect to MongoDB
connectDB();

// Essential middleware only
app.use(cors({
  origin: true, // Allow all origins for Railway
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic logging (no Morgan for now)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Barrana AI School Management API - Medium Server',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Essential API Routes only - test one by one
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// app.use('/api/schools', schoolRoutes);
// app.use('/api/students', studentRoutes);
// app.use('/api/teachers', teacherRoutes);
// app.use('/api/classes', classRoutes);
// app.use('/api/reports', reportRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Simple error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  logger.error('Server error:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Medium Server running on port ${PORT}`);
  logger.info(`🚀 Medium Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;
