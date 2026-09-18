const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

test('super admin school provisioning uses a private activation link and never returns a password', async () => {
  const calls = { administrator: null, email: null, logs: [] };
  const schoolId = '111111111111111111111111';
  class School {
    constructor(data) { Object.assign(this, data, { _id: schoolId }); }
    async save() {}
    static async findOne() { return null; }
  }
  class User {
    constructor(data) {
      Object.assign(this, data, { _id: '222222222222222222222222' });
      calls.administrator = data;
    }
    generatePasswordResetToken() { return 'private-activation-token'; }
    async save() {}
    static async findByEmail() { return null; }
  }
  const auth = {
    protect(req, _res, next) { req.user = { _id: 'admin', role: 'super_admin' }; next(); },
    authorize() { return (_req, _res, next) => next(); }
  };
  const logger = {
    info: (...args) => calls.logs.push(['info', ...args]),
    warn: (...args) => calls.logs.push(['warn', ...args]),
    error: (...args) => calls.logs.push(['error', ...args])
  };
  const resolved = require.resolve('../routes/schools');
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function(name, parent, isMain) {
    const stubs = {
      '../models/School': School,
      '../models/User': User,
      '../models/Report': {},
      '../middleware/auth': auth,
      '../utils/logger': { logger },
      '../services/logoService': {
        upload: { single: () => (_req, _res, next) => next() },
        uploadSchoolLogo() {}, getSchoolLogo() {}, deleteSchoolLogo() {}
      },
      '../services/emailService': { async sendWelcomeEmail(data) { calls.email = data; } }
    };
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  let router;
  try { router = require(resolved); } finally { Module._load = original; }
  const app = express(); app.use(express.json()); app.use(router);
  const response = await request(app).post('/').send({
    name: 'Secure School', slug: 'secure-school', schoolType: 'montessori_school',
    estimatedStudents: 20, gradeLevels: ['Early Years'],
    address: { street: '1 Test St', city: 'Test City', state: 'ON', zipCode: 'A1A1A1', country: 'Canada' },
    contactPerson: { name: 'Secure Admin', email: 'secure-admin@example.test', phone: '+15550000000', role: 'Administrator' },
    subscription: { plan: 'basic' }, settings: { timezone: 'UTC' }
  });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(calls.administrator.role, 'school_admin');
  assert.equal(calls.administrator.schoolId, schoolId);
  assert.notEqual(calls.administrator.password, 'TestSchool123');
  assert.equal(calls.email.administratorEmail, 'secure-admin@example.test');
  assert.match(calls.email.activationUrl, /reset-password\?token=/);
  assert.equal(Object.hasOwn(calls.email, 'loginCredentials'), false);
  assert.equal(Object.hasOwn(response.body.schoolAdmin, 'password'), false);
  const publicOutput = JSON.stringify(response.body) + JSON.stringify(calls.logs);
  assert.equal(publicOutput.includes('private-activation-token'), false);
  assert.equal(publicOutput.includes(calls.administrator.password), false);
});
