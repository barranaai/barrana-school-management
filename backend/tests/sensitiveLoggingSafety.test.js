const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');

const winston = require('winston');
const { sanitizeLogData, sanitizeLogMessage, safeError, sanitizeFormat, protectLoggerArguments } = require('../utils/logger');

test('shared log sanitizer removes credentials and child or guardian identity fields', () => {
  const input = {
    operation: 'delivery',
    channel: 'email',
    password: 'synthetic-password',
    authToken: 'synthetic-token',
    childId: 'synthetic-child-id',
    parentEmail: 'guardian@example.invalid',
    nested: { transcription: 'synthetic private observation', count: 2 }
  };
  const serialized = JSON.stringify(sanitizeLogData(input));

  for (const privateValue of [
    input.password,
    input.authToken,
    input.childId,
    input.parentEmail,
    input.nested.transcription
  ]) assert.equal(serialized.includes(privateValue), false);
  assert.equal(serialized.includes('delivery'), true);
  assert.equal(serialized.includes('email'), true);
  assert.equal(serialized.includes('2'), true);
});

test('safe errors preserve a diagnostic category without raw provider text', () => {
  const result = safeError(
    Object.assign(new Error('provider response contained private material'), { code: 'PROVIDER_REJECTED' }),
    'DELIVERY_FAILED'
  );
  assert.deepEqual(result, { name: 'Error', code: 'PROVIDER_REJECTED' });
  assert.equal(JSON.stringify(result).includes('private material'), false);
});

test('interpolated log messages remove credentials, contacts, paths and connection strings', () => {
  const privateValues = [
    'guardian@example.invalid',
    '+1 555 867 5309',
    'C:\\private\\uploads\\child-recording.wav',
    'mongodb://private-user:private-password@private-host/private-db',
    'private-auth-value'
  ];
  const output = sanitizeLogMessage(
    `recipient guardian@example.invalid phone +1 555 867 5309 path C:\\private\\uploads\\child-recording.wav ` +
    `database mongodb://private-user:private-password@private-host/private-db authToken=private-auth-value`
  );
  for (const value of privateValues) assert.equal(output.includes(value), false);
  assert.equal(output.includes('[REDACTED]'), true);
});

test('Winston positional errors and structured private fields are sanitized before transport', async () => {
  const captured = [];
  const transport = new winston.transports.Stream({
    stream: new Writable({
      write(chunk, encoding, callback) {
        captured.push(String(chunk));
        callback();
      }
    })
  });
  const logger = protectLoggerArguments(winston.createLogger({
    format: winston.format.combine(sanitizeFormat(), winston.format.json()),
    transports: [transport]
  }));

  logger.error('Provider operation failed', new Error('private provider response'));
  logger.error('Upload failed', {
    error: 'private database detail',
    inputPath: 'private upload path',
    reportId: 'private report id',
    status: 'failed'
  });
  logger.info('Private record activity', {
    studentName: 'Synthetic Child Name',
    teacherName: 'Synthetic Teacher Name',
    user: 'synthetic-private-user-id',
    mediaId: 'synthetic-private-media-id',
    count: 3
  });
  logger.error('Categorized failure', {
    error: { name: 'ProviderError', code: 'SAFE_PROVIDER_CODE' },
    status: 'failed'
  });
  logger.error('Unsafe structured failure', {
    error: { name: 'ProviderError', code: 'UNSAFE_CODE', message: 'private provider body', stack: 'private stack' }
  });
  logger.error('Recipient guardian@example.invalid phone +1 555 867 5309 authToken=private-auth-value');
  await new Promise(resolve => setImmediate(resolve));

  const output = captured.join('');
  assert.equal(output.includes('private provider response'), false);
  assert.equal(output.includes('private database detail'), false);
  assert.equal(output.includes('private upload path'), false);
  assert.equal(output.includes('private report id'), false);
  assert.equal(output.includes('Synthetic Child Name'), false);
  assert.equal(output.includes('Synthetic Teacher Name'), false);
  assert.equal(output.includes('synthetic-private-user-id'), false);
  assert.equal(output.includes('synthetic-private-media-id'), false);
  assert.equal(output.includes('private provider body'), false);
  assert.equal(output.includes('private stack'), false);
  assert.equal(output.includes('guardian@example.invalid'), false);
  assert.equal(output.includes('+1 555 867 5309'), false);
  assert.equal(output.includes('private-auth-value'), false);
  assert.equal(output.includes('SAFE_PROVIDER_CODE'), true);
  assert.equal(output.includes('UNSAFE_CODE'), false);
  assert.equal(output.includes('3'), true);
  assert.equal(output.includes('failed'), true);
});

test('safe error metadata remains useful while raw errors remain private', () => {
  const safe = sanitizeLogData({ error: { name: 'ProviderError', code: 'DELIVERY_REJECTED' } });
  assert.deepEqual(safe.error, { name: 'ProviderError', code: 'DELIVERY_REJECTED' });

  const unsafe = sanitizeLogData({
    error: { name: 'ProviderError', code: 'PRIVATE_CODE', message: 'private response', token: 'private token' }
  });
  assert.equal(unsafe.error, '[REDACTED]');
  assert.equal(JSON.stringify(unsafe).includes('private response'), false);
  assert.equal(JSON.stringify(unsafe).includes('private token'), false);
});

test('sensitive backend services do not interpolate recipient or child details into logs', () => {
  const files = [
    'utils/email.js',
    'services/emailService.js',
    'services/whatsappService.js',
    'services/firebaseService.js',
    'services/notificationService.js',
    'services/notificationLogger.js',
    'services/smsService.js',
    'services/reminderScheduler.js',
    'services/dueReportsCalculator.js',
    'middleware/auth.js',
    'config/database.js'
  ];
  const unsafeLog = /logger\.(?:info|warn|error|debug)\([^\n]*(?:parentEmail|parent\.email|recipient\.email|recipient\.phone|student\.firstName|student\.lastName|mongoURI|serviceAccountPath)/;

  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.equal(unsafeLog.test(source), false, file);
  }
});

test('production routes do not place private record values directly in log messages', () => {
  const files = [
    'routes/students.js',
    'routes/teachers.js',
    'routes/parents.js',
    'routes/reports.js',
    'routes/childHistory.js',
    'routes/ai.js',
    'services/expenseOcrService.js',
    'routes/communication.js',
    'routes/messages.js',
    'routes/whatsapp.js',
    'routes/parentGroups.js',
    'routes/incidents.js',
    'routes/auth.js',
    'routes/users.js',
    'routes/schools.js',
    'routes/classes.js',
    'routes/events.js',
    'services/recurringEventService.js',
    'routes/availability.js',
    'services/logoService.js',
    'utils/dueDateCache.js'
  ];
  const privateInterpolation = /logger\.(?:info|warn|error|debug)\(`[^`]*\$\{[^}]*(?:email|phone|firstName|lastName|student|child|parent|guardian|teacherId|user\._id|reportId|conversationId|event\._id|classData\.name|schoolId|originalname|filename|scheduledDateTime)/i;
  const privateConsole = /console\.(?:log|warn|error|debug)\([^\n]*(?:error\.message|originalname|filename|filePath|uploadDir|rawText|transcription|recording|parentEmail|parentPhone)/i;

  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.equal(privateInterpolation.test(source), false, `${file} interpolates private data`);
    assert.equal(privateConsole.test(source), false, `${file} writes private data directly to console`);
  }
});

test('AI fallbacks retain safe operational signals without logging private content', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes/ai.js'), 'utf8');
  for (const category of [
    'AI_INITIALIZATION_FAILED',
    'AI_REPORT_GENERATION_FAILED',
    'AI_INSIGHTS_FAILED',
    'AI_GENERATION_FALLBACK'
  ]) assert.equal(source.includes(category), true);
  const privateAiMetadata = /logger\.(?:info|warn|error|debug)\([^,\n]+,[^\n]*(?:transcription|studentName|prompt|completion|response)\b/i;
  const privateAiInterpolation = /logger\.(?:info|warn|error|debug)\(`[^`]*\$\{[^}]*(?:transcription|studentName|prompt|completion|response)/i;
  assert.equal(privateAiMetadata.test(source), false);
  assert.equal(privateAiInterpolation.test(source), false);
});
