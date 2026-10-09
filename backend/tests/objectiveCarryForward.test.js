const test = require('node:test');
const assert = require('node:assert/strict');
const { eligibleObjectives, alreadyPresent, carryForwardObjective } = require('../services/objectiveCarryForwardService');

const session = { plannedSessionSnapshot: { objectives: [
  { objectiveId: 'a', sequence: 1, title: 'Balance', expectedOutcome: 'Hold position', metadata: { private: 'omit' } },
  { objectiveId: 'b', sequence: 2, title: 'Turn' },
  { objectiveId: 'c', sequence: 3, title: 'Listen' },
  { objectiveId: 'd', sequence: 4, title: 'Jump' }
] } };

test('only not achieved and partially achieved saved results are eligible', () => {
  const progress = { objectiveResults: [
    { objectiveId: 'a', status: 'not_achieved', instructorNote: 'private' },
    { objectiveId: 'b', status: 'partially_achieved', evidence: 'private' },
    { objectiveId: 'c', status: 'not_observed' },
    { objectiveId: 'd', status: 'achieved' }
  ] };
  assert.deepEqual(eligibleObjectives(progress, session).map(item => item.result.status), ['not_achieved', 'partially_achieved']);
  assert.deepEqual(eligibleObjectives({}, session), []);
});

test('duplicate source objective is detected by original identity or traceability metadata', () => {
  assert.equal(alreadyPresent({ objectives: [{ _id: 'a' }] }, 'a'), true);
  assert.equal(alreadyPresent({ objectives: [{ _id: 'new', metadata: { carryForward: { sourceObjectiveId: 'a' } } }] }, 'a'), true);
  assert.equal(alreadyPresent({ objectives: [] }, 'a'), false);
});

test('accepted objective is sanitized and keeps source traceability', () => {
  const source = session.plannedSessionSnapshot.objectives[0];
  const carried = carryForwardObjective(source, { objectives: [{ sequence: 4 }] }, { sourceObjectiveId: 'a', sourceDeliveredSessionId: 'session' }, 'new');
  assert.equal(carried.sequence, 5);
  assert.equal(carried.title, 'Balance');
  assert.deepEqual(carried.metadata, { carryForward: { sourceObjectiveId: 'a', sourceDeliveredSessionId: 'session' } });
  assert.equal(JSON.stringify(carried).includes('private'), false);
  assert.equal(Object.hasOwn(carried, 'instructorNote'), false);
  assert.equal(Object.hasOwn(carried, 'evidence'), false);
});
