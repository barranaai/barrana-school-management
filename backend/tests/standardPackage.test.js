const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDefinition, adoptPackageInSession } = require('../services/standardPackageService');

const validDefinition = () => ({
  programs: [{
    key: 'swimming',
    name: 'Swimming',
    levels: [{
      key: 'water-confidence',
      name: 'Water Confidence',
      requirements: [{
        key: 'safe-entry',
        name: 'Safe Entry',
        parameters: [{
          key: 'confidence',
          name: 'Confidence',
          type: 'rating'
        }]
      }]
    }],
    roadmaps: [{
      key: 'water-confidence-roadmap',
      levelKey: 'water-confidence',
      name: 'Water Confidence Roadmap',
      plannedSessions: [{
        sequence: 1,
        title: 'Safe Entry',
        objectives: [{
          title: 'Safe entry',
          requirementKey: 'safe-entry',
          parameterKey: 'confidence'
        }]
      }]
    }]
  }]
});

test('session-aware adoption fails closed without an existing session', async () => {
  await assert.rejects(
    () => adoptPackageInSession({ packageDocument: { definition: validDefinition() }, schoolId: 'school', userId: 'user' }),
    error => error.code === 'SESSION_REQUIRED'
  );
});

test('accepts a valid standard package definition', () => {
  assert.equal(validateDefinition(validDefinition()), true);
});

test('requires at least one program', () => {
  assert.throws(
    () => validateDefinition({ programs: [] }),
    error => error.code === 'INVALID_PACKAGE'
  );
});

test('rejects duplicate relationship keys', () => {
  const definition = validDefinition();
  definition.programs[0].levels.push({
    ...definition.programs[0].levels[0]
  });
  assert.throws(
    () => validateDefinition(definition),
    error => error.code === 'INVALID_PACKAGE'
  );
});

test('rejects objective references outside the package definition', () => {
  const definition = validDefinition();
  definition.programs[0].roadmaps[0].plannedSessions[0]
    .objectives[0].requirementKey = 'unknown';
  assert.throws(
    () => validateDefinition(definition),
    error => error.code === 'INVALID_PACKAGE'
  );
});

test('requires options for select parameters', () => {
  const definition = validDefinition();
  definition.programs[0].levels[0].requirements[0].parameters[0] = {
    key: 'result',
    name: 'Result',
    type: 'select'
  };
  assert.throws(
    () => validateDefinition(definition),
    error => error.code === 'INVALID_PACKAGE'
  );
});

test('rejects unsupported fields at every package hierarchy boundary', () => {
  const definition = validDefinition();
  definition.programs[0].schoolId = 'tenant-injection';
  assert.throws(
    () => validateDefinition(definition),
    error => error.code === 'INVALID_PACKAGE'
  );

  const nested = validDefinition();
  nested.programs[0].levels[0].requirements[0].parameters[0].createdBy = 'user-injection';
  assert.throws(
    () => validateDefinition(nested),
    error => error.code === 'INVALID_PACKAGE'
  );
});

test('rejects sensitive tenant and credential values hidden in supported metadata', () => {
  for (const metadata of [
    { schoolId: 'tenant-injection' },
    { nested: { ownerId: 'owner-injection' } },
    { apiKey: 'secret-injection' }
  ]) {
    const definition = validDefinition();
    definition.programs[0].metadata = metadata;
    assert.throws(
      () => validateDefinition(definition),
      error => error.code === 'INVALID_PACKAGE'
    );
  }
});

test('accepts safe organization-independent metadata', () => {
  const definition = validDefinition();
  definition.programs[0].metadata = {
    category: 'aquatics', tags: ['foundation', 'confidence'], recommendedAge: 6
  };
  assert.equal(validateDefinition(definition), true);
});

test('rejects roadmap and objective references that cross Program boundaries', () => {
  const definition = validDefinition();
  definition.programs.push({
    key: 'music', name: 'Music',
    levels: [{
      key: 'music-beginner', name: 'Beginner',
      requirements: [{
        key: 'music-posture', name: 'Posture',
        parameters: [{ key: 'music-rating', name: 'Rating', type: 'rating' }]
      }]
    }],
    roadmaps: [{
      key: 'music-roadmap', levelKey: 'water-confidence', name: 'Wrong Roadmap', plannedSessions: []
    }]
  });
  assert.throws(
    () => validateDefinition(definition),
    error => error.code === 'INVALID_PACKAGE'
  );
});

test('requires an objective parameter to belong to its selected requirement', () => {
  const definition = validDefinition();
  definition.programs[0].levels[0].requirements.push({
    key: 'floating', name: 'Floating',
    parameters: [{ key: 'duration', name: 'Duration', type: 'number' }]
  });
  definition.programs[0].roadmaps[0].plannedSessions[0].objectives[0].parameterKey = 'duration';
  assert.throws(
    () => validateDefinition(definition),
    error => error.code === 'INVALID_PACKAGE'
  );
});
