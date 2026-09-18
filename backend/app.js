// No environment loading, database connection, HTTP server or workers on import.
const routeDefinitions = [
  [
    "/api/auth",
    "auth"
  ],
  [
    "/api/config",
    "configuration"
  ],
  [
    "/api/standard-packages",
    "standardPackages"
  ],
  [
    "/api/enrollments",
    "enrollments"
  ],
  [
    "/api/roadmaps",
    "roadmaps"
  ],
  [
    "/api/roadmaps",
    "plannedSessions"
  ],
  [
    "/api/planned-sessions",
    "plannedSessions"
  ],
  [
    "/api/delivered-sessions",
    "deliveredSessions"
  ],
  [
    "/api/child-participations",
    "childParticipations"
  ],
  [
    "/api/progress",
    "progress"
  ],
  [
    "/api/users",
    "users"
  ],
  [
    "/api/schools",
    "schools"
  ],
  [
    "/api/students",
    "students"
  ],
  [
    "/api/teachers",
    "teachers"
  ],
  [
    "/api/classes",
    "classes"
  ],
  [
    "/api/reports",
    "reports"
  ],
  [
    "/api/incidents",
    "incidents"
  ],
  [
    "/api/availability",
    "availability"
  ],
  [
    "/api/meetings",
    "meetings"
  ],
  [
    "/api/report-templates",
    "reportTemplates"
  ],
  [
    "/api/billing",
    "billing"
  ],
  [
    "/api/expenses",
    "expenses"
  ],
  [
    "/api/super-admin",
    "superAdmin"
  ],
  [
    "/api/ai",
    "ai"
  ],
  [
    "/api/communication",
    "communication"
  ],
  [
    "/api/events",
    "events"
  ],
  [
    "/api/parent-groups",
    "parentGroups"
  ],
  [
    "/api/whatsapp",
    "whatsapp"
  ],
  [
    "/api/notification-logs",
    "notificationLogs"
  ],
  [
    "/api/parents",
    "parents"
  ],
  [
    "/api/messages",
    "messages"
  ]
];
function createApp({ routes = routeDefinitions } = {}) {
  const express = require('express');
  const cors = require('cors');
  const helmet = require('helmet');
  const morgan = require('morgan');
  const compression = require('compression');
  const rateLimit = require('express-rate-limit');
  const slowDown = require('express-slow-down');
  const path = require('path');
  const { createCorsOptions, contentSecurityPolicy } = require('./config/security');
  const app = express();
  app.set('trust proxy', 1);
// Serve static files
app.use('/uploads/logos', express.static(path.join(__dirname, 'uploads', 'logos'), { fallthrough: false, dotfiles: 'deny' }));

// Security middleware
app.use(helmet({ contentSecurityPolicy: { directives: contentSecurityPolicy } }));

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
app.use(cors(createCorsOptions()));

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

// Route modules are lazy: importing/constructing the app performs no service startup.
  const loaders = [];
  for (const [mount, name] of routes) {
    let handler;
    const load = () => handler || (handler = require('./routes/' + name));
    loaders.push(load);
    app.use(mount, (req, res, next) => load()(req, res, next));
  }
  app.initializeRoutes = () => loaders.forEach(load => load());

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
  require('./utils/logger').logger.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});


  return app;
}
module.exports = { createApp };
