const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const path = require('path');
require('dotenv').config({ path: './config.env' });

const connectDB = require('./config/database');
const { logger } = require('./utils/logger');
const socketService = require('./services/socketService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const schoolRoutes = require('./routes/schools');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const classRoutes = require('./routes/classes');
const reportRoutes = require('./routes/reports');
const incidentRoutes = require('./routes/incidents');
const availabilityRoutes = require('./routes/availability');
const meetingRoutes = require('./routes/meetings');
const reportTemplateRoutes = require('./routes/reportTemplates');
const billingRoutes = require('./routes/billing');
const expenseRoutes = require('./routes/expenses');
const superAdminRoutes = require('./routes/superAdmin');
const aiRoutes = require('./routes/ai');
const communicationRoutes = require('./routes/communication');
const eventRoutes = require('./routes/events');
const parentGroupRoutes = require('./routes/parentGroups');
const messageRoutes = require('./routes/messages');

// Import reminder scheduler
const { initializeReminderScheduler, initializePDFCleanup, initializeScheduledMessageProcessor, initializeDueReportChecker } = require('./services/reminderScheduler');
const { initializeMeetingReminderScheduler } = require('./services/meetingReminderScheduler');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Trust Nginx reverse proxy (required for correct IP detection with express-rate-limit)
app.set('trust proxy', 1);

// Initialize Socket.io
socketService.initialize(server);

// Debug port configuration
console.log('🔧 Environment variables:');
console.log('  PORT:', process.env.PORT);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  Final PORT:', PORT);

// Connect to MongoDB
connectDB();

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for development
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'development' ? 1000 : 100), // More lenient in development
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' && req.ip === '::1' || req.ip === '127.0.0.1', // Skip rate limit for localhost in dev
});

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: () => 500 // begin adding 500ms of delay per request above 50
});

app.use('/api/', limiter);
app.use('/api/', speedLimiter);

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Root endpoint for testing
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Barrana AI School Management API',
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/parent-groups', parentGroupRoutes);
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/notification-logs', require('./routes/notificationLogs'));
app.use('/api/parents', require('./routes/parents'));
app.use('/api/messages', messageRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Barrana.ai Backend Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  logger.info(`🌐 Server listening on 0.0.0.0:${PORT}`);
  logger.info(`💬 Socket.io ready for real-time messaging`);
  
  // Initialize reminder scheduler
  initializeReminderScheduler();
  
  // Initialize PDF cleanup scheduler
  initializePDFCleanup();
  
  // Initialize scheduled message processor
  initializeScheduledMessageProcessor();
  
  // Initialize due report checker
  initializeDueReportChecker();

  // Initialize parent-teacher meeting reminders (24h + 1h)
  initializeMeetingReminderScheduler();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app; 