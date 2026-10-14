const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

const schoolId = '111111111111111111111111';
const adminId = '222222222222222222222222';
const guardianId = '333333333333333333333333';

function loadRoute(stubs) {
  const resolved = require.resolve('../routes/messages');
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

function queryResult(value) {
  return { select: async () => value, populate() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => value };
}

function harness({ permitted = true } = {}) {
  const state = { conversations: 0, messages: 0 };
  const guardian = { _id: guardianId, schoolId, role: 'parent', firstName: 'Gina', lastName: 'Guardian', email: 'g@example.invalid', isActive: true };
  const conversation = {
    _id: '444444444444444444444444', schoolId, participants: [], metadata: {},
    async updateLastMessage() {}, async incrementUnread() {}
  };
  const Conversation = {
    async findOne() { return null; },
    async create(data) { state.conversations += 1; return Object.assign(conversation, data); },
    find: () => queryResult([]), async findById() { return null; }
  };
  const Message = {
    async create(data) { state.messages += 1; return { _id: '555555555555555555555555', ...data }; },
    find: () => queryResult([]), async updateMany() { return {}; }
  };
  const auth = {
    protect(req, _res, next) { req.user = { _id: adminId, schoolId, role: 'school_admin', firstName: 'Ada', lastName: 'Admin' }; next(); },
    authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
  };
  const recipients = [{ _id: guardianId, firstName: 'Gina', lastName: 'Guardian', email: guardian.email }];
  const router = loadRoute({
    '../models/Conversation': Conversation,
    '../models/Message': Message,
    '../models/User': { findOne: () => queryResult(guardian), async findById() { return null; } },
    '../middleware/auth': auth,
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_req, _res, next) => next() },
    '../services/guardianAccessService': {
      async authorizeGuardianParticipant() { return { allowed: permitted }; },
      async authorizedParticipants() { return permitted ? [{ _id: 'child-a' }] : []; }
    },
    '../services/teacherCommunicationAuthorization': { async teacherCanCommunicateWithParticipant() { return false; }, async getTeacherCommunicationRecipients() { return []; } },
    '../services/guardianCommunicationService': {
      conversationLookup: () => ({}), async userCanUseConversation() { return true; }, async conversationCanDeliver() { return true; },
      async getAdminCommunicationRecipients() { return recipients; }
    },
    '../services/firebaseService': { async sendNotificationToUser() {} },
    '../utils/logger': { logger: { info() {}, warn() {}, error() {} } }
  });
  const app = express(); app.use(express.json()); app.use(router);
  return { app, state, recipients };
}

test('administrator recipient list comes from the guardian-authorized service', async () => {
  const h = harness();
  const response = await request(h.app).get('/admin-recipients');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, h.recipients);
});

test('administrator cannot create a general message for a guardian without current communication permission', async () => {
  const h = harness({ permitted: false });
  const response = await request(h.app).post('/conversation').send({ recipientId: guardianId, initialMessage: 'School update' });
  assert.equal(response.status, 404);
  assert.deepEqual(h.state, { conversations: 0, messages: 0 });
});

test('administrator can create a general message for a currently authorized guardian', async () => {
  const h = harness();
  const response = await request(h.app).post('/conversation').send({ recipientId: guardianId, initialMessage: 'School update' });
  assert.equal(response.status, 201);
  assert.deepEqual(h.state, { conversations: 1, messages: 1 });
});
