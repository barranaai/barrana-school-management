const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const ids = { school: '111111111111111111111111', teacher: '222222222222222222222222', child: '333333333333333333333333', enrollment: '444444444444444444444444', program: '555555555555555555555555', level: '666666666666666666666666' };
const result = records => ({ select: () => ({ lean: async () => records }) });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

function handler(state) {
  const User = {
    findOne(query) { state.teacherQuery = query; return { select: () => ({ lean: async () => state.teacher }) }; },
    find(query) { state.childQuery = query; return result(state.children); }
  };
  const Enrollment = { find(query) { state.enrollmentQuery = query; return result(state.enrollments); } };
  const Program = { find(query) { state.programQuery = query; return result(state.programs); } };
  const Level = { find(query) { state.levelQuery = query; return result(state.levels); } };
  const original = Module._load;
  Module._load = function(name, parent, isMain) {
    if (name === '../models/User') return User;
    if (name === '../models/Class' || name === '../models/Report' || name === '../models/School') return {};
    if (name === '../models/Enrollment') return Enrollment;
    if (name === '../models/Program') return Program;
    if (name === '../models/Level') return Level;
    if (name === '../middleware/auth') return { protect: (_q, _s, next) => next(), authorize: () => (_q, _s, next) => next() };
    if (name === '../middleware/lifecycleAuthorization') return { requireActiveOrganization: (_q, _s, next) => next() };
    if (name === '../utils/logger') return { logger: { info() {}, error() {} } };
    if (name === '../services/emailService') return { sendTeacherWelcomeEmail: async () => ({}) };
    return original.call(this, name, parent, isMain);
  };
  try {
    const routePath = path.join(__dirname, '../routes/teachers.js');
    delete require.cache[require.resolve(routePath)];
    const router = require(routePath);
    return router.stack.find(layer => layer.route?.path === '/me/individual-enrollments').route.stack.at(-1).handle;
  } finally { Module._load = original; }
}

function fixture() {
  return {
    teacher: { _id: ids.teacher, schoolId: ids.school },
    enrollments: [{ _id: ids.enrollment, schoolId: ids.school, childId: ids.child, programId: ids.program, currentLevelId: ids.level, status: 'active', startDate: new Date('2026-01-01') }],
    children: [{ _id: ids.child, firstName: 'Leo', lastName: 'Demo' }],
    programs: [{ _id: ids.program, name: 'Swimming' }],
    levels: [{ _id: ids.level, name: 'Foundation', programId: ids.program }]
  };
}

test('uses authenticated tenant and teacher with a date-effective staff assignment query', async () => {
  const state = fixture(); const run = handler(state); const res = response();
  await run({ user: { _id: ids.teacher, schoolId: ids.school, role: 'teacher' }, query: { scheduledAt: '2026-10-11T10:00:00.000Z', schoolId: 'foreign', teacherId: 'foreign' } }, res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.data.length, 1); assert.equal(String(res.body.data[0]._id), ids.enrollment);
  assert.equal(state.enrollmentQuery.schoolId, ids.school);
  assert.equal(state.enrollmentQuery.staffAssignments.$elemMatch.staffId, ids.teacher);
  assert.equal(state.enrollmentQuery.status, 'active');
  assert.equal(state.childQuery.schoolId, ids.school); assert.equal(state.programQuery.schoolId, ids.school); assert.equal(state.levelQuery.schoolId, ids.school);
});

test('requires a valid lesson date and an active authenticated instructor', async () => {
  const state = fixture(); let run = handler(state); let res = response();
  await run({ user: { _id: ids.teacher, schoolId: ids.school }, query: {} }, res); assert.equal(res.statusCode, 400);
  state.teacher = null; run = handler(state); res = response();
  await run({ user: { _id: ids.teacher, schoolId: ids.school }, query: { scheduledAt: '2026-10-11T10:00:00.000Z' } }, res); assert.equal(res.statusCode, 403);
});

test('fails closed when Program and Level are not a valid same-tenant pair', async () => {
  const state = fixture(); state.levels[0].programId = '777777777777777777777777';
  const run = handler(state); const res = response();
  await run({ user: { _id: ids.teacher, schoolId: ids.school }, query: { scheduledAt: '2026-10-11T10:00:00.000Z' } }, res);
  assert.deepEqual(res.body.data, []);
});
