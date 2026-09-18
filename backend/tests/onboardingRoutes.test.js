const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

function loadRoute(overrides = {}) {
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
    ...overrides
  };
  const resolved = require.resolve('../routes/onboarding');
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function(name, parent, isMain) {
    if (name === 'express-rate-limit') return () => (_req, _res, next) => next();
    if (name === '../services/onboardingService') return service;
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
