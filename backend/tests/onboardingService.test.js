const test = require('node:test');
const assert = require('node:assert/strict');
const OnboardingRequest = require('../models/OnboardingRequest');
const { hashToken, normalizeEmail, deriveWorkspaceProfile, completeOnboarding } = require('../services/onboardingService');

test('temporary request schema stores only limited identity and token lifecycle data', () => {
  const paths = Object.keys(OnboardingRequest.schema.paths);
  for (const forbidden of ['password', 'passwordHash', 'jwt', 'role', 'schoolId', 'packageDefinition', 'secret']) {
    assert.equal(paths.includes(forbidden), false, forbidden);
  }
  assert.equal(OnboardingRequest.schema.path('tokenHash').options.select, false);
  const indexes = OnboardingRequest.schema.indexes();
  assert.ok(indexes.some(([keys]) => keys.normalizedEmail === 1));
  assert.ok(indexes.some(([keys, options]) => keys.tokenHash === 1 && options.unique === true));
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test('email normalization and token hashing are deterministic without retaining plaintext', () => {
  assert.equal(normalizeEmail('  Owner@Example.TEST '), 'owner@example.test');
  const raw = 'raw-verification-token';
  const hashed = hashToken(raw);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, raw);
  assert.equal(hashToken(raw), hashed);
});

test('workspace identity and terminology are derived server-side', () => {
  assert.deepEqual(deriveWorkspaceProfile('solo_practitioner', 'sports_club'), {
    accountType: 'solo_practitioner',
    organizationType: 'independent_practice',
    terminologyProfile: 'coaching'
  });
  assert.deepEqual(deriveWorkspaceProfile('organization', 'sports_club'), {
    accountType: 'organization', organizationType: 'sports_club', terminologyProfile: 'training'
  });
  assert.deepEqual(deriveWorkspaceProfile('organization', 'school'), {
    accountType: 'organization', organizationType: 'school', terminologyProfile: 'education'
  });
  assert.throws(() => deriveWorkspaceProfile('organization', 'independent_practice'), /valid organization type/);
});

test('completion fails closed when MongoDB transactions are unavailable', async () => {
  const original = OnboardingRequest.db.startSession;
  let ended = false;
  OnboardingRequest.db.startSession = async () => ({
    async withTransaction() {
      throw Object.assign(new Error('Transaction numbers are only allowed on a replica set member'), { code: 20 });
    },
    async endSession() { ended = true; }
  });
  try {
    await assert.rejects(() => completeOnboarding({
      token: 'x'.repeat(64), password: 'strong-test-password', accountType: 'organization',
      organizationType: 'sports_club', workspaceName: 'Unavailable Workspace'
    }), error => error.code === 'TRANSACTIONS_UNAVAILABLE' && error.statusCode === 503);
    assert.equal(ended, true);
  } finally {
    OnboardingRequest.db.startSession = original;
  }
});
