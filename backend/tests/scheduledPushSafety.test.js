const test = require('node:test');
const assert = require('node:assert/strict');
const { processScheduledMessages, sendDueReportPush } = require('../services/reminderScheduler');

function loggerHarness() {
  const entries = [];
  return {
    entries,
    logger: {
      info(message, metadata) { entries.push(['info', message, metadata]); },
      warn(message, metadata) { entries.push(['warn', message, metadata]); },
      error(message, metadata) { entries.push(['error', message, metadata]); }
    }
  };
}

function scheduledMessage(id) {
  const conversation = { _id: `conversation-${id}`, async updateLastMessage() {}, async incrementUnread() {} };
  return {
    _id: id, conversationId: conversation, senderId: { _id: `sender-${id}` }, senderName: 'Sender',
    senderRole: 'school_admin', recipientId: { _id: `recipient-${id}` }, recipientRole: 'parent',
    isScheduled: true, sentAt: null, async save() {}, toObject() { return { _id: id }; }
  };
}

for (const scenario of [
  { name: 'accepted', result: { success: true, successCount: 2, failureCount: 0 }, expected: 'accepted', level: 'info' },
  { name: 'partial', result: { success: true, successCount: 1, failureCount: 1, error: 'PRIVATE_PROVIDER_DETAIL' }, expected: 'partial', level: 'warn' },
  { name: 'batch failure', result: { success: true, successCount: 0, failureCount: 2, error: 'PRIVATE_PROVIDER_DETAIL' }, expected: 'failed', level: 'warn' },
  { name: 'failed', result: { success: false, error: 'PRIVATE_PROVIDER_DETAIL' }, expected: 'failed', level: 'warn' },
  { name: 'unavailable', result: { success: false, reason: 'firebase_not_initialized' }, expected: 'skipped', level: 'warn' },
  { name: 'invalid', result: undefined, expected: 'failed', level: 'warn' }
]) test(`scheduled-message push logs ${scenario.name} result accurately`, async () => {
  const h = loggerHarness();
  const recipient = { notifications: [], async save() {} };
  await processScheduledMessages({
    scheduledMessages: [scheduledMessage(scenario.name)],
    authorizeScheduledMessageDelivery: async () => true,
    findRecipient: async () => recipient,
    sendPush: async () => scenario.result,
    socketService: { getIO: () => null },
    logger: h.logger
  });
  const entry = h.entries.find(([, message]) => message.startsWith('Scheduled message push notification'));
  assert.ok(entry);
  assert.equal(entry[0], scenario.level);
  assert.equal(entry[2].status, scenario.expected);
  assert.doesNotMatch(JSON.stringify(h.entries), /PRIVATE_PROVIDER_DETAIL/);
});

for (const scenario of [
  { name: 'complete success', provider: { success: true, successCount: 2, failureCount: 0 }, expected: 'accepted' },
  { name: 'partial success', provider: { success: true, successCount: 1, failureCount: 1 }, expected: 'partial' },
  { name: 'complete batch failure', provider: { success: true, successCount: 0, failureCount: 2 }, expected: 'failed' },
  { name: 'invalid result', provider: undefined, expected: 'failed' }
]) test(`due-report push classifies ${scenario.name}`, async () => {
  const h = loggerHarness(); let sent = 0; let readinessChecks = 0;
  const result = await sendDueReportPush({ fcmTokens: [{ token: 'synthetic-token' }] }, {}, {}, {
    logger: h.logger,
    firebase: {
      isFirebaseInitialized() { readinessChecks += 1; return true; },
      async sendNotificationToUser() { sent += 1; return scenario.provider; }
    }
  });
  assert.equal(readinessChecks, 1);
  assert.equal(sent, 1);
  assert.equal(result.status, scenario.expected);
  assert.doesNotMatch(JSON.stringify(h.entries), /synthetic-token|PRIVATE_PROVIDER_DETAIL/);
});

test('due-report push skips safely when Firebase credentials are unavailable', async () => {
  const h = loggerHarness(); let sent = 0;
  const result = await sendDueReportPush({ fcmTokens: [{ token: 'synthetic-token' }] }, {}, {}, {
    logger: h.logger,
    firebase: { isFirebaseInitialized: () => false, async sendNotificationToUser() { sent += 1; } }
  });
  assert.equal(sent, 0);
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'firebase_not_initialized');
});

test('due-report push records failed results without logging provider details', async () => {
  const h = loggerHarness();
  const result = await sendDueReportPush({ fcmTokens: [{ token: 'synthetic-token' }] }, {}, {}, {
    logger: h.logger,
    firebase: {
      isFirebaseInitialized: () => true,
      async sendNotificationToUser() { return { success: false, error: 'PRIVATE_PROVIDER_DETAIL' }; }
    }
  });
  assert.equal(result.status, 'failed');
  assert.doesNotMatch(JSON.stringify(h.entries), /PRIVATE_PROVIDER_DETAIL|synthetic-token/);
});

test('due-report push records thrown provider errors without private details', async () => {
  const h = loggerHarness();
  const result = await sendDueReportPush({ fcmTokens: [{ token: 'PRIVATE_TOKEN' }] }, {}, {}, {
    logger: h.logger,
    firebase: {
      isFirebaseInitialized: () => true,
      async sendNotificationToUser() {
        throw Object.assign(new Error('PRIVATE_MESSAGE'), { name: 'PRIVATE_NAME', code: 'PRIVATE_CODE' });
      }
    }
  });
  assert.equal(result.status, 'failed');
  assert.doesNotMatch(JSON.stringify(h.entries), /PRIVATE_(?:TOKEN|MESSAGE|NAME|CODE)/);
});
