// Vercel Serverless API Handler
// This adapts our Express backend for Vercel's serverless functions

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import our existing routes
const authRoutes = require('../backend/routes/auth');
const userRoutes = require('../backend/routes/users');
const schoolRoutes = require('../backend/routes/schools');
const studentRoutes = require('../backend/routes/students');
const teacherRoutes = require('../backend/routes/teachers');
const classRoutes = require('../backend/routes/classes');
const reportRoutes = require('../backend/routes/reports');
const reportTemplateRoutes = require('../backend/routes/reportTemplates');
const aiRoutes = require('../backend/routes/ai');
const communicationRoutes = require('../backend/routes/communication');

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-app.vercel.app',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '1.0.0'
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
app.use('/api/report-templates', reportTemplateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/communication', communicationRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Export for Vercel
module.exports = app;
