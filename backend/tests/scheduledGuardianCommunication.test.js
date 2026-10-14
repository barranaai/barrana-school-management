const test = require('node:test');
const assert = require('node:assert/strict');
const { processScheduledMessages } = require('../services/reminderScheduler');

function scheduledMessage(id) {
  const conversation = {
    _id: `conversation-${id}`,
    async updateLastMessage() {},
    async incrementUnread() {}
  };
  return {
    _id: id,
    conversationId: conversation,
    senderId: { _id: `sender-${id}` },
    senderName: 'School Admin',
    senderRole: 'school_admin',
    recipientId: { _id: `guardian-${id}` },
    recipientRole: 'parent',
    isScheduled: true,
    sentAt: null,
    saves: 0,
    async save() { this.saves += 1; },
    toObject() { return { _id: this._id }; }
  };
}

test('scheduled guardian messages are authorized and processed independently', async () => {
  const blocked = scheduledMessage('blocked');
  const permitted = scheduledMessage('permitted');
  const recipient = { notifications: [], saves: 0, async save() { this.saves += 1; } };
  let pushes = 0;

  await processScheduledMessages({
    scheduledMessages: [blocked, permitted],
    authorizeScheduledMessageDelivery: async message => {
      if (message._id !== 'blocked') return true;
      message.isScheduled = false;
      message.deliveryBlockReason = 'guardian_communication_not_authorized';
      await message.save();
      return false;
    },
    findRecipient: async () => recipient,
    sendPush: async () => { pushes += 1; },
    socketService: { getIO: () => null }
  });

  assert.equal(blocked.sentAt, null);
  assert.equal(blocked.deliveryBlockReason, 'guardian_communication_not_authorized');
  assert.equal(blocked.saves, 1);
  assert.ok(permitted.sentAt instanceof Date);
  assert.equal(permitted.isScheduled, false);
  assert.equal(permitted.saves, 1);
  assert.equal(recipient.notifications.length, 1);
  assert.equal(recipient.saves, 1);
  assert.equal(pushes, 1);
});
