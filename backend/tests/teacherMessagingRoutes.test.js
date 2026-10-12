const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const ids = {
  school: '111111111111111111111111',
  otherSchool: '222222222222222222222222',
  teacher: '333333333333333333333333',
  guardian: '444444444444444444444444',
  child: '555555555555555555555555',
  conversation: '666666666666666666666666',
  message: '777777777777777777777777'
};

const logger = { info() {}, warn() {}, error() {} };

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
  return {
    select: async () => value,
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => value
  };
}

function harness(options = {}) {
  const state = { conversationWrites: 0, messageWrites: 0, messageReads: 0 };
  const teacher = { _id: ids.teacher, role: 'teacher', schoolId: ids.school, firstName: 'Tia', lastName: 'Teacher', isActive: true };
  const guardian = {
    _id: ids.guardian, role: 'parent', schoolId: options.crossTenantGuardian ? ids.otherSchool : ids.school,
    firstName: 'Gina', lastName: 'Guardian', email: 'guardian@example.invalid'
  };
  const child = { _id: ids.child, role: 'student', schoolId: ids.school, firstName: 'Casey', lastName: 'Child', isActive: true };
  const conversation = {
    _id: ids.conversation,
    schoolId: options.crossTenantConversation ? ids.otherSchool : ids.school,
    subject: 'About Casey',
    metadata: { studentId: ids.child, studentName: 'Casey Child' },
    participants: [
      { userId: ids.teacher, role: 'teacher', name: 'Tia Teacher' },
      { userId: ids.guardian, role: 'parent', name: 'Gina Guardian' }
    ],
    unreadCount: { teacher: 1, parent: 0, admin: 0 },
    isActive: true,
    async updateLastMessage() {}, async incrementUnread() {}, async resetUnread() {}, async save() {}
  };
  const leanConversation = {
    ...conversation,
    participants: [
      { userId: { _id: ids.teacher, firstName: 'Tia', lastName: 'Teacher', email: 'teacher@example.invalid' }, role: 'teacher', name: 'Tia Teacher' },
      { userId: { _id: ids.guardian, firstName: 'Gina', lastName: 'Guardian', email: guardian.email }, role: 'parent', name: 'Gina Guardian' }
    ]
  };
  const message = { _id: ids.message, conversationId: ids.conversation, senderId: ids.guardian, senderName: 'Gina Guardian', content: 'Hello' };

  const Conversation = {
    find: () => queryResult([leanConversation]),
    async findById() { return conversation; },
    async findOne() { return options.existingConversation === false ? null : conversation; },
    async create(data) { state.conversationWrites += 1; Object.assign(conversation, data); return conversation; }
  };
  const Message = {
    find() { state.messageReads += 1; return queryResult([message]); },
    async create(data) { state.messageWrites += 1; return { _id: ids.message, ...data }; },
    async updateMany() { return { modifiedCount: 1 }; }
  };
  const User = {
    findOne(query) {
      const value = query.role === 'student'
        ? (String(query.schoolId) === ids.school ? child : null)
        : (!options.crossTenantGuardian && String(query.schoolId) === ids.school ? guardian : null);
      return queryResult(value);
    },
    async findById() { return null; }
  };
  const teacherAccess = options.teacherAccess !== false;
  const conversationAccess = options.conversationAccess !== false && !options.crossTenantConversation;
  const recipients = [{ guardianId: ids.guardian, guardianName: 'Gina Guardian', participantId: ids.child, participantName: 'Casey Child' }];
  const auth = {
    protect(req, _res, next) { req.user = teacher; next(); },
    authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
  };
  const router = loadRoute({
    '../models/Conversation': Conversation,
    '../models/Message': Message,
    '../models/User': User,
    '../middleware/auth': auth,
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_req, _res, next) => next() },
    '../services/guardianAccessService': { async authorizeGuardianParticipant() { return { allowed: true }; } },
    '../services/teacherCommunicationAuthorization': {
      async teacherCanCommunicateWithParticipant() { return teacherAccess; },
      async getTeacherCommunicationRecipients() { return teacherAccess ? recipients : []; }
    },
    '../services/guardianCommunicationService': {
      conversationLookup: () => ({}),
      async userCanUseConversation() { return conversationAccess && teacherAccess; },
      async conversationCanDeliver() { return options.deliveryAccess !== false; }
    },
    '../services/firebaseService': { async sendNotificationToUser() {} },
    '../utils/logger': { logger }
  });
  const app = express(); app.use(express.json()); app.use(router);
  return { app, state };
}

test('teacher recipient list contains only server-authorized guardian and participant pairs', async () => {
  const allowed = await request(harness().app).get('/teacher-recipients');
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.body.data, [{ guardianId: ids.guardian, guardianName: 'Gina Guardian', participantId: ids.child, participantName: 'Casey Child' }]);
  const denied = await request(harness({ teacherAccess: false }).app).get('/teacher-recipients');
  assert.equal(denied.status, 200); assert.deepEqual(denied.body.data, []);
});

test('teacher reads authorized conversation history without guardian email disclosure', async () => {
  const list = await request(harness().app).get('/conversations');
  assert.equal(list.status, 200); assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].otherParticipant.name, 'Gina Guardian');
  assert.equal(list.body.data[0].otherParticipant.email, undefined);
  const history = await request(harness().app).get(`/conversation/${ids.conversation}`);
  assert.equal(history.status, 200); assert.equal(history.body.data[0].content, 'Hello');
});

test('ended authorization and cross-tenant conversations expose no teacher history or writes', async () => {
  for (const options of [{ teacherAccess: false }, { crossTenantConversation: true }]) {
    const h = harness(options);
    const history = await request(h.app).get(`/conversation/${ids.conversation}`);
    assert.equal(history.status, 404); assert.equal(h.state.messageReads, 0);
    const send = await request(h.app).post('/send').send({ conversationId: ids.conversation, content: 'Not allowed' });
    assert.equal(send.status, 404); assert.equal(h.state.messageWrites, 0);
  }
});

test('teacher can create and send only for an authorized same-organization guardian and child', async () => {
  const allowed = harness({ existingConversation: false });
  const created = await request(allowed.app).post('/conversation').send({
    recipientId: ids.guardian, studentId: ids.child, subject: 'About Casey', initialMessage: 'Hello guardian'
  });
  assert.equal(created.status, 201);
  assert.deepEqual(allowed.state, { conversationWrites: 1, messageWrites: 1, messageReads: 0 });

  for (const options of [{ teacherAccess: false }, { crossTenantGuardian: true }]) {
    const denied = harness({ ...options, existingConversation: false });
    const response = await request(denied.app).post('/conversation').send({ recipientId: ids.guardian, studentId: ids.child, initialMessage: 'Blocked' });
    assert.equal(response.status, 404);
    assert.equal(denied.state.conversationWrites, 0); assert.equal(denied.state.messageWrites, 0);
  }
});

test('authorized teacher reply writes one message and preserves the existing conversation', async () => {
  const h = harness();
  const response = await request(h.app).post('/send').send({ conversationId: ids.conversation, content: 'Reply' });
  assert.equal(response.status, 201); assert.equal(h.state.messageWrites, 1); assert.equal(h.state.conversationWrites, 0);
});
