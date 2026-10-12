const test = require('node:test');
const assert = require('node:assert/strict');
const Class = require('../models/Class');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const Enrollment = require('../models/Enrollment');
const { canTeacherAccessParticipantReporting } = require('../services/reportParticipantAuthorization');

const id = value => String(value).padStart(24, '0');
const school = id(1), otherSchool = id(2), teacherId = id(3), childId = id(4), classId = id(5), sessionId = id(6);
const teacher = { _id: teacherId, schoolId: school, role: 'teacher', isActive: true };
const child = { _id: childId, schoolId: school, role: 'student' };
const chain = value => ({ select() { return this; }, lean() { return Promise.resolve(value); } });

async function scenario({ enrollments = [], assignedGroup = false, participations = [], historicalSession = false, actor = teacher, participant = child }) {
  const originals = {
    enrollmentFind: Enrollment.find,
    classExists: Class.exists,
    participationFind: ChildParticipation.find,
    sessionExists: DeliveredSession.exists
  };
  const observed = {};
  Enrollment.find = query => { observed.enrollment = query; return chain(enrollments); };
  Class.exists = async query => { observed.group = query; return assignedGroup; };
  ChildParticipation.find = query => { observed.participation = query; return chain(participations); };
  DeliveredSession.exists = async query => { observed.session = query; return historicalSession; };
  try {
    const allowed = await canTeacherAccessParticipantReporting(actor, participant, new Date('2026-10-11T12:00:00Z'));
    return { allowed, observed };
  } finally {
    Enrollment.find = originals.enrollmentFind;
    Class.exists = originals.classExists;
    ChildParticipation.find = originals.participationFind;
    DeliveredSession.exists = originals.sessionExists;
  }
}

test('current assigned group Enrollment authorizes report-template availability', async () => {
  const result = await scenario({ enrollments: [{ currentClassId: classId, staffAssignments: [] }], assignedGroup: true });
  assert.equal(result.allowed, true);
  assert.equal(String(result.observed.enrollment.schoolId), school);
  assert.equal(String(result.observed.enrollment.childId), childId);
  assert.equal(String(result.observed.group['assignedTeachers.teacherId']), teacherId);
});

test('active individual Enrollment staff assignment authorizes report-template availability', async () => {
  const result = await scenario({ enrollments: [{ staffAssignments: [{ staffId: teacherId, status: 'active', effectiveFrom: new Date('2026-01-01') }] }] });
  assert.equal(result.allowed, true);
  assert.equal(result.observed.group, undefined);
  assert.equal(result.observed.participation, undefined);
});

test('historical Delivered Session ownership preserves legitimate report access', async () => {
  const result = await scenario({ participations: [{ deliveredSessionId: sessionId }], historicalSession: true });
  assert.equal(result.allowed, true);
  assert.equal(String(result.observed.session.deliveredBy), teacherId);
  assert.equal(String(result.observed.session.schoolId), school);
  assert.deepEqual(result.observed.session._id.$in, [sessionId]);
});

test('unrelated instructor in the same organization is denied', async () => {
  const result = await scenario({ enrollments: [{ currentClassId: classId, staffAssignments: [] }] });
  assert.equal(result.allowed, false);
});

test('cross-organization participant is denied before any record query', async () => {
  const result = await scenario({ participant: { ...child, schoolId: otherSchool } });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.observed, {});
});

test('inactive instructor and non-instructor roles are denied', async () => {
  assert.equal((await scenario({ actor: { ...teacher, isActive: false } })).allowed, false);
  assert.equal((await scenario({ actor: { ...teacher, role: 'school_admin' } })).allowed, false);
});

test('report-template availability route fails closed before returning participant data', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../routes/reports.js'), 'utf8');
  const route = source.slice(source.indexOf("router.get('/available-templates/:studentId'"));
  assert.match(route, /protect, authorize\('teacher'\)/);
  assert.match(route, /canTeacherAccessParticipantReporting\(teacher, student\)/);
  assert.match(route, /return res\.status\(404\)\.json\(\{ success:false, message:'Participant not found' \}\)/);
});
