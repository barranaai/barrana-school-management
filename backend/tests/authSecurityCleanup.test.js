const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const request = require('supertest');

const chain = middleware => new Proxy(middleware, {
  get(target, property) {
    if (property in target) return target[property];
    return () => chain(target);
  }
});

function harness({ role = 'school_admin', active = true, found = true, passwordMatches = true } = {}) {
  const calls = { queries: [], saves: 0, creates: 0, logs: [], rateLimit: null };
  const schoolId = { _id: '111111111111111111111111', name: 'Authorized Organization' };
  const user = {
    _id: '222222222222222222222222', firstName: 'Authorized', lastName: 'User',
    email: 'authorized@example.invalid', role, schoolId, isActive: active,
    isEmailVerified: true, preferences: {}, password: 'HASH_NOT_EXPOSED',
    async comparePassword(value) { assert.equal(value, 'submitted-secret'); return passwordMatches; },
    async save() { calls.saves += 1; },
    generateAuthToken() { return 'synthetic-token'; }
  };
  function query(result) {
    return {
      select() { return this; },
      populate() { return Promise.resolve(result); }
    };
  }
  function User() { calls.creates += 1; throw new Error('Registration handler must not run'); }
  User.findOne = criteria => { calls.queries.push(criteria); return query(found ? user : null); };
  User.findByEmail = () => ({ select: async () => found ? user : null });
  User.findById = () => query(user);
  User.countDocuments = async () => 1;

  const logger = {};
  for (const level of ['info', 'warn', 'error']) logger[level] = (...args) => calls.logs.push([level, ...args]);
  const body = () => chain((_req, _res, next) => next());
  const validationResult = () => ({ isEmpty: () => true, array: () => [] });
  const environment = require('../middleware/environment');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8'), {
    module, process, console, Date, Buffer, setTimeout, clearTimeout,
    require(name) {
      const dependencies = {
        express,
        'express-validator': { body, validationResult },
        'express-rate-limit': options => {
          calls.rateLimit = options;
          return (_req, _res, next) => next();
        },
        '../models/User': User,
        '../models/School': {},
        '../middleware/auth': {
          protect: (_req, _res, next) => next(),
          authorize: () => (_req, _res, next) => next(),
          auditLog: () => (_req, _res, next) => next()
        },
        '../middleware/environment': environment,
        '../utils/email': { sendEmail: async () => {} },
        '../utils/logger': { logger }
      };
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', module.exports);
  return { app, calls, user, schoolId };
}

for (const role of ['super_admin', 'school_admin', 'teacher', 'parent', 'student']) {
  test(`login derives ${role} role and tenant from the account, not request input`, async () => {
    const h = harness({ role });
    const response = await request(h.app).post('/api/auth/login').send({
      email: 'AUTHORIZED@EXAMPLE.INVALID', password: 'submitted-secret',
      role: role === 'super_admin' ? 'parent' : 'super_admin', schoolId: 'attacker-school'
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.role, role);
    assert.deepEqual(response.body.data.user.schoolId, h.schoolId);
    assert.equal(h.calls.queries.length, 1);
    assert.equal(h.calls.queries[0].email, 'authorized@example.invalid');
    assert.equal(h.calls.saves, 1);
  });
}

test('missing, inactive and password-mismatch failures are indistinguishable and logs omit submitted identity and secret', async () => {
  for (const options of [{ found: false }, { active: false }, { passwordMatches: false }]) {
    const h = harness(options);
    const response = await request(h.app).post('/api/auth/login').send({
      email: 'authorized@example.invalid', password: 'submitted-secret'
    });
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { success: false, message: 'Invalid credentials' });
    const logs = JSON.stringify(h.calls.logs);
    assert.equal(logs.includes('authorized@example.invalid'), false);
    assert.equal(logs.includes('submitted-secret'), false);
    assert.equal(logs.includes('HASH_NOT_EXPOSED'), false);
  }
});

test('public registration is disabled before account creation', async () => {
  const h = harness();
  const response = await request(h.app).post('/api/auth/register').send({
    firstName: 'Attack', lastName: 'Attempt', email: 'attack@example.invalid',
    password: 'submitted-secret', role: 'super_admin'
  });
  assert.equal(response.status, 403);
  assert.match(response.body.message, /Public registration is disabled/);
  assert.equal(h.calls.creates, 0);
});

test('debug authentication routes fail closed by default', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDebug = process.env.ENABLE_DEBUG_ROUTES;
  process.env.NODE_ENV = 'test';
  process.env.ENABLE_DEBUG_ROUTES = 'false';
  try {
    const h = harness();
    assert.equal((await request(h.app).get('/api/auth/test')).status, 404);
    assert.equal((await request(h.app).get('/api/auth/debug/users')).status, 404);
    assert.equal((await request(h.app).post('/api/auth/test-login').send({ email: 'authorized@example.invalid', password: 'submitted-secret' })).status, 404);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDebug === undefined) delete process.env.ENABLE_DEBUG_ROUTES; else process.env.ENABLE_DEBUG_ROUTES = previousDebug;
  }
});

test('authentication limiter is configured rather than bypassed', () => {
  const h = harness();
  assert.equal(h.calls.rateLimit.windowMs, 15 * 60 * 1000);
  assert.equal(h.calls.rateLimit.standardHeaders, true);
  assert.equal(h.calls.rateLimit.legacyHeaders, false);
  assert.ok([10, 50].includes(h.calls.rateLimit.max));
});
