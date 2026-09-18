const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

function loadRoute(overrides = {}) {
  const { StandardPackage: packageModel, ...serviceOverrides } = overrides;
  const calls = { starts: [], emails: [], logs: [], completes: [] };
  const service = {
    PUBLIC_START_MESSAGE: 'If this email can be used, Kidsible has sent the next step.',
    OnboardingError: class OnboardingError extends Error {},
    async issueOnboardingRequest(input) {
      calls.starts.push(input);
      return input.email === 'existing@example.test'
        ? { shouldSend: false }
        : { shouldSend: true, token: 'a'.repeat(64), firstName: input.firstName, email: input.email };
    },
    async validateOnboardingToken() { return { expiresAt: new Date('2030-01-01T00:00:00.000Z') }; },
    async completeOnboarding(input) {
      calls.completes.push(input);
      return {
        workspace: {
          _id: '111111111111111111111111', name: 'Test Workspace', slug: 'test-workspace-123',
          accountType: 'organization', organizationType: 'sports_club', terminologyProfile: 'training'
        },
        owner: {
          _id: '222222222222222222222222', firstName: 'Test', lastName: 'Owner',
          email: 'owner@example.test', role: 'school_admin', isEmailVerified: true,
          generateAuthToken() { return 'synthetic-jwt'; }
        },
        adoption: null,
        token: 'synthetic-jwt'
      };
    },
    ...serviceOverrides
  };
  const resolved = require.resolve('../routes/onboarding');
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function(name, parent, isMain) {
    if (name === 'express-rate-limit') return () => (_req, _res, next) => next();
    if (name === '../services/onboardingService') return service;
    if (name === '../models/StandardPackage' && packageModel) return packageModel;
    if (name === '../utils/email') return { sendEmail: async data => calls.emails.push(data) };
    if (name === '../utils/logger') {
      return { logger: {
        info: (...args) => calls.logs.push(['info', ...args]),
        warn: (...args) => calls.logs.push(['warn', ...args]),
        error: (...args) => calls.logs.push(['error', ...args])
      } };
    }
    return original.call(this, name, parent, isMain);
  };
  let router;
  try { router = require(resolved); } finally { Module._load = original; }
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', router);
  return { app, calls };
}

test('new and existing emails receive indistinguishable public start responses without token disclosure', async () => {
  const h = loadRoute();
  const payload = { firstName: 'Test', lastName: 'Owner' };
  const unknown = await request(h.app).post('/api/onboarding/start').send({ ...payload, email: 'new@example.test' });
  const existing = await request(h.app).post('/api/onboarding/start').send({ ...payload, email: 'existing@example.test' });
  assert.equal(unknown.status, 202);
  assert.equal(existing.status, 202);
  assert.deepEqual(unknown.body, existing.body);
  assert.equal(JSON.stringify(unknown.body).includes('a'.repeat(64)), false);
  assert.equal(h.calls.emails.length, 1);
  assert.equal(JSON.stringify(h.calls.logs).includes('a'.repeat(64)), false);
});

test('start rejects privilege and tenant fields before creating a request', async () => {
  for (const field of ['role', 'schoolId', 'ownerUserId', 'password', 'accountType', 'organizationType', 'subscription', 'billing']) {
    const h = loadRoute();
    const response = await request(h.app).post('/api/onboarding/start').send({
      firstName: 'Test', lastName: 'Owner', email: 'new@example.test', [field]: 'attacker-value'
    });
    assert.equal(response.status, 400, field);
    assert.equal(h.calls.starts.length, 0, field);
  }
});

test('verification validates without consuming or returning the token', async () => {
  let received;
  const h = loadRoute({
    async validateOnboardingToken(token) {
      received = token;
      return { expiresAt: new Date('2030-01-01T00:00:00.000Z') };
    }
  });
  const rawToken = 'b'.repeat(64);
  const response = await request(h.app).post('/api/onboarding/verify').send({ token: rawToken });
  assert.equal(response.status, 200);
  assert.equal(received, rawToken);
  assert.deepEqual(response.body.data, { valid: true, expiresAt: '2030-01-01T00:00:00.000Z' });
  assert.equal(JSON.stringify(response.body).includes(rawToken), false);
});

test('completion rejects client-controlled role, tenant, owner and terminology fields', async () => {
  for (const field of ['role', 'schoolId', 'ownerUserId', 'terminologyProfile', 'subscription', 'billing']) {
    const h = loadRoute();
    const response = await request(h.app).post('/api/onboarding/complete').send({
      token: 'c'.repeat(64), password: 'valid-password', accountType: 'organization',
      organizationType: 'sports_club', workspaceName: 'Test Workspace', [field]: 'attacker-value'
    });
    assert.equal(response.status, 400, field);
    assert.equal(h.calls.completes.length, 0, field);
  }
});

test('completion returns only server-derived owner and workspace identity', async () => {
  const h = loadRoute();
  const response = await request(h.app).post('/api/onboarding/complete').send({
    token: 'd'.repeat(64), password: 'valid-password', accountType: 'organization',
    organizationType: 'sports_club', workspaceName: 'Test Workspace'
  });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.role, 'school_admin');
  assert.equal(response.body.data.user.schoolId.organizationType, 'sports_club');
  assert.equal(response.body.data.user.schoolId.terminologyProfile, 'training');
});

test('public onboarding metadata returns only authoritative allowlisted workspace choices and capabilities', async () => {
  const h = loadRoute();
  const response = await request(h.app).get('/api/onboarding/metadata');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.accountTypes.map(item => item.value), [
    'organization', 'solo_practitioner'
  ]);
  assert.deepEqual(response.body.data.organizationTypes.map(item => item.value), [
    'school', 'early_childhood_center', 'training_academy', 'sports_club',
    'arts_studio', 'fitness_business', 'tutoring_service', 'independent_practice', 'other'
  ]);
  assert.equal(
    response.body.data.organizationTypes.find(item => item.value === 'school').requiresSchoolDetails,
    true
  );
  assert.equal(
    response.body.data.organizationTypes.find(item => item.value === 'early_childhood_center').requiresSchoolDetails,
    true
  );
  assert.equal(
    response.body.data.organizationTypes.find(item => item.value === 'sports_club').requiresSchoolDetails,
    false
  );
  assert.deepEqual(response.body.data.schoolTypes.map(item => item.value), [
    'licensed_daycare', 'montessori_school', 'public_private_school'
  ]);
  const serialized = JSON.stringify(response.body);
  for (const forbidden of ['permissions', 'schoolId', 'tenantId', 'ownerUserId', 'definition', 'password', 'token']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
test('public package catalog returns only safe published summaries compatible with the requested type', async () => {
  const calls = [];
  const packages = [{
    _id: '507f1f77bcf86cd799439011', slug: 'generic-training',
    name: 'Generic Training', description: 'Starting point', version: 1,
    organizationTypes: ['sports_club']
  }];
  const query = {
    select(value) { calls.push(['select', value]); return this; },
    sort(value) { calls.push(['sort', value]); return this; },
    async lean() { return packages; }
  };
  const h = loadRoute({
    StandardPackage: {
      find(value) { calls.push(['find', value]); return query; }
    }
  });

  const response = await request(h.app)
    .get('/api/onboarding/packages')
    .query({ organizationType: 'sports_club' });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, packages);
  assert.equal(JSON.stringify(response.body).includes('definition'), false);
  assert.deepEqual(calls[0][1], {
    status: 'published',
    $or: [
      { organizationTypes: { $size: 0 } },
      { organizationTypes: 'sports_club' }
    ]
  });
  assert.match(calls[1][1], /name/);
  assert.doesNotMatch(calls[1][1], /definition/);
});

test('public package catalog rejects unsupported organization types before querying packages', async () => {
  let queried = false;
  const h = loadRoute({
    StandardPackage: { find() { queried = true; throw new Error('must not query'); } }
  });
  const response = await request(h.app)
    .get('/api/onboarding/packages')
    .query({ organizationType: 'attacker-controlled-type' });
  assert.equal(response.status, 400);
  assert.equal(queried, false);
  assert.equal(response.body.message, 'Please check the information provided.');
});
