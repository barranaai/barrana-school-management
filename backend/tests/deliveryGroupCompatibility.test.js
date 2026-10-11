const test = require('node:test');
const assert = require('node:assert/strict');
const { supportsProgramAndLevel } = require('../services/deliveryGroupCompatibility');

test('legacy group without Program or Levels remains compatible', () => {
  assert.equal(supportsProgramAndLevel({}, 'program-1', 'level-1'), true);
});

test('Program-wide group accepts any Level in its Program', () => {
  assert.equal(supportsProgramAndLevel({ programId: 'program-1', levelIds: [] }, 'program-1', 'level-2'), true);
  assert.equal(supportsProgramAndLevel({ programId: 'program-1', levelIds: [] }, 'program-2', 'level-2'), false);
});

test('Level-scoped group accepts only configured Levels', () => {
  const group = { programId: 'program-1', levelIds: ['level-1', 'level-2'] };
  assert.equal(supportsProgramAndLevel(group, 'program-1', 'level-2'), true);
  assert.equal(supportsProgramAndLevel(group, 'program-1', 'level-3'), false);
  assert.equal(supportsProgramAndLevel(group, 'program-1', null), false);
});
