const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a rotating file transport for persistent logging
const rotatingFileTransport = new winston.transports.File({
  filename: path.join(logsDir, 'app.log'),
  maxsize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5, // Keep 5 files
  tailable: true,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Create a specific transport for due date calculation debugging
const dueDateDebugTransport = new winston.transports.File({
  filename: path.join(logsDir, 'due-date-debug.log'),
  maxsize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3, // Keep 3 files
  tailable: true,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Create a specific transport for report creation debugging
const reportCreationTransport = new winston.transports.File({
  filename: path.join(logsDir, 'report-creation.log'),
  maxsize: 5 * 1024 * 1024, // 5MB
  maxFiles: 3, // Keep 3 files
  tailable: true,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Create the main logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'barrana-backend' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    rotatingFileTransport
  ]
});

// Create specialized loggers for different concerns
const dueDateLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'due-date-calculation' },
  transports: [
    dueDateDebugTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const reportCreationLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'report-creation' },
  transports: [
    reportCreationTransport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Helper functions for structured logging
const logDueDateCalculation = (operation, data) => {
  const logEntry = {
    operation,
    data,
    timestamp: new Date().toISOString(),
    calculationId: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  dueDateLogger.info('Due Date Calculation', logEntry);
  
  // Also log to console in development for easier debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 [${operation}]`, {
      timestamp: logEntry.timestamp,
      calculationId: logEntry.calculationId,
      ...data
    });
  }
};

const logReportCreation = (operation, data) => {
  reportCreationLogger.info('Report Creation', {
    operation,
    data,
    timestamp: new Date().toISOString()
  });
};

const logError = (operation, error, context = {}) => {
  logger.error('Error occurred', {
    operation,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    context,
    timestamp: new Date().toISOString()
  });
  
  // Also log to specific loggers based on operation
  if (operation.includes('due') || operation.includes('date')) {
    dueDateLogger.error('Due Date Error', {
      operation,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  if (operation.includes('report') || operation.includes('create')) {
    reportCreationLogger.error('Report Creation Error', {
      operation,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString()
    });
  }
};

// Additional specialized logging functions
const logCalculationPhase = (phase, studentId, templateId, frequency, data) => {
  logDueDateCalculation(`calculation-phase-${phase}`, {
    phase,
    studentId,
    templateId,
    frequency,
    ...data
  });
};

const logCalculationResult = (studentId, templateId, frequency, result, executionTime) => {
  logDueDateCalculation('calculation-result', {
    studentId,
    templateId,
    frequency,
    result: {
      due: result.due,
      dueDate: result.dueDate?.toISOString(),
      periodStart: result.periodStart?.toISOString(),
      calculationMethod: result.calculationMethod
    },
    performance: {
      executionTimeMs: executionTime,
      timestamp: new Date().toISOString()
    }
  });
};

const logCalculationError = (phase, studentId, templateId, frequency, error, context = {}) => {
  logError(`calculation-error-${phase}`, error, {
    phase,
    studentId,
    templateId,
    frequency,
    ...context
  });
};

const logFrequencyConfigValidation = (frequency, schoolId, config, isValid, errors = []) => {
  logDueDateCalculation('frequency-config-validation', {
    frequency,
    schoolId,
    config,
    validation: {
      isValid,
      errors
    }
  });
};

const logTimezoneConversion = (fromTimezone, toTimezone, originalDate, convertedDate) => {
  logDueDateCalculation('timezone-conversion', {
    fromTimezone,
    toTimezone,
    originalDate: originalDate?.toISOString(),
    convertedDate: convertedDate?.toISOString(),
    conversionValid: !!(originalDate && convertedDate)
  });
};

const logPeriodCalculation = (frequency, baseDate, periodStart, periodEnd, method) => {
  logDueDateCalculation('period-calculation', {
    frequency,
    baseDate: baseDate?.toISOString(),
    periodStart: periodStart?.toISOString(),
    periodEnd: periodEnd?.toISOString(),
    method
  });
};

module.exports = {
  logger,
  dueDateLogger,
  reportCreationLogger,
  logDueDateCalculation,
  logReportCreation,
  logError,
  logCalculationPhase,
  logCalculationResult,
  logCalculationError,
  logFrequencyConfigValidation,
  logTimezoneConversion,
  logPeriodCalculation
}; 