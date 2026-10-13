const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const request = require('supertest');

function harness() {
  const calls = { saves: 0 };
  const user = {
    _id: '222222222222222222222222', firstName: 'Current', lastName: 'Teacher',
    email: 'teacher@example.invalid', phone: '', address: '', role: 'teacher',
    schoolId: '111111111111111111111111', isActive: true, isEmailVerified: true,
    password: 'current-password',
    preferences: { notifications: { email: true, push: true, sms: false, whatsapp: false } },
    markModified() {},
    async comparePassword(value) { return value === this.password; },
    async save() { calls.saves += 1; }
  };
  const query = result => ({
    select() { return this; },
    populate() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
  });
  function User() { throw new Error('No user may be created'); }
  User.findById = id => query(id === user._id ? user : null);
  User.findByEmail = async () => user;
  User.findOne = () => query(user);
  User.countDocuments = async () => 1;

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
        '../middleware/auth': {
          protect: (req, _res, next) => { req.user = { id: user._id, _id: user._id, role: user.role, schoolId: user.schoolId }; next(); },
          authorize: () => (_req, _res, next) => next(),
          auditLog: () => (_req, _res, next) => next()
        },
        '../middleware/environment': require('../middleware/environment'),
        '../utils/email': { sendEmail: async () => {}, isEmailConfigured: () => true },
        '../utils/logger': { logger: { info() {}, warn() {}, error() {} } }
      };
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  const app = express(); app.use(express.json()); app.use('/api/auth', module.exports);
  return { app, user, calls };
}

test('user can update only permitted personal profile fields', async () => {
  const h = harness();
  const response = await request(h.app).patch('/api/auth/me/profile').send({
    firstName: 'Updated', lastName: 'Name', phone: '+12345678901', address: 'New address'
  });
  assert.equal(response.status, 200);
  assert.equal(h.user.firstName, 'Updated');
  assert.equal(h.user.phone, '+12345678901');
  assert.equal(h.calls.saves, 1);
  assert.equal(Object.hasOwn(response.body.data, 'password'), false);
});

test('protected fields and invalid profile data are rejected without writes', async () => {
  for (const body of [
    { firstName: 'Attack', role: 'super_admin' },
    { firstName: 'Attack', userId: '333333333333333333333333' },
    { firstName: '', lastName: 'Teacher' },
    { phone: 'not-a-phone' }
  ]) {
    const h = harness();
    const response = await request(h.app).patch('/api/auth/me/profile').send(body);
    assert.equal(response.status, 400);
    assert.equal(h.calls.saves, 0);
    assert.equal(h.user.role, 'teacher');
    assert.equal(h.user.schoolId, '111111111111111111111111');
  }
});

test('supported notification preferences update while unknown settings are rejected', async () => {
  const h = harness();
  const updated = await request(h.app).patch('/api/auth/me/notifications').send({ email: false, push: true, sms: true, whatsapp: false });
  assert.equal(updated.status, 200);
  assert.equal(h.user.preferences.notifications.email, false);
  assert.equal(h.user.preferences.notifications.sms, true);
  assert.equal(h.calls.saves, 1);

  const rejected = await request(h.app).patch('/api/auth/me/notifications').send({ role: true });
  assert.equal(rejected.status, 400);
  assert.equal(h.calls.saves, 1);
});

test('password change requires the current password and hashes through the existing model save path', async () => {
  const h = harness();
  const wrong = await request(h.app).post('/api/auth/me/change-password').send({ currentPassword: 'wrong-password', newPassword: 'new-password-123' });
  assert.equal(wrong.status, 400); assert.equal(h.calls.saves, 0); assert.equal(h.user.password, 'current-password');

  const valid = await request(h.app).post('/api/auth/me/change-password').send({ currentPassword: 'current-password', newPassword: 'new-password-123' });
  assert.equal(valid.status, 200); assert.equal(h.calls.saves, 1); assert.equal(h.user.password, 'new-password-123');
  assert.equal(JSON.stringify(valid.body).includes('new-password-123'), false);
});

test('inactive users are rejected by the real authentication middleware before the route runs', async () => {
  const module = { exports: {} };
  const inactiveUser = {
    _id: '222222222222222222222222',
    isActive: false,
    save: async () => { throw new Error('inactive users must not be written'); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../middleware/auth.js'), 'utf8'), {
    module, process, console, Date,
    require(name) {
      const dependencies = {
        jsonwebtoken: { verify: () => ({ id: inactiveUser._id }) },
        '../models/User': { findById: () => ({ select: async () => inactiveUser }) },
        '../utils/logger': { logger: { info() {}, warn() {}, error() {} } }
      };
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  const app = express();
  app.patch('/settings', module.exports.protect, (_req, res) => res.json({ success: true }));
  const response = await request(app).patch('/settings').set('Authorization', 'Bearer valid-token');
  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Account is deactivated');
});

test('the User model save hook hashes changed passwords without exposing the plaintext', async () => {
  const User = require('../models/User');
  const user = new User({
    firstName: 'Password', lastName: 'Tester', email: 'password@example.invalid',
    password: 'new-password-123', role: 'teacher', schoolId: '111111111111111111111111'
  });
  const saveHooks = User.schema.s.hooks._pres.get('save') || [];
  const passwordHook = saveHooks.find(hook => hook.fn && hook.fn.toString().includes('bcrypt.hash'));
  assert.ok(passwordHook, 'Expected the User password hashing pre-save hook');
  await passwordHook.fn.call(user, error => { if (error) throw error; });
  assert.notEqual(user.password, 'new-password-123');
  assert.equal(await user.comparePassword('new-password-123'), true);
});
