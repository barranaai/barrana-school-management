const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const teacherA = '333333333333333333333333';
const teacherB = '444444444444444444444444';

const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

function queryResult(records) {
  return {
    select() {
      return { lean: async () => records };
    }
  };
}

function loadHandler(state) {
  const Class = {
    find(query) {
      state.classQuery = query;
      return queryResult(state.groups.filter(group =>
        group.schoolId === query.schoolId &&
        group.status === query.status &&
        group.isActive === query.isActive &&
        group.teacherId === query['assignedTeachers.teacherId']
      ));
    }
  };
  const Enrollment = {
    find(query) {
      state.enrollmentQuery = query;
      const ids = query.currentClassId.$in.map(String);
      return queryResult(state.enrollments.filter(enrollment =>
        enrollment.schoolId === query.schoolId &&
        enrollment.status === query.status &&
        ids.includes(String(enrollment.currentClassId))
      ));
    }
  };
  const User = {
    find(query) {
      state.userQuery = query;
      const ids = query._id.$in.map(String);
      return queryResult(state.participants.filter(participant =>
        ids.includes(String(participant._id)) &&
        participant.schoolId === query.schoolId &&
        participant.role === query.role &&
        participant.isActive === query.isActive
      ));
    }
  };

  const originalLoad = Module._load;
  Module._load = function(name, parent, isMain) {
    if (name === '../models/User') return User;
    if (name === '../models/Class') return Class;
    if (name === '../models/Enrollment') return Enrollment;
    if (name === '../models/Report' || name === '../models/School') return {};
    if (name === '../middleware/auth') return { protect: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next() };
    if (name === '../middleware/lifecycleAuthorization') return { requireActiveOrganization: (_req, _res, next) => next() };
    if (name === '../utils/logger') return { logger: { info() {}, error() {} } };
    if (name === '../services/emailService') return { sendTeacherWelcomeEmail: async () => ({}) };
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    const routePath = path.join(__dirname, '../routes/teachers.js');
    delete require.cache[require.resolve(routePath)];
    const router = require(routePath);
    const route = router.stack.find(layer => layer.route?.path === '/me/participants');
    assert.ok(route, 'teacher roster route must be registered before parameter routes');
    return route.route.stack.at(-1).handle;
  } finally {
    Module._load = originalLoad;
  }
}

function fixture() {
  return {
    groups: [
      { _id: 'group-a', name: 'Duplicate name', schoolId: schoolA, status: 'active', isActive: true, teacherId: teacherA },
      { _id: 'group-b', name: 'Duplicate name', schoolId: schoolA, status: 'active', isActive: true, teacherId: teacherB },
      { _id: 'group-inactive', name: 'Inactive', schoolId: schoolA, status: 'inactive', isActive: false, teacherId: teacherA },
      { _id: 'group-other-school', name: 'Other tenant', schoolId: schoolB, status: 'active', isActive: true, teacherId: teacherA }
    ],
    enrollments: [
      { _id: 'enrollment-active', childId: 'child-active', programId: 'program', currentLevelId: 'level', currentClassId: 'group-a', schoolId: schoolA, status: 'active', startDate: new Date() },
      ...['paused', 'completed', 'withdrawn', 'cancelled'].map(status => ({ _id: `enrollment-${status}`, childId: `child-${status}`, programId: 'program', currentClassId: 'group-a', schoolId: schoolA, status })),
      { _id: 'enrollment-unassigned', childId: 'child-unassigned', programId: 'program', currentClassId: 'group-b', schoolId: schoolA, status: 'active' },
      { _id: 'enrollment-cross-tenant', childId: 'child-cross-tenant', programId: 'program', currentClassId: 'group-a', schoolId: schoolB, status: 'active' }
    ],
    participants: [
      { _id: 'child-active', firstName: 'Active', lastName: 'Child', schoolId: schoolA, role: 'student', isActive: true },
      { _id: 'child-unassigned', firstName: 'Unassigned', lastName: 'Child', schoolId: schoolA, role: 'student', isActive: true },
      { _id: 'child-cross-tenant', firstName: 'Other', lastName: 'Tenant', schoolId: schoolB, role: 'student', isActive: true }
    ]
  };
}

async function request(state, teacherId = teacherA, schoolId = schoolA, extras = {}) {
  const handler = loadHandler(state);
  const req = { user: { _id: teacherId, schoolId, role: 'teacher' }, query: extras.query || {}, body: extras.body || {} };
  const res = response();
  await handler(req, res);
  return res;
}

test('uses authenticated teacher and organization and returns only active enrollment roster members', async () => {
  const state = fixture();
  const res = await request(state, teacherA, schoolA, { query: { teacherId: teacherB, schoolId: schoolB } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.map(item => item._id), ['child-active']);
  assert.equal(res.body.data[0].currentEnrollments[0].currentClassId, 'group-a');
  assert.equal(state.classQuery.schoolId, schoolA);
  assert.equal(state.classQuery['assignedTeachers.teacherId'], teacherA);
  assert.equal(state.enrollmentQuery.status, 'active');
  assert.equal(state.userQuery.schoolId, schoolA);
});

test('reassignment removes the child from the former teacher and includes the child for the new teacher', async () => {
  const state = fixture();
  state.enrollments[0].currentClassId = 'group-b';
  assert.equal((await request(state, teacherA)).body.count, 0);
  assert.deepEqual((await request(state, teacherB)).body.data.map(item => item._id), ['child-active', 'child-unassigned']);
});

test('paused, completed, withdrawn and cancelled enrollments are excluded', async () => {
  const state = fixture();
  state.participants.push(...['paused', 'completed', 'withdrawn', 'cancelled'].map(status => ({
    _id: `child-${status}`, firstName: status, lastName: 'Child', schoolId: schoolA, role: 'student', isActive: true
  })));
  assert.deepEqual((await request(state)).body.data.map(item => item._id), ['child-active']);
});

test('a returning child is included through the new active enrollment', async () => {
  const state = fixture();
  state.enrollments.push({ _id: 'returning-active', childId: 'child-returning', programId: 'new-program', currentClassId: 'group-a', schoolId: schoolA, status: 'active' });
  state.participants.push({ _id: 'child-returning', firstName: 'Returning', lastName: 'Child', schoolId: schoolA, role: 'student', isActive: true });
  assert.deepEqual((await request(state)).body.data.map(item => item._id), ['child-active', 'child-returning']);
});

test('duplicate group names do not grant roster membership and tenant boundaries remain enforced', async () => {
  const state = fixture();
  const result = (await request(state)).body.data.map(item => item._id);
  assert.deepEqual(result, ['child-active']);
  assert.ok(!result.includes('child-unassigned'));
  assert.ok(!result.includes('child-cross-tenant'));
});

test('an inactive participant and an inactive assigned group do not appear', async () => {
  const state = fixture();
  state.participants[0].isActive = false;
  state.enrollments.push({ _id: 'inactive-group-enrollment', childId: 'child-unassigned', programId: 'program', currentClassId: 'group-inactive', schoolId: schoolA, status: 'active' });
  assert.equal((await request(state)).body.count, 0);
});
