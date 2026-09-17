const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';

const auth = {
  protect(req, res, next) {
    const role = req.get('x-role');
    if (!role) return res.status(401).json({ message: 'Not authorized' });
    req.user = {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', role,
      schoolId: req.get('x-school') || (role === 'super_admin' ? undefined : schoolA),
      firstName: 'Test', lastName: 'User'
    };
    next();
  },
  authorize(...roles) {
    return (req, res, next) => roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ message: 'Access denied' });
  }
};

function loadRoute(file, stubs) {
  const resolved = require.resolve(path.join('..', 'routes', file));
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (requestName, parent, isMain) {
    if (Object.hasOwn(stubs, requestName)) return stubs[requestName];
    return original.call(this, requestName, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

function appFor(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const logger = { info() {}, error() {}, warn() {} };
const schoolDocument = overrides => ({
  _id: schoolA,
  name: 'Kidsible Organization',
  slug: 'kidsible-organization',
  schoolType: 'montessori_school',
  estimatedStudents: 20,
  address: { city: 'Test City' },
  contactPerson: { name: 'Admin', email: 'admin@example.test' },
  settings: { timezone: 'UTC', language: 'en', reportFrequencies: { Monthly: { enabled: true } } },
  branding: { primaryColor: '#123456' },
  communication: {
    whatsapp: { enabled: true, phoneNumber: '+15550000000', displayName: 'Kidsible', twilioAccountSid: 'secret-sid', twilioAuthToken: 'secret-token' },
    email: { enabled: true, fromName: 'Kidsible', fromEmail: 'noreply@example.test' },
    sms: { enabled: true, phoneNumber: '+15550000000', twilioAccountSid: 'sms-secret', twilioAuthToken: 'sms-token' }
  },
  subscription: { plan: 'enterprise', stripeCustomerId: 'cus_secret' },
  ownerUserId: 'owner-secret', onboardingStatus: 'internal', usage: { apiCalls: 99 }, notes: 'internal note',
  ...overrides,
  toObject() { const copy = { ...this }; delete copy.toObject; return copy; }
});

function schoolHarness() {
  const updates = [];
  const School = {
    findById() {
      const document = schoolDocument();
      return {
        populate: async () => document,
        then(resolve, reject) { return Promise.resolve(document).then(resolve, reject); }
      };
    },
    async findByIdAndUpdate(id, update) {
      updates.push({ id, update });
      return schoolDocument(update.$set || update);
    }
  };
  const router = loadRoute('schools.js', {
    '../models/School': School,
    '../models/User': {}, '../models/Report': {},
    '../middleware/auth': auth,
    '../utils/logger': { logger },
    bcryptjs: { hash: async () => 'hash' },
    '../services/logoService': { upload: { single: () => (req, res, next) => next() }, uploadSchoolLogo() {}, getSchoolLogo() {}, deleteSchoolLogo() {} },
    '../services/emailService': { sendWelcomeEmail() {} }
  });
  return { app: appFor(router), updates };
}

test('school admin update allowlist preserves legitimate fields and rejects sensitive overposting', async () => {
  const h = schoolHarness();
  const response = await request(h.app).put(`/${schoolA}`).set('x-role', 'school_admin').send({
    name: 'Renamed Organization', address: { city: 'New City' },
    subscription: { plan: 'enterprise' }, ownerUserId: 'attacker', notes: 'changed',
    onboardingStatus: 'complete', usage: { apiCalls: 0 }, communication: { whatsapp: { twilioAuthToken: 'leak' } }
  });
  assert.equal(response.status, 200);
  assert.deepEqual(h.updates[0].update.$set, { name: 'Renamed Organization', address: { city: 'New City' } });
  assert.equal(response.body.data.name, 'Renamed Organization');
  for (const key of ['subscription', 'ownerUserId', 'notes', 'onboardingStatus', 'usage']) assert.equal(response.body.data[key], undefined);
});

test('organization and teacher school responses omit credentials and platform metadata', async () => {
  for (const role of ['school_admin', 'teacher']) {
    const response = await request(schoolHarness().app).get(`/${schoolA}`).set('x-role', role);
    assert.equal(response.status, 200);
    const json = JSON.stringify(response.body);
    for (const secret of ['secret-sid', 'secret-token', 'cus_secret', 'internal note', 'owner-secret']) assert.equal(json.includes(secret), false);
    assert.equal(response.body.data.subscription, undefined);
  }
});

test('super admin school response and update capability remain available', async () => {
  const h = schoolHarness();
  const read = await request(h.app).get(`/${schoolA}`).set('x-role', 'super_admin');
  assert.equal(read.status, 200); assert.equal(read.body.data.subscription.plan, 'enterprise');
  const update = await request(h.app).put(`/${schoolA}`).set('x-role', 'super_admin').send({ subscription: { plan: 'premium' } });
  assert.equal(update.status, 200); assert.equal(h.updates[0].update.$set.subscription.plan, 'premium');
});

test('school admin communication update cannot change or receive provider credentials', async () => {
  const h = schoolHarness();
  const response = await request(h.app).put(`/${schoolA}/communication`).set('x-role', 'school_admin').send({
    whatsapp: { enabled: false, displayName: 'Updated', twilioAccountSid: 'replacement', twilioAuthToken: 'replacement' },
    sms: { enabled: false, twilioAccountSid: 'replacement', twilioAuthToken: 'replacement' }
  });
  assert.equal(response.status, 200);
  assert.deepEqual(h.updates[0].update.$set, {
    'communication.whatsapp.enabled': false,
    'communication.whatsapp.displayName': 'Updated',
    'communication.sms.enabled': false
  });
  assert.equal(JSON.stringify(response.body).includes('secret'), false);
  assert.equal(JSON.stringify(response.body).includes('replacement'), false);
});

function messagesHarness({ crossTenantRecipient = false, crossTenantStudent = false } = {}) {
  let conversationWrites = 0; let messageWrites = 0;
  const recipient = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', firstName: 'Parent', lastName: 'User', role: 'parent', schoolId: schoolA };
  const student = { _id: 'cccccccccccccccccccccccc', firstName: 'Child', lastName: 'User', role: 'student', schoolId: schoolA };
  const User = {
    findOne(query) {
      const value = query.role === 'student' ? (crossTenantStudent ? null : student) : (crossTenantRecipient ? null : recipient);
      return { select: async () => value };
    },
    async findById() { return null; }
  };
  const conversation = {
    _id: 'dddddddddddddddddddddddd', metadata: {}, async updateLastMessage() {}, async incrementUnread() {}
  };
  const Conversation = {
    async findOne() { return null; },
    async create() { conversationWrites++; return conversation; }
  };
  const Message = { async create(data) { messageWrites++; return { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', ...data }; } };
  const router = loadRoute('messages.js', {
    '../models/Message': Message, '../models/Conversation': Conversation, '../models/User': User,
    '../middleware/auth': auth, '../utils/logger': { logger },
    '../services/firebaseService': { async sendNotificationToUser() {} }
  });
  return { app: appFor(router), writes: () => ({ conversationWrites, messageWrites }) };
}

test('conversation rejects a cross-tenant recipient before writes', async () => {
  const h = messagesHarness({ crossTenantRecipient: true });
  const response = await request(h.app).post('/conversation').set('x-role', 'school_admin').send({ recipientId: 'b', initialMessage: 'Hello' });
  assert.equal(response.status, 404); assert.deepEqual(h.writes(), { conversationWrites: 0, messageWrites: 0 });
});

test('conversation rejects a cross-tenant student before writes', async () => {
  const h = messagesHarness({ crossTenantStudent: true });
  const response = await request(h.app).post('/conversation').set('x-role', 'school_admin').send({ recipientId: 'b', studentId: 'c', initialMessage: 'Hello' });
  assert.equal(response.status, 404); assert.deepEqual(h.writes(), { conversationWrites: 0, messageWrites: 0 });
});

test('same-tenant conversation still creates its conversation and message', async () => {
  const h = messagesHarness();
  const response = await request(h.app).post('/conversation').set('x-role', 'school_admin').send({ recipientId: 'b', studentId: 'c', initialMessage: 'Hello' });
  assert.equal(response.status, 201); assert.deepEqual(h.writes(), { conversationWrites: 1, messageWrites: 1 });
});

function aiHarness(template) {
  let templateQuery;
  class OpenAI {
    constructor() { this.chat = { completions: { create: async () => ({ choices: [{ message: { content: 'Generated report' } }] }) } }; }
  }
  const ReportTemplate = { findOne(query) { templateQuery = query; return Promise.resolve(template); } };
  const oldKey = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'synthetic-test-key';
  const router = loadRoute('ai.js', {
    openai: OpenAI, '../models/User': { async findById() { return null; } }, '../models/Report': { async findById() { return null; } },
    '../models/ReportTemplate': ReportTemplate, '../middleware/auth': auth,
    '../middleware/resourceAuthorization': { async canAccessStudent() { return true; }, canAccessReport() { return true; } },
    '../utils/logger': { logger }
  });
  if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  return { app: appFor(router), query: () => templateQuery };
}

test('AI template lookup is tenant-scoped and rejects cross-tenant templates', async () => {
  const missing = aiHarness(null);
  const rejected = await request(missing.app).post('/generate-report').set('x-role', 'school_admin').send({ templateId: 't', transcription: 'Observation', studentName: 'Child' });
  assert.equal(rejected.status, 404); assert.equal(missing.query().schoolId, schoolA);
  const valid = aiHarness({ _id: 't', schoolId: schoolA, content: 'Template' });
  const accepted = await request(valid.app).post('/generate-report').set('x-role', 'school_admin').send({ templateId: 't', transcription: 'Observation', studentName: 'Child' });
  assert.equal(accepted.status, 200); assert.equal(valid.query().schoolId, schoolA);
});

test('AI template lookup requires explicit school selection from super admin', async () => {
  const h = aiHarness({ _id: 't', schoolId: schoolB, content: 'Template' });
  const missing = await request(h.app).post('/generate-report').set('x-role', 'super_admin').send({ templateId: 't', transcription: 'Observation', studentName: 'Child' });
  assert.equal(missing.status, 400);
  const selected = await request(h.app).post('/generate-report').set('x-role', 'super_admin').send({ schoolId: schoolB, templateId: 't', transcription: 'Observation', studentName: 'Child' });
  assert.equal(selected.status, 200); assert.equal(h.query().schoolId, schoolB);
});

for (const routeFile of ['billing.js', 'superAdmin.js']) {
  test(`${routeFile} placeholder is accessible only to super admin`, async () => {
    const router = loadRoute(routeFile, { '../middleware/auth': auth });
    const app = appFor(router);
    assert.equal((await request(app).get('/')).status, 401);
    for (const role of ['school_admin', 'teacher', 'parent']) assert.equal((await request(app).get('/').set('x-role', role)).status, 403);
    assert.equal((await request(app).get('/').set('x-role', 'super_admin')).status, 200);
  });
}
