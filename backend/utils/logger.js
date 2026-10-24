const winston = require('winston');
const path = require('path');
const fs = require('fs');

const REDACTED = '[REDACTED]';
const TRUSTED_ERROR_METADATA = Symbol('trustedErrorMetadata');
const sensitiveKey = /(?:password|passphrase|secret|token|authorization|cookie|credential|api.?key|account.?sid|phone|email|transcript|recording|report.?content|prompt|response.?body|device.?token|fcm|student.?id|child.?id|guardian.?id|parent.?id|user.?id|teacher.?id|report.?id|class.?id|conversation.?id|event.?id|school.?id|media.?id|(?:student|child|guardian|parent|teacher|participant|recipient).?name|file.?name|(?:^|_)path$|absPath|inputPath|outputPath|snippet|rawText|^user$)/i;
const errorKey = /^(?:error|err)$/i;
const safeErrorMetadata = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value[TRUSTED_ERROR_METADATA] !== true) return null;
  const keys = Object.keys(value);
  if (keys.some(key => !['name', 'code'].includes(key))) return null;
  if (typeof value.name !== 'string' || typeof value.code !== 'string') return null;
  return trustedErrorMetadata(value.code, value.name);
};

const trustedErrorMetadata = (code, name = 'Error') => {
  const metadata = {
    name: typeof name === 'string' ? name : 'Error',
    code: typeof code === 'string' ? code : 'OPERATION_FAILED'
  };
  Object.defineProperty(metadata, TRUSTED_ERROR_METADATA, { value: true });
  return metadata;
};

const sanitizeLogMessage = value => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/\S+/gi, REDACTED)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/\b(?:Bearer\s+)?eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\b(?:password|passphrase|secret|token|auth.?token|authorization|cookie|credential|api.?key|account.?sid|student.?name|child.?name|guardian.?name|parent.?name|teacher.?name|recipient.?name|participant.?name)\s*[:=]\s*[^,;|\r\n]+/gi, match => `${match.split(/[:=]/, 1)[0]}=${REDACTED}`)
    .replace(/[A-Za-z]:\\(?:[^\s<>:"|?*]+\\)*[^\s<>:"|?*]*/g, REDACTED)
    .replace(/\+?\d[\d\s().-]{7,}\d/g, REDACTED);
};

const sanitizeLogData = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return trustedErrorMetadata('OPERATION_FAILED');
  }
  if (Array.isArray(value)) return value.map(item => sanitizeLogData(item, seen));
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (errorKey.test(key)) {
      clean[key] = item instanceof Error
        ? trustedErrorMetadata('OPERATION_FAILED')
        : (safeErrorMetadata(item) || REDACTED);
    } else {
      clean[key] = sensitiveKey.test(key) ? REDACTED : sanitizeLogData(item, seen);
    }
  }
  return clean;
};

const sanitizeFormat = winston.format(info => {
  const splat = Symbol.for('splat');
  if (info[splat]) info[splat] = sanitizeLogData(info[splat]);
  const clean = sanitizeLogData(info);
  Object.keys(info).forEach(key => delete info[key]);
  Object.assign(info, clean);
  return info;
});

// Raw Error fields can be provider-controlled. Callers supply the fixed,
// application-owned category; no field is copied from the Error itself.
const safeError = (_error, fallback = 'OPERATION_FAILED') => trustedErrorMetadata(fallback);

const protectLoggerArguments = instance => {
  for (const level of ['error', 'warn', 'info', 'debug']) {
    const write = instance[level].bind(instance);
    instance[level] = (message, ...metadata) => write(
      typeof message === 'string' ? sanitizeLogMessage(message) : sanitizeLogData(message),
      ...metadata.map(value => sanitizeLogData(value))
    );
  }
  return instance;
};

// Production deployment - use console logging
// Create logs directory in development for file logging
let fileTransports = [];
if (process.env.NODE_ENV === 'development') {
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Only create file transports in development
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
    
    fileTransports.push(rotatingFileTransport);
  } catch (error) {
    console.warn('Could not create file logging; using console only');
  }
}

// Create the main logger
const logger = protectLoggerArguments(winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'barrana-backend' },
  transports: [
    // Console transport - always available
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    ...fileTransports // Add file transports only if available
  ]
}));

// Create specialized loggers for different concerns
const dueDateLogger = protectLoggerArguments(winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'due-date-calculation' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
}));

const reportCreationLogger = protectLoggerArguments(winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'report-creation' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
}));

// Helper functions for structured logging
const logDueDateCalculation = (operation, data) => {
  const logEntry = {
    operation,
    data: sanitizeLogData(data),
    timestamp: new Date().toISOString(),
    calculationId: `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };
  
  dueDateLogger.info('Due Date Calculation', logEntry);
  
  // Also log to console in development for easier debugging
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔍 [${operation}]`, {
      timestamp: logEntry.timestamp,
      calculationId: logEntry.calculationId,
      ...sanitizeLogData(data)
    });
  }
};

const logReportCreation = (operation, data) => {
  reportCreationLogger.info('Report Creation', {
    operation,
    data: sanitizeLogData(data),
    timestamp: new Date().toISOString()
  });
};

const logError = (operation, error, context = {}) => {
  logger.error('Error occurred', {
    operation,
    error: safeError(error),
    context: sanitizeLogData(context),
    timestamp: new Date().toISOString()
  });
  
  // Also log to specific loggers based on operation
  if (operation.includes('due') || operation.includes('date')) {
    dueDateLogger.error('Due Date Error', {
      operation,
      error: safeError(error),
      context: sanitizeLogData(context),
      timestamp: new Date().toISOString()
    });
  }
  
  if (operation.includes('report') || operation.includes('create')) {
    reportCreationLogger.error('Report Creation Error', {
      operation,
      error: safeError(error),
      context: sanitizeLogData(context),
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
  logPeriodCalculation,
  sanitizeLogData,
  sanitizeLogMessage,
  sanitizeFormat,
  protectLoggerArguments,
  safeError,
  trustedErrorMetadata
};
