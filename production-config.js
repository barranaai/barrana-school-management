// Production Configuration for Barrana.ai School Management System
module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 5051,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'production',
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true
    }
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/barrana-ai',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  // Email Configuration
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || 'your-email@gmail.com',
      pass: process.env.SMTP_PASS || 'your-app-password'
    }
  },

  // AI Services Configuration
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
      model: process.env.OPENAI_MODEL || 'gpt-4',
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 2000
    },
    googleSpeech: {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id',
      keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE || './google-credentials.json'
    }
  },

  // AWS Configuration
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'your-access-key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-key',
    region: process.env.AWS_REGION || 'us-east-1',
    s3: {
      bucket: process.env.AWS_S3_BUCKET || 'barrana-ai-uploads',
      folder: process.env.AWS_S3_FOLDER || 'uploads'
    }
  },

  // Stripe Configuration
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || 'your-stripe-secret-key',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'your-stripe-publishable-key',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'your-webhook-secret'
  },

  // Security Configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    slowDown: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      delayAfter: parseInt(process.env.SLOW_DOWN_DELAY_AFTER) || 5,
      delayMs: parseInt(process.env.SLOW_DOWN_DELAY_MS) || 500
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      error: './logs/error.log',
      combined: './logs/combined.log'
    },
    console: process.env.LOG_CONSOLE !== 'false'
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'audio/wav',
      'audio/mp3',
      'audio/m4a',
      'audio/webm',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf'
    ],
    tempDir: './uploads/temp',
    uploadDir: './uploads'
  },

  // Redis Configuration (for caching and sessions)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0
  },

  // Monitoring Configuration
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    sentry: {
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.NODE_ENV || 'production'
    },
    newRelic: {
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY || '',
      appName: process.env.NEW_RELIC_APP_NAME || 'Barrana AI School Management'
    }
  },

  // Feature Flags
  features: {
    voiceRecording: process.env.FEATURE_VOICE_RECORDING !== 'false',
    aiReports: process.env.FEATURE_AI_REPORTS !== 'false',
    realtimeUpdates: process.env.FEATURE_REALTIME !== 'false',
    advancedAnalytics: process.env.FEATURE_ANALYTICS !== 'false',
    emailNotifications: process.env.FEATURE_EMAIL !== 'false',
    fileUpload: process.env.FEATURE_FILE_UPLOAD !== 'false'
  },

  // Business Configuration
  business: {
    schoolName: process.env.SCHOOL_NAME || 'Barrana.ai School',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@barrana.ai',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@barrana.ai',
    maxStudentsPerSchool: parseInt(process.env.MAX_STUDENTS_PER_SCHOOL) || 1000,
    maxTeachersPerSchool: parseInt(process.env.MAX_TEACHERS_PER_SCHOOL) || 100,
    maxReportsPerMonth: parseInt(process.env.MAX_REPORTS_PER_MONTH) || 10000
  }
}; 