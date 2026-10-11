const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const DeliveredSession = require('../models/DeliveredSession');
const ChildParticipation = require('../models/ChildParticipation');
const { canDeliverIndividualSession } = require('../services/individualSessionAuthorization');

const id = number => new mongoose.Types.ObjectId(String(number).padStart(24, '0'));
const ids = {
  school: id(1), teacher: id(2), child: id(3), enrollment: id(4), class: id(5),
  program: id(6), level: id(7), planned: id(8), roadmap: id(9)
};

function sessionFields(overrides = {}) {
  return {
    schoolId: ids.school, plannedSessionId: ids.planned, roadmapId: ids.roadmap,
    roadmapVersion: 1, programId: ids.program, levelId: ids.level,
    scheduledAt: new Date('2026-09-19T09:00:00Z'), title: 'Individual lesson',
    plannedSessionSnapshot: {
      plannedSessionId: ids.planned, roadmapId: ids.roadmap, roadmapVersion: 1,
      title: 'Individual lesson', objectives: [], expectedOutcomes: [], methodology: 'Guided practice'
    },
    deliveredBy: ids.teacher, createdBy: ids.teacher, updatedBy: ids.teacher,
    ...overrides
  };
}

function authorizationFixture() {
  return {
    teacher: { _id: ids.teacher, schoolId: ids.school, role: 'teacher', isActive: true },
    child: { _id: ids.child, schoolId: ids.school, role: 'student', isActive: true },
    enrollment: {
      _id: ids.enrollment, schoolId: ids.school, childId: ids.child, programId: ids.program,
      currentLevelId: ids.level, status: 'active', startDate: new Date('2026-09-01T00:00:00Z'),
      staffAssignments: [{ staffId: ids.teacher, role: 'trainer', effectiveFrom: new Date('2026-09-01T00:00:00Z'), status: 'active' }]
    },
    session: sessionFields({ deliveryMode: 'individual', individualEnrollmentId: ids.enrollment, individualChildId: ids.child })
  };
}

test('legacy and explicit group sessions retain the Delivery Group contract', async () => {
  const legacy = DeliveredSession.hydrate(sessionFields({ classId: ids.class }));
  await legacy.validate();
  assert.equal(legacy.deliveryMode, 'group');
  assert.equal(String(legacy.classId), String(ids.class));

  const explicit = new DeliveredSession(sessionFields({ deliveryMode: 'group', classId: ids.class }));
  await explicit.validate();
  assert.equal(explicit.deliveryMode, 'group');

  await assert.rejects(new DeliveredSession(sessionFields({ deliveryMode: 'group' })).validate(), /classId/);
});

test('individual sessions require an explicit Enrollment and child and reject a Delivery Group', async () => {
  const valid = new DeliveredSession(sessionFields({ deliveryMode: 'individual', individualEnrollmentId: ids.enrollment, individualChildId: ids.child }));
  await valid.validate();
  assert.equal(valid.classId, undefined);

  await assert.rejects(new DeliveredSession(sessionFields({ deliveryMode: 'individual', individualChildId: ids.child })).validate(), /individualEnrollmentId/);
  await assert.rejects(new DeliveredSession(sessionFields({ deliveryMode: 'individual', individualEnrollmentId: ids.enrollment })).validate(), /individualChildId/);
  await assert.rejects(new DeliveredSession(sessionFields({ deliveryMode: 'individual', individualEnrollmentId: ids.enrollment, individualChildId: ids.child, classId: ids.class })).validate(), /cannot reference a Delivery Group/);
});

test('Participation retains the legacy group class requirement and permits class-free individual records', async () => {
  const base = { schoolId: ids.school, deliveredSessionId: id(40), childId: ids.child, enrollmentId: ids.enrollment, programId: ids.program, levelId: ids.level, createdBy: ids.teacher, updatedBy: ids.teacher };
  await new ChildParticipation({ ...base, classId: ids.class }).validate();
  await assert.rejects(new ChildParticipation(base).validate(), /classId/);
  const individual = new ChildParticipation({ ...base, deliveryMode: 'individual' });
  await individual.validate(); assert.equal(individual.classId, null);
  await assert.rejects(new ChildParticipation({ ...base, deliveryMode: 'individual', classId: ids.class }).validate(), /cannot reference a Delivery Group/);
});

test('valid active Enrollment staff assignment authorizes the assigned instructor', () => {
  assert.equal(canDeliverIndividualSession(authorizationFixture()), true);
});

const deniedCases = {
  'inactive instructor': fixture => { fixture.teacher.isActive = false; },
  'wrong instructor': fixture => { fixture.teacher._id = id(20); },
  'cross-tenant instructor': fixture => { fixture.teacher.schoolId = id(21); },
  'cross-tenant child': fixture => { fixture.child.schoolId = id(21); },
  'cross-tenant Enrollment': fixture => { fixture.enrollment.schoolId = id(21); },
  'wrong target child': fixture => { fixture.session.individualChildId = id(22); },
  'wrong target Enrollment': fixture => { fixture.session.individualEnrollmentId = id(22); },
  'inactive participant': fixture => { fixture.child.isActive = false; },
  'inactive Enrollment': fixture => { fixture.enrollment.status = 'paused'; },
  'wrong Program': fixture => { fixture.enrollment.programId = id(22); },
  'wrong Level': fixture => { fixture.enrollment.currentLevelId = id(22); },
  'future Enrollment': fixture => { fixture.enrollment.startDate = new Date('2026-09-20T00:00:00Z'); },
  'ended staff assignment': fixture => { fixture.enrollment.staffAssignments[0].status = 'ended'; },
  'future staff assignment': fixture => { fixture.enrollment.staffAssignments[0].effectiveFrom = new Date('2026-09-20T00:00:00Z'); },
  'expired staff assignment': fixture => { fixture.enrollment.staffAssignments[0].effectiveTo = new Date('2026-09-18T00:00:00Z'); },
  'group session': fixture => { fixture.session.deliveryMode = 'group'; }
};

for (const [name, change] of Object.entries(deniedCases)) {
  test(`individual lesson authorization rejects ${name}`, () => {
    const fixture = authorizationFixture();
    change(fixture);
    assert.equal(canDeliverIndividualSession(fixture), false);
  });
}

test('multiple instructors may be assigned but only the authenticated assigned instructor is authorized', () => {
  const fixture = authorizationFixture();
  fixture.enrollment.staffAssignments.unshift({ staffId: id(30), role: 'trainer', effectiveFrom: new Date('2026-09-01T00:00:00Z'), status: 'active' });
  assert.equal(canDeliverIndividualSession(fixture), true);
});
