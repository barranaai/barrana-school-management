const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ongoingStatuses,
  canTransition,
  closeOpenHistory,
  findConflictingEnrollment
} = require('../services/enrollmentLifecycleService');

test('pause and resume are allowed while ended participation periods cannot be reactivated', () => {
  assert.equal(canTransition('active', 'paused'), true);
  assert.equal(canTransition('paused', 'active'), true);
  assert.equal(canTransition('active', 'withdrawn'), true);
  for (const status of ['completed', 'withdrawn', 'cancelled']) {
    assert.equal(canTransition(status, 'active'), false);
  }
});

test('ending an enrollment closes current Level, group and staff assignments without deleting history', () => {
  const enrollment = {
    currentLevelId: 'level-a', currentClassId: 'group-a',
    levelHistory: [{ levelId: 'level-a', effectiveFrom: new Date('2026-01-01') }],
    classAssignments: [{ classId: 'group-a', effectiveFrom: new Date('2026-01-01'), status: 'active' }],
    staffAssignments: [{ staffId: 'staff-a', effectiveFrom: new Date('2026-01-01'), status: 'active' }]
  };
  const endedAt = new Date('2026-06-01');
  closeOpenHistory(enrollment, endedAt);
  assert.equal(enrollment.currentLevelId, null);
  assert.equal(enrollment.currentClassId, null);
  assert.equal(enrollment.levelHistory[0].effectiveTo, endedAt);
  assert.equal(enrollment.classAssignments[0].effectiveTo, endedAt);
  assert.equal(enrollment.classAssignments[0].status, 'ended');
  assert.equal(enrollment.staffAssignments[0].effectiveTo, endedAt);
  assert.equal(enrollment.staffAssignments[0].status, 'ended');
});

test('conflict lookup blocks only ongoing enrollment in the same tenant child and Program', async () => {
  let query;
  const Enrollment = { findOne: async value => { query = value; return { _id: 'existing' }; } };
  const result = await findConflictingEnrollment(Enrollment, {
    schoolId: 'school-a', childId: 'child-a', programId: 'program-a', excludeId: 'current'
  });
  assert.equal(result._id, 'existing');
  assert.deepEqual(query.status.$in, ongoingStatuses);
  assert.equal(query.schoolId, 'school-a');
  assert.equal(query.childId, 'child-a');
  assert.equal(query.programId, 'program-a');
  assert.deepEqual(query._id, { $ne: 'current' });
});

test('different Programs remain independent and a prior withdrawn period does not conflict', async () => {
  const records = [
    { childId: 'child-a', programId: 'swimming', status: 'withdrawn' },
    { childId: 'child-a', programId: 'piano', status: 'active' }
  ];
  const Enrollment = { findOne: async query => records.find(row =>
    row.childId === query.childId && row.programId === query.programId && query.status.$in.includes(row.status)
  ) || null };
  assert.equal(await findConflictingEnrollment(Enrollment, { schoolId: 'school-a', childId: 'child-a', programId: 'swimming' }), null);
  assert.equal((await findConflictingEnrollment(Enrollment, { schoolId: 'school-a', childId: 'child-a', programId: 'piano' })).status, 'active');
});
