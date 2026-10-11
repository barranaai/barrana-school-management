const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');

const id = value => String(value).padStart(24, '0');

function harness(options = {}) {
  const schoolId = id(1), otherSchoolId = id(2), enrollmentId = id(3), childId = id(4), teacherId = id(5), secondTeacherId = id(6), assignmentId = id(7);
  const row = {
    _id: enrollmentId, schoolId, childId, programId: id(8), currentLevelId: id(9), currentClassId: null,
    status: options.enrollmentStatus || 'active', startDate: new Date('2026-09-01T00:00:00Z'),
    classAssignments: [], levelHistory: [], statusHistory: [],
    staffAssignments: options.assignments || [], saves: 0,
    async save() { this.saves += 1; }
  };
  const users = new Map([
    [childId, { _id: childId, schoolId, role: 'student', isActive: options.childActive !== false }],
    [teacherId, { _id: teacherId, schoolId, role: 'teacher', isActive: options.teacherActive !== false }],
    [secondTeacherId, { _id: secondTeacherId, schoolId, role: 'teacher', isActive: true }],
    [id(90), { _id: id(90), schoolId: otherSchoolId, role: 'teacher', isActive: true }]
  ]);
  const routes = [];
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false });
  const chain = value => ({ sort: async () => value });
  const Enrollment = {
    findOne(query) {
      if (query.status?.$in) return Promise.resolve(null);
      return Promise.resolve(String(query._id) === enrollmentId && String(query.schoolId) === schoolId ? row : null);
    },
    find() { return chain([]); },
    create: async body => body
  };
  const User = {
    findOne: async query => {
      const user = users.get(String(query._id));
      return user && String(user.schoolId) === String(query.schoolId) && user.role === query.role && (query.isActive === undefined || user.isActive === query.isActive) ? user : null;
    },
    exists: async () => true,
    find: () => ({ select: async () => [] })
  };
  const available = { findOne: async () => ({}), exists: async () => true };
  const dependencies = {
    express: { Router: () => router }, mongoose,
    '../middleware/auth': { protect: (_req, _res, next) => next(), authorize },
    '../middleware/resourceAuthorization': { scopeSchoolId: (user, requested) => user.role === 'super_admin' ? requested : user.schoolId, canAccessStudent: async () => true },
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_req, _res, next) => next() },
    '../models/Enrollment': Enrollment, '../models/User': User, '../models/Program': available,
    '../models/Level': available, '../models/Class': available,
    '../services/deliveryGroupCompatibility': { supportsProgramAndLevel: () => true },
    '../services/enrollmentLifecycleService': require('../services/enrollmentLifecycleService')
  };
  const file = path.resolve(__dirname, '../routes/enrollments.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: { exports: {} }, Date, console, require(name) { assert.ok(dependencies[name], name); return dependencies[name]; } }, { filename: file });

  async function request(method, url, { role = 'school_admin', userSchoolId = schoolId, body = {}, query = {}, params = {} } = {}) {
    const route = routes.find(item => item.method === method && item.url === url);
    assert.ok(route, `${method} ${url}`);
    const req = { user: { _id: id(20), role, schoolId: userSchoolId }, body, query, params: { id: enrollmentId, assignmentId, ...params } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { schoolId, otherSchoolId, enrollmentId, childId, teacherId, secondTeacherId, assignmentId, row, users, request };
}

test('Organization Admin lists, creates and ends an instructor assignment while preserving history', async () => {
  const h = harness();
  let response = await h.request('get', '/:id/staff-assignments', { query: { schoolId: h.schoolId } });
  assert.equal(response.statusCode, 200); assert.deepEqual(response.body.data, []);

  response = await h.request('post', '/:id/staff-assignments', { body: { schoolId: h.schoolId, staffId: h.teacherId, role: 'instructor', effectiveFrom: '2026-09-10', primary: true } });
  assert.equal(response.statusCode, 201); assert.equal(h.row.staffAssignments.length, 1); assert.equal(h.row.staffAssignments[0].primary, true); assert.equal(h.row.saves, 1);

  h.row.staffAssignments[0]._id = h.assignmentId;
  response = await h.request('put', '/:id/staff-assignments/:assignmentId/end', { body: { schoolId: h.schoolId, effectiveTo: '2026-09-20' } });
  assert.equal(response.statusCode, 200); assert.equal(h.row.staffAssignments.length, 1); assert.equal(h.row.staffAssignments[0].status, 'ended');
  assert.equal(h.row.staffAssignments[0].effectiveTo.toISOString(), '2026-09-20T00:00:00.000Z'); assert.equal(h.row.saves, 2);
});

test('multiple instructors are supported and an active primary remains unique', async () => {
  const h = harness({ assignments: [{ _id: id(10), staffId: id(11), role: 'lead', effectiveFrom: new Date('2026-09-01'), primary: true, status: 'active' }] });
  let response = await h.request('post', '/:id/staff-assignments', { body: { schoolId: h.schoolId, staffId: h.teacherId, role: 'support', effectiveFrom: '2026-09-10', primary: false } });
  assert.equal(response.statusCode, 201); assert.equal(h.row.staffAssignments.length, 2);
  response = await h.request('post', '/:id/staff-assignments', { body: { schoolId: h.schoolId, staffId: h.secondTeacherId, role: 'lead', effectiveFrom: '2026-09-10', primary: true } });
  assert.equal(response.statusCode, 409); assert.match(response.body.message, /primary/); assert.equal(h.row.staffAssignments.length, 2);
});

test('duplicate or overlapping instructor assignment is rejected without a write', async () => {
  const h = harness({ assignments: [{ _id: id(10), staffId: id(5), role: 'instructor', effectiveFrom: new Date('2026-09-01'), primary: false, status: 'active' }] });
  const response = await h.request('post', '/:id/staff-assignments', { body: { schoolId: h.schoolId, staffId: h.teacherId, role: 'instructor', effectiveFrom: '2026-09-10', primary: false } });
  assert.equal(response.statusCode, 409); assert.equal(h.row.saves, 0); assert.equal(h.row.staffAssignments.length, 1);
  const history = harness({ assignments: [{ _id: id(10), staffId: id(5), role: 'instructor', effectiveFrom: new Date('2026-09-01'), effectiveTo: new Date('2026-09-20'), primary: false, status: 'ended' }] });
  const overlap = await history.request('post', '/:id/staff-assignments', { body: { schoolId: history.schoolId, staffId: history.teacherId, role: 'instructor', effectiveFrom: '2026-09-19', primary: false } });
  assert.equal(overlap.statusCode, 409); assert.equal(history.row.saves, 0);
});

test('cross-tenant, inactive and invalid instructors are rejected', async () => {
  for (const setup of [
    h => ({ staffId: id(90), h }),
    h => { h.users.get(h.teacherId).isActive = false; return { staffId: h.teacherId, h }; },
    h => ({ staffId: 'invalid', h })
  ]) {
    const initial = harness(); const { staffId, h } = setup(initial);
    const response = await h.request('post', '/:id/staff-assignments', { body: { schoolId: h.schoolId, staffId, role: 'instructor', effectiveFrom: '2026-09-10' } });
    assert.equal(response.statusCode, 400); assert.equal(h.row.saves, 0);
  }
});

test('inactive participant, inactive Enrollment and invalid assignment dates are rejected', async () => {
  const inactiveChild = harness({ childActive: false });
  let response = await inactiveChild.request('post', '/:id/staff-assignments', { body: { schoolId: inactiveChild.schoolId, staffId: inactiveChild.teacherId, role: 'instructor', effectiveFrom: '2026-09-10' } });
  assert.equal(response.statusCode, 409);
  const inactiveEnrollment = harness({ enrollmentStatus: 'paused' });
  response = await inactiveEnrollment.request('post', '/:id/staff-assignments', { body: { schoolId: inactiveEnrollment.schoolId, staffId: inactiveEnrollment.teacherId, role: 'instructor', effectiveFrom: '2026-09-10' } });
  assert.equal(response.statusCode, 409);
  for (const date of ['invalid', '2026-08-31']) {
    const h = harness(); response = await h.request('post', '/:id/staff-assignments', { body: { schoolId: h.schoolId, staffId: h.teacherId, role: 'instructor', effectiveFrom: date } });
    assert.equal(response.statusCode, 400); assert.equal(h.row.saves, 0);
  }
});

test('ending validates the date and never removes the historical assignment', async () => {
  for (const effectiveTo of ['invalid', '2026-09-01']) {
    const h = harness({ assignments: [{ _id: id(7), staffId: id(5), role: 'instructor', effectiveFrom: new Date('2026-09-01'), primary: false, status: 'active' }] });
    const response = await h.request('put', '/:id/staff-assignments/:assignmentId/end', { body: { schoolId: h.schoolId, effectiveTo } });
    assert.equal(response.statusCode, 400); assert.equal(h.row.staffAssignments.length, 1); assert.equal(h.row.staffAssignments[0].status, 'active'); assert.equal(h.row.saves, 0);
  }
});

test('unauthorized roles and cross-tenant Enrollment access are blocked', async () => {
  for (const role of ['teacher', 'parent']) {
    const h = harness(); const response = await h.request('post', '/:id/staff-assignments', { role, body: { schoolId: h.schoolId, staffId: h.teacherId, role: 'instructor', effectiveFrom: '2026-09-10' } });
    assert.equal(response.statusCode, 403); assert.equal(h.row.saves, 0);
  }
  const h = harness();
  const foreign = await h.request('post', '/:id/staff-assignments', { userSchoolId: h.otherSchoolId, body: { schoolId: h.otherSchoolId, staffId: h.teacherId, role: 'instructor', effectiveFrom: '2026-09-10' } });
  assert.equal(foreign.statusCode, 404); assert.equal(h.row.saves, 0);
  const unscoped = await h.request('get', '/:id/staff-assignments', { role: 'super_admin' });
  assert.equal(unscoped.statusCode, 404);
});
