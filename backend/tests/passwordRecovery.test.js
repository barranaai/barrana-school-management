const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const request = require('supertest');

function harness({ found = true, configured = true, deliveryFails = false, expired = false } = {}) {
  const calls = { lookup: 0, saves: 0, emails: [], logs: [] };
  const user = {
    _id: '222222222222222222222222', firstName: 'Test', email: 'teacher@kidsible.local', role: 'teacher', schoolId: '111111111111111111111111', isActive: true, preferences: {}, isEmailVerified: true, password: 'old-password',
    generatePasswordResetToken() { const token = 'one-time-reset-token'; this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex'); this.passwordResetExpires = Date.now() + (expired ? -1000 : 600000); return token; },
    async save() { calls.saves += 1; },
    async comparePassword(value) { return value === this.password; },
    generateAuthToken() { return 'auth-token'; }
  };
  const query = result => ({ select() { return this; }, populate() { return Promise.resolve(result); } });
  function User() { throw new Error('No account may be created'); }
  User.findByEmail = async email => { calls.lookup += 1; return found && email === user.email ? user : null; };
  User.findOne = criteria => {
    if (criteria.email) return query(found && criteria.email === user.email ? user : null);
    const current = user.passwordResetToken && user.passwordResetExpires > Date.now();
    return Promise.resolve(found && current && criteria.passwordResetToken === user.passwordResetToken ? user : null);
  };
  User.findById = () => query(user);
  User.countDocuments = async () => 1;
  const logger = Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => calls.logs.push([level, ...args])]));
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8'), {
    module, process, console, Date, Buffer, setTimeout, clearTimeout,
    require(name) {
      const dependencies = {
        express,
        'express-validator': require('express-validator'),
        'express-rate-limit': () => (_req, _res, next) => next(),
        '../models/User': User,
        '../models/School': {},
        '../middleware/auth': { protect: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next(), auditLog: () => (_req, _res, next) => next() },
        '../middleware/environment': require('../middleware/environment'),
        '../utils/email': {
          isEmailConfigured: () => configured,
          async sendEmail(options) { calls.emails.push(options); if (deliveryFails) throw new Error('provider failure private detail'); }
        },
        '../utils/logger': { logger }, crypto
      };
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  const app = express(); app.use(express.json()); app.use('/api/auth', module.exports);
  return { app, calls, user };
}

test('forgot password is generic for existing and missing accounts and never returns a token', async () => {
  const existing = harness(); const missing = harness({ found: false });
  const a = await request(existing.app).post('/api/auth/forgot-password').send({ email: 'teacher@kidsible.local' });
  const b = await request(missing.app).post('/api/auth/forgot-password').send({ email: 'teacher@kidsible.local' });
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.deepEqual(a.body, b.body);
  assert.equal(JSON.stringify(a.body).includes('one-time-reset-token'), false);
  assert.equal(existing.calls.emails.length, 1); assert.equal(missing.calls.emails.length, 0);
});

test('provider availability fails before account lookup, while delivery failure stays generic and invalidates its token', async () => {
  const unavailable = harness({ configured: false });
  const unavailableResponse = await request(unavailable.app).post('/api/auth/forgot-password').send({ email: 'teacher@kidsible.local' });
  assert.equal(unavailableResponse.status, 503); assert.equal(unavailable.calls.lookup, 0);
  const failed = harness({ deliveryFails: true });
  const response = await request(failed.app).post('/api/auth/forgot-password').send({ email: 'teacher@kidsible.local' });
  assert.equal(response.status, 200); assert.equal(failed.user.passwordResetToken, undefined); assert.equal(failed.user.passwordResetExpires, undefined);
  assert.equal(JSON.stringify(failed.calls.logs).includes('one-time-reset-token'), false);
  assert.equal(JSON.stringify(failed.calls.logs).includes('provider failure private detail'), false);
});

test('valid token resets once and the new password authenticates through normal login', async () => {
  const h = harness(); await request(h.app).post('/api/auth/forgot-password').send({ email: h.user.email });
  const reset = await request(h.app).post('/api/auth/reset-password').send({ token: 'one-time-reset-token', password: 'new-secure-password' });
  assert.equal(reset.status, 200); assert.equal(h.user.password, 'new-secure-password'); assert.equal(h.user.passwordResetToken, undefined);
  const reused = await request(h.app).post('/api/auth/reset-password').send({ token: 'one-time-reset-token', password: 'another-password' });
  assert.equal(reused.status, 400);
  const login = await request(h.app).post('/api/auth/login').send({ email: h.user.email, password: 'new-secure-password' });
  assert.equal(login.status, 200); assert.equal(login.body.data.user.role, 'teacher');
});

test('invalid, expired and short-password requests fail without changing the password', async () => {
  for (const options of [{}, { expired: true }]) {
    const h = harness(options); await request(h.app).post('/api/auth/forgot-password').send({ email: h.user.email });
    const token = options.expired ? 'one-time-reset-token' : 'wrong-token';
    const response = await request(h.app).post('/api/auth/reset-password').send({ token, password: 'new-secure-password' });
    assert.equal(response.status, 400); assert.equal(h.user.password, 'old-password');
  }
  const short = harness(); const response = await request(short.app).post('/api/auth/reset-password').send({ token: 'one-time-reset-token', password: 'short' });
  assert.equal(response.status, 400); assert.equal(short.user.password, 'old-password');
  assert.equal(JSON.stringify(response.body).includes('short'), false);
  assert.equal(JSON.stringify(short.calls.logs).includes('short'), false);
});
