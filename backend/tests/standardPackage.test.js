const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDefinition } = require('../services/standardPackageService');

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
