const test = require('node:test');
const assert = require('node:assert/strict');

const { Writable } = require('node:stream');
const winston = require('winston');
const { protectLoggerArguments, sanitizeFormat } = require('../utils/logger');
const { sendNotification, sendMultipleNotifications } = require('../services/firebaseService');
const { generatePDF, deletePDF, logPdfLogoFailure } = require('../services/pdfService');
const { logMeetingReminderFailure } = require('../services/meetingReminderScheduler');
const { logEventReminderStart, logDueReportTeacherFailure } = require('../services/reminderScheduler');

function loggerHarness() {
  const entries = [];
  return {
    entries,
    logger: {
      info(...args) { entries.push(['info', ...args]); },
      warn(...args) { entries.push(['warn', ...args]); },
      error(...args) { entries.push(['error', ...args]); }
    }
  };
}

function productionLoggerHarness() {
  const output = [];
  const logger = protectLoggerArguments(winston.createLogger({
    format: winston.format.combine(sanitizeFormat(), winston.format.json()),
    transports: [new winston.transports.Stream({
      stream: new Writable({ write(chunk, _encoding, callback) { output.push(String(chunk)); callback(); } })
    })]
  }));
  return { logger, output };
}

function firebaseResponse(successCount, failureCount) {
  return {
    successCount,
    failureCount,
    responses: Array.from({ length: successCount + failureCount }, (_, index) => ({
      success: index < successCount,
      ...(index >= successCount && { error: { code: 'synthetic-provider-failure' } })
    }))
  };
}

for (const scenario of [
  { name: 'complete success', response: firebaseResponse(2, 0), expected: 'accepted', success: true },
  { name: 'partial delivery', response: firebaseResponse(1, 1), expected: 'partial', success: true },
  { name: 'total failure', response: firebaseResponse(0, 2), expected: 'failed', success: false }
]) test(`real Firebase batch function logs ${scenario.name} accurately`, async () => {
  const h = loggerHarness();
  const result = await sendMultipleNotifications(
    ['PRIVATE_TOKEN_ONE', 'PRIVATE_TOKEN_TWO'],
    { title: 'Synthetic', body: 'Synthetic' },
    {},
    {
      firebaseApp: {},
      logger: h.logger,
      messaging: { async sendEachForMulticast() { return scenario.response; } }
    }
  );
  const entry = h.entries.find(([, message]) => message.startsWith('Batch push delivery'));
  assert.ok(entry);
  assert.equal(entry[2].status, scenario.expected);
  assert.equal(result.success, scenario.success);
  assert.doesNotMatch(JSON.stringify(h.entries), /PRIVATE_TOKEN|synthetic-provider-failure/);
});

test('real Firebase batch function rejects invalid and thrown provider results safely', async () => {
  for (const sendEachForMulticast of [
    async () => ({ successCount: 1, responses: [] }),
    async () => ({ successCount: 2, failureCount: 0, responses: [] }),
    async () => ({ successCount: 0.5, failureCount: 0.5, responses: [{ success: true }] }),
    async () => { throw Object.assign(new Error('PRIVATE_PROVIDER_MESSAGE'), { code: 'PRIVATE_PROVIDER_CODE' }); }
  ]) {
    const h = loggerHarness();
    const result = await sendMultipleNotifications(['PRIVATE_TOKEN'], {}, {}, {
      firebaseApp: {}, logger: h.logger, messaging: { sendEachForMulticast }
    });
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(h.entries), /PRIVATE_(?:TOKEN|PROVIDER)/);
    assert.equal(h.entries.some(([, message]) => message.includes('accepted')), false);
  }
});

test('PDF logo failure logger emits only a fixed application category', () => {
  const h = loggerHarness();
  logPdfLogoFailure(Object.assign(new Error('PRIVATE_PDF_MESSAGE'), {
    name: 'PRIVATE_PDF_NAME', code: 'PRIVATE_PDF_CODE', stack: 'PRIVATE_PDF_STACK'
  }), h.logger);
  const output = JSON.stringify(h.entries);
  assert.match(output, /PDF_LOGO_LOAD_FAILED/);
  assert.doesNotMatch(output, /PRIVATE_PDF/);
});

test('meeting reminder failure logger emits no meeting identifier or raw error', () => {
  const h = loggerHarness();
  logMeetingReminderFailure('Meeting reminder processing failed', Object.assign(new Error('PRIVATE_MEETING_ERROR'), {
    name: 'PRIVATE_MEETING_NAME', code: 'PRIVATE_MEETING_CODE', stack: 'PRIVATE_MEETING_STACK'
  }), 'MEETING_REMINDER_PROCESSING_FAILED', h.logger);
  const output = JSON.stringify(h.entries);
  assert.match(output, /MEETING_REMINDER_PROCESSING_FAILED/);
  assert.doesNotMatch(output, /PRIVATE_MEETING|507f1f77bcf86cd799439011/);
});

test('real single-device Firebase logging excludes notification title and provider message ID', async () => {
  const h = productionLoggerHarness();
  const result = await sendNotification('PRIVATE_DEVICE_TOKEN', {
    title: 'PRIVATE_NOTIFICATION_TITLE', body: 'PRIVATE_NOTIFICATION_BODY'
  }, {}, {
    firebaseApp: {}, logger: h.logger, messaging: { async send() { return 'PRIVATE_PROVIDER_MESSAGE_ID'; } }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(result, { success: true, messageId: 'PRIVATE_PROVIDER_MESSAGE_ID' });
  const output = h.output.join('');
  assert.match(output, /Push notification accepted/);
  assert.doesNotMatch(output, /PRIVATE_(?:DEVICE|NOTIFICATION|PROVIDER)/);
});

test('real PDF lifecycle logging excludes filenames and filesystem paths', async () => {
  const h = productionLoggerHarness();
  const page = { async setContent() {}, async pdf() {} };
  const browser = { async newPage() { return page; }, async close() {} };
  const privateFilename = 'PRIVATE_CHILD_REPORT.pdf';
  const result = await generatePDF({ html: '<p>synthetic</p>', filename: privateFilename, outputDir: 'PRIVATE_OUTPUT_PATH' }, {
    logger: h.logger,
    puppeteer: { async launch() { return browser; } },
    fs: { existsSync: () => true, statSync: () => ({ size: 321 }) }
  });
  await deletePDF('C:\\PRIVATE\\PDF\\PRIVATE_CHILD_REPORT.pdf', {
    logger: h.logger, fs: { existsSync: () => true, unlinkSync() {} }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.filename, privateFilename);
  const output = h.output.join('');
  assert.match(output, /PDF generation started/);
  assert.match(output, /PDF generated successfully/);
  assert.match(output, /PDF deleted/);
  assert.doesNotMatch(output, /PRIVATE_(?:CHILD|OUTPUT)|PRIVATE\\PDF/);
});

test('scheduler operational logging excludes event titles and teacher identifiers', async () => {
  const h = productionLoggerHarness();
  logEventReminderStart('24h', h.logger);
  logDueReportTeacherFailure(Object.assign(new Error('PRIVATE_TEACHER_ERROR'), {
    name: 'PRIVATE_TEACHER_NAME', code: 'PRIVATE_TEACHER_CODE'
  }), h.logger);
  await new Promise(resolve => setImmediate(resolve));
  const output = h.output.join('');
  assert.match(output, /Event reminder delivery started/);
  assert.match(output, /DUE_REPORT_TEACHER_PROCESSING_FAILED/);
  assert.doesNotMatch(output, /PRIVATE_(?:EVENT_TITLE|TEACHER)|507f1f77bcf86cd799439011/);
});
