const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const id = n => String(n).padStart(24, '0');
function fixture(change = () => {}) {
  const schoolId = id(1), enrollmentId = id(2), currentClassId = id(3), nextClassId = id(4);
  const row = {
    _id: enrollmentId, schoolId, childId: id(5), programId: id(6), currentLevelId: id(7),
    currentClassId, status: 'active', startDate: new Date('2026-09-01T00:00:00Z'),
    classAssignments: [{ classId: currentClassId, effectiveFrom: new Date('2026-09-01T00:00:00Z'), status: 'active', assignedBy: id(8) }],
    levelHistory: [], statusHistory: [], staffAssignments: [],
    saves: 0, async save() { this.saves += 1; }
  };
  const state = {
    schoolId, enrollmentId, currentClassId, nextClassId, row, enrollmentExists: true,
    activeClasses: new Set([currentClassId, nextClassId]),
    classSchools: new Map([[currentClassId, schoolId], [nextClassId, schoolId]])
  };
  change(state);
  const routes = [];
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const Class = { findOne: async query => {
    const classId = String(query._id);
    return state.activeClasses.has(classId) && state.classSchools.get(classId) === String(query.schoolId) && query.isActive === true && query.status === 'active'
      ? { _id: query._id, schoolId: query.schoolId, isActive: true, status: 'active' }
      : null;
  } };
  const Enrollment = { findOne: async query => state.enrollmentExists && String(query._id) === enrollmentId && String(query.schoolId) === schoolId ? row : null };
  const always = { findOne: async () => ({}), exists: async () => true };
  const deps = {
    express: { Router: () => router }, mongoose,
    '../middleware/auth': { protect() {}, authorize: () => (_req, _res, next) => next() },
    '../middleware/resourceAuthorization': { scopeSchoolId: user => user.schoolId, canAccessStudent: async () => true },
    '../models/Enrollment': Enrollment, '../models/User': always, '../models/Program': always,
    '../models/Level': always, '../models/Class': Class
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/enrollments.js'), 'utf8'), { module: { exports: {} }, require: name => { assert.ok(deps[name], name); return deps[name]; } });
  return {
    state,
    async call(url = '/:id/class-assignment', body = { schoolId, classId: nextClassId, effectiveDate: '2026-09-15', reason: 'Schedule change' }) {
      const route = routes.find(item => item.method === 'put' && item.url === url);
      const req = { user: { _id: id(8), role: 'school_admin', schoolId }, params: { id: enrollmentId }, query: {}, body };
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
      return res;
    }
  };
}

test('reassigns an active enrollment atomically within the same document and preserves history', async () => {
  const f = fixture();
  const response = await f.call();
  assert.equal(response.statusCode, 200);
  assert.equal(f.state.row.saves, 1);
  assert.equal(String(f.state.row.currentClassId), f.state.nextClassId);
  assert.equal(f.state.row.classAssignments.length, 2);
  assert.equal(f.state.row.classAssignments[0].status, 'ended');
  assert.equal(f.state.row.classAssignments[0].effectiveTo.toISOString(), '2026-09-15T00:00:00.000Z');
  assert.equal(f.state.row.classAssignments[1].status, 'active');
  assert.equal(String(f.state.row.classAssignments[1].classId), f.state.nextClassId);
});

test('rejects a class owned by another tenant with zero writes', async () => {
  const foreignClassId = id(99);
  const f = fixture(state => {
    state.activeClasses.add(foreignClassId);
    state.classSchools.set(foreignClassId, id(98));
  });
  const response = await f.call('/:id/class-assignment', { schoolId: f.state.schoolId, classId: foreignClassId, effectiveDate: '2026-09-15' });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /unavailable/);
  assert.equal(f.state.row.saves, 0);
});

test('rejects missing enrollment with zero writes', async () => {
  const f = fixture(state => { state.enrollmentExists = false; });
  const response = await f.call();
  assert.equal(response.statusCode, 404);
  assert.equal(f.state.row.saves, 0);
});

for (const status of ['completed', 'withdrawn', 'cancelled']) {
  test('rejects terminal enrollment status ' + status, async () => {
    const f = fixture(state => { state.row.status = status; });
    const response = await f.call();
    assert.equal(response.statusCode, 409);
    assert.equal(f.state.row.saves, 0);
  });
}

test('rejects invalid and pre-enrollment effective dates', async () => {
  for (const effectiveDate of ['not-a-date', '2026-08-31']) {
    const f = fixture();
    const response = await f.call('/:id/class-assignment', { schoolId: f.state.schoolId, classId: f.state.nextClassId, effectiveDate });
    assert.equal(response.statusCode, 400);
    assert.equal(f.state.row.saves, 0);
  }
});

test('rejects duplicate current class and inconsistent overlapping history', async () => {
  const duplicate = fixture();
  let response = await duplicate.call('/:id/class-assignment', { schoolId: duplicate.state.schoolId, classId: duplicate.state.currentClassId, effectiveDate: '2026-09-15' });
  assert.equal(response.statusCode, 409);
  assert.equal(duplicate.state.row.saves, 0);

  const overlap = fixture(state => {
    state.row.classAssignments.unshift({ classId: id(10), effectiveFrom: new Date('2026-08-15'), status: 'active', assignedBy: id(8) });
  });
  response = await overlap.call();
  assert.equal(response.statusCode, 409);
  assert.equal(overlap.state.row.saves, 0);
});

test('generic enrollment update cannot bypass the class-assignment lifecycle', async () => {
  const f = fixture();
  const response = await f.call('/:id', { schoolId: f.state.schoolId, currentClassId: f.state.nextClassId });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /class-assignment operation/);
  assert.equal(f.state.row.saves, 0);
});
