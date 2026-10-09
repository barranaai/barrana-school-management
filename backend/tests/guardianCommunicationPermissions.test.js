const test = require('node:test');
const assert = require('node:assert/strict');
const { conversationLookup, guardianCanUseConversation, conversationCanDeliver, authorizeScheduledMessageDelivery } = require('../services/guardianCommunicationService');

const conversation = (changes = {}) => ({
  schoolId: 'school-a',
  participants: [
    { userId: 'guardian-a', role: 'parent' },
    { userId: 'admin-a', role: 'school_admin' }
  ],
  metadata: { studentId: 'child-a' },
  ...changes
});
const guardian = (changes = {}) => ({ _id: 'guardian-a', schoolId: 'school-a', role: 'parent', isActive: true, ...changes });

test('active guardian with communication permission can use and receive a child conversation', async () => {
  const authorize = async (_guardian, childId, permission) => ({ allowed: childId === 'child-a' && permission === 'communication' });
  assert.equal(await guardianCanUseConversation(guardian(), conversation(), { authorizeGuardianParticipant: authorize }), true);
  assert.equal(await conversationCanDeliver(conversation(), { findGuardian: async () => guardian(), authorizeGuardianParticipant: authorize }), true);
});

test('disabled, revoked or pending relationship blocks access and future delivery', async () => {
  for (const state of ['disabled', 'revoked', 'pending']) {
    const authorize = async () => ({ allowed: false, state });
    assert.equal(await guardianCanUseConversation(guardian(), conversation(), { authorizeGuardianParticipant: authorize }), false);
    assert.equal(await conversationCanDeliver(conversation(), { findGuardian: async () => guardian(), authorizeGuardianParticipant: authorize }), false);
  }
});

test('inactive guardian and cross-tenant guardian cannot receive child communication', async () => {
  const authorize = async () => ({ allowed: true });
  assert.equal(await conversationCanDeliver(conversation(), { findGuardian: async () => null, authorizeGuardianParticipant: authorize }), false);
  assert.equal(await conversationCanDeliver(conversation(), { findGuardian: async () => guardian({ schoolId: 'school-b' }), authorizeGuardianParticipant: authorize }), false);
});

test('the specific parent participant is resolved instead of trusting a browser recipient', async () => {
  let query;
  const findGuardian = async value => { query = value; return guardian(); };
  assert.equal(await conversationCanDeliver(conversation(), { findGuardian, authorizeGuardianParticipant: async () => ({ allowed: true }) }), true);
  assert.equal(String(query._id), 'guardian-a');
  assert.equal(query.schoolId, 'school-a');
  assert.equal(query.role, 'parent');
});

test('one guardian may use conversations for multiple authorized children independently', async () => {
  const authorize = async (_guardian, childId) => ({ allowed: childId !== 'child-b' });
  assert.equal(await guardianCanUseConversation(guardian(), conversation(), { authorizeGuardianParticipant: authorize }), true);
  assert.equal(await guardianCanUseConversation(guardian(), conversation({ metadata: { studentId: 'child-b' } }), { authorizeGuardianParticipant: authorize }), false);
});

test('conversation reuse is scoped to the selected child', () => {
  assert.equal(conversationLookup('school-a', 'admin-a', 'guardian-a', 'child-a')['metadata.studentId'], 'child-a');
  assert.equal(conversationLookup('school-a', 'admin-a', 'guardian-a', 'child-b')['metadata.studentId'], 'child-b');
  assert.deepEqual(conversationLookup('school-a', 'admin-a', 'guardian-a')['metadata.studentId'], { $exists: false });
});

test('staff and non-child conversations preserve existing access', async () => {
  assert.equal(await guardianCanUseConversation({ role: 'school_admin' }, conversation()), true);
  assert.equal(await conversationCanDeliver(conversation({ metadata: {} })), true);
});

test('scheduled delivery rechecks permission and preserves a blocked historical record', async () => {
  let saves = 0;
  const message = { conversationId: conversation(), isScheduled: true, async save() { saves += 1; } };
  assert.equal(await authorizeScheduledMessageDelivery(message, { conversationCanDeliver: async () => false }), false);
  assert.equal(message.isScheduled, false);
  assert.equal(message.deliveryBlockReason, 'guardian_communication_not_authorized');
  assert.ok(message.deliveryBlockedAt instanceof Date);
  assert.equal(saves, 1);
});
