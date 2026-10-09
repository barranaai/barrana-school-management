const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');

const id = value => String(value).padStart(24, '0');

function harness(options = {}) {
  const schoolId = id(1), childId = id(2), programId = id(3), enrollmentId = id(4);
  const row = {
    _id: enrollmentId, schoolId, childId, programId, currentLevelId: id(5), currentClassId: id(6),
    status: options.status || 'active', startDate: new Date('2026-01-01'), endDate: null,
    statusHistory: [{ status: 'active', changedAt: new Date('2026-01-01'), changedBy: id(7) }],
    levelHistory: [{ levelId: id(5), effectiveFrom: new Date('2026-01-01'), changedBy: id(7) }],
    classAssignments: [{ classId: id(6), effectiveFrom: new Date('2026-01-01'), status: 'active', assignedBy: id(7) }],
    staffAssignments: [{ staffId: id(7), role: 'trainer', effectiveFrom: new Date('2026-01-01'), status: 'active' }],
    async save() { this.saves = (this.saves || 0) + 1; }
  };
  const state = { conflict: options.conflict || null, created: [], row };
  const routes = [];
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false });
  const Enrollment = {
    async findOne(query) {
      if (query.status?.$in) return state.conflict;
      return String(query._id) === enrollmentId && String(query.schoolId) === schoolId ? row : null;
    },
    async create(body) { const created = { _id: id(20), ...body }; state.created.push(created); return created; }
  };
  const available = { findOne: async () => ({ _id: id(30), isActive: true }), exists: async () => true };
  const dependencies = {
    express: { Router: () => router }, mongoose,
    '../middleware/auth': { protect: (_req, _res, next) => next(), authorize },
    '../middleware/resourceAuthorization': { scopeSchoolId: user => user.schoolId, canAccessStudent: async () => true },
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_req, _res, next) => next() },
    '../models/Enrollment': Enrollment, '../models/User': available, '../models/Program': available,
    '../models/Level': available, '../models/Class': available,
    '../services/deliveryGroupCompatibility': { supportsProgramAndLevel: () => true },
    '../services/enrollmentLifecycleService': require('../services/enrollmentLifecycleService')
  };
  const file = path.resolve(__dirname, '../routes/enrollments.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module: { exports: {} }, Date, console,
    require(name) { assert.ok(dependencies[name], name); return dependencies[name]; }
  }, { filename: file });
  async function request(method, url, { role = 'school_admin', userSchoolId = schoolId, body = {}, query = {}, params = {} } = {}) {
    const route = routes.find(item => item.method === method && item.url === url);
    assert.ok(route, `${method} ${url}`);
    const req = { user: { _id: id(7), role, schoolId: userSchoolId }, body, query, params: { id: enrollmentId, ...params } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    for (const handler of route.handlers) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  }
  return { schoolId, childId, programId, enrollmentId, state, request };
}

test('organization admin may pause and resume the same enrollment while preserving history', async () => {
  const h = harness();
  let response = await h.request('put', '/:id', { body: { schoolId: h.schoolId, status: 'paused', reason: 'Family break' } });
  assert.equal(response.statusCode, 200);
  assert.equal(h.state.row.status, 'paused');
  response = await h.request('put', '/:id', { body: { schoolId: h.schoolId, status: 'active', reason: 'Returned' } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(h.state.row.statusHistory.map(item => item.status), ['active', 'paused', 'active']);
});

test('withdrawal preserves the old period and returning creates a separate enrollment', async () => {
  const h = harness();
  const oldLevelHistory = h.state.row.levelHistory;
  const response = await h.request('delete', '/:id', { body: { schoolId: h.schoolId, reason: 'Leaving' } });
  assert.equal(response.statusCode, 200);
  assert.equal(h.state.row.status, 'withdrawn');
  assert.equal(h.state.row.currentLevelId, null);
  assert.equal(oldLevelHistory.length, 1);
  const blocked = await h.request('put', '/:id', { body: { schoolId: h.schoolId, status: 'active' } });
  assert.equal(blocked.statusCode, 409);
  const returned = await h.request('post', '/', { body: { schoolId: h.schoolId, childId: h.childId, programId: h.programId, currentLevelId: id(5), startDate: '2026-09-01', status: 'active' } });
  assert.equal(returned.statusCode, 201);
  assert.notEqual(String(returned.body.data._id), h.enrollmentId);
  assert.equal(h.state.row.status, 'withdrawn');
});

test('conflicting ongoing enrollment is rejected but a different Program is legitimate', async () => {
  const conflict = { _id: id(40), status: 'paused' };
  const h = harness({ conflict });
  let response = await h.request('post', '/', { body: { schoolId: h.schoolId, childId: h.childId, programId: h.programId, currentLevelId: id(5), startDate: '2026-09-01', status: 'active' } });
  assert.equal(response.statusCode, 409);
  assert.equal(h.state.created.length, 0);
  h.state.conflict = null;
  response = await h.request('post', '/', { body: { schoolId: h.schoolId, childId: h.childId, programId: id(99), currentLevelId: id(98), startDate: '2026-09-01', status: 'active' } });
  assert.equal(response.statusCode, 201);
  assert.equal(h.state.created.length, 1);
});

test('teacher and parent cannot manage enrollments, and Super Admin must provide organization context', async () => {
  const h = harness();
  for (const role of ['teacher', 'parent']) {
    const response = await h.request('post', '/', { role, body: { schoolId: h.schoolId, childId: h.childId, programId: h.programId } });
    assert.equal(response.statusCode, 403);
  }
  const unscoped = await h.request('post', '/', { role: 'super_admin', userSchoolId: undefined, body: { childId: h.childId, programId: h.programId } });
  assert.equal(unscoped.statusCode, 400);
});

test('cross-tenant enrollment updates fail safely with no write', async () => {
  const h = harness();
  const response = await h.request('put', '/:id', { userSchoolId: id(90), body: { schoolId: id(90), status: 'paused' } });
  assert.equal(response.statusCode, 404);
  assert.equal(h.state.row.saves || 0, 0);
});
