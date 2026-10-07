const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const ProgressModel = require('../models/Progress');

const id = n => String(n).padStart(24, '0');
const school = id(1), otherSchool = id(2), teacher = id(3), otherTeacher = id(4);
const progressId = id(5), participationId = id(6), sessionId = id(7), plannedId = id(8);
const roadmapId = id(9), programId = id(10), levelId = id(11), objectiveId = id(12);

const clone = value => JSON.parse(JSON.stringify(value));
const query = value => ({
  select() { return this; }, sort() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

function harness({ legacy = false } = {}) {
  const createdAt = new Date('2026-09-19T09:00:00Z');
  let row = {
    _id: progressId, schoolId: school, childParticipationId: participationId,
    objectiveResults: [{ objectiveId, sequence: 1, title: 'Float', status: 'not_observed' }],
    parameterResults: [], observations: 'Original', recommendations: 'Practise',
    overallStatus: 'in_progress', metadata: { source: 'initial' },
    createdBy: teacher, updatedBy: teacher, createdAt, updatedAt: createdAt, __v: 0,
    revisionNumber: 1, revisions: []
  };
  if (legacy) { delete row.revisionNumber; delete row.revisions; }
  const participation = { _id: participationId, schoolId: school, deliveredSessionId: sessionId, status: 'active' };
  const session = { _id: sessionId, schoolId: school, deliveredBy: teacher, plannedSessionId: plannedId, roadmapId, roadmapVersion: 1, status: 'completed', plannedSessionSnapshot: { objectives: [{ objectiveId, sequence: 1, title: 'Float' }] } };
  const planned = { _id: plannedId, roadmapId, roadmapVersion: 1, objectives: [{ _id: objectiveId, sequence: 1, title: 'Float' }] };
  const roadmap = { _id: roadmapId, schoolId: school, programId, levelId, version: 1, status: 'active' };
  const routes = []; const middleware = [];
  const router = { use: (...handlers) => middleware.push(...handlers) };
  for (const method of ['get', 'post', 'put']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers: [...middleware, ...handlers] });
  const matchesVersion = expected => expected && Object.hasOwn(expected, '$exists') ? (row.__v !== undefined) === expected.$exists : row.__v === expected;
  const Progress = {
    find: () => query(row ? [clone(row)] : []),
    findOne: q => query(row && String(q._id) === progressId && String(q.schoolId) === school ? clone(row) : null),
    create: async payload => ({ _id: progressId, __v: 0, ...payload }),
    findOneAndUpdate: async (filter, update) => {
      if (!row || String(filter._id) !== progressId || String(filter.schoolId) !== school || !matchesVersion(filter.__v)) return null;
      row.revisions = row.revisions || [];
      row.revisions.push(clone(update.$push.revisions));
      Object.assign(row, clone(update.$set));
      for (const field of Object.keys(update.$unset || {})) delete row[field];
      row.__v = (row.__v || 0) + update.$inc.__v;
      return clone(row);
    }
  };
  const models = {
    Progress,
    ChildParticipation: { findOne: q => query(String(q.schoolId) === school ? participation : null), find: () => query([participation]) },
    DeliveredSession: { findOne: q => query(String(q.schoolId) === school ? session : null), find: () => query([session]) },
    PlannedSession: { findOne: () => query(planned) },
    Roadmap: { findOne: () => query(roadmap) },
    Requirement: { find: async () => [] }, Parameter: { find: async () => [] }
  };
  const auth = {
    protect(_req, _res, next) { next(); },
    authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
  };
  const deps = { express: { Router: () => router }, mongoose, '../middleware/auth': auth,
    '../middleware/resourceAuthorization': { scopeSchoolId: (user, requested) => user.role === 'super_admin' ? requested : String(user.schoolId) } };
  for (const [name, model] of Object.entries(models)) deps['../models/' + name] = model;
  const file = path.join(__dirname, '../routes/progress.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: { exports: {} }, require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; }, Object, Date, Number, Map, Set }, { filename: file });
  async function call(method, url, { role = 'school_admin', userId = teacher, schoolId = school, requestedSchoolId, body = {} } = {}) {
    const route = routes.find(item => item.method === method && item.url === url); assert.ok(route, `${method} ${url}`);
    const req = { user: { _id: userId, role, schoolId }, params: { id: progressId }, query: requestedSchoolId ? { schoolId: requestedSchoolId } : {}, body };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { call, get row() { return row; } };
}

test('new Progress defaults to revision 1 with empty revisions and keeps its unique identity rule', async () => {
  const doc = new ProgressModel({ schoolId: school, childParticipationId: participationId, createdBy: teacher, updatedBy: teacher });
  await doc.validate();
  assert.equal(doc.revisionNumber, 1); assert.deepEqual(doc.revisions, []);
  const unique = ProgressModel.schema.indexes().find(([fields, options]) => fields.schoolId === 1 && fields.childParticipationId === 1 && options.unique);
  assert.ok(unique);
});

test('edits atomically preserve complete previous states and increment revision and __v', async () => {
  const h = harness();
  const first = await h.call('put', '/:id', { body: { __v: 0, objectiveResults: [{ objectiveId, status: 'achieved' }], observations: 'Second', recommendations: 'Continue', overallStatus: 'achieved', metadata: { source: 'second' } } });
  assert.equal(first.statusCode, 200); assert.equal(first.body.data.revisionNumber, 2); assert.equal(first.body.data.__v, 1);
  assert.equal(h.row.revisions.length, 1); assert.equal(h.row.revisions[0].revisionNumber, 1);
  assert.equal(h.row.revisions[0].observations, 'Original'); assert.deepEqual(h.row.revisions[0].metadata, { source: 'initial' });
  assert.equal(h.row.revisions[0].originallySavedBy, teacher); assert.equal(h.row.revisions[0].supersededBy, teacher);
  const second = await h.call('put', '/:id', { body: { __v: 1, objectiveResults: [{ objectiveId, status: 'partially_achieved' }], observations: 'Third', overallStatus: 'partially_achieved', revisions: [{ observations: 'client injection' }] } });
  assert.equal(second.statusCode, 200); assert.equal(h.row.revisionNumber, 3); assert.equal(h.row.__v, 2);
  assert.deepEqual(h.row.revisions.map(item => item.revisionNumber), [1, 2]);
  assert.deepEqual(h.row.revisions.map(item => item.observations), ['Original', 'Second']);
  assert.equal(h.row.observations, 'Third'); assert.ok(!JSON.stringify(h.row.revisions).includes('client injection'));
});

test('legacy Progress becomes revision-aware on its first successful edit', async () => {
  const h = harness({ legacy: true });
  const response = await h.call('put', '/:id', { body: { __v: 0, objectiveResults: [{ objectiveId, status: 'achieved' }], observations: 'Updated' } });
  assert.equal(response.statusCode, 200); assert.equal(h.row.revisionNumber, 2); assert.equal(h.row.revisions[0].revisionNumber, 1); assert.equal(h.row.revisions[0].observations, 'Original');
});

test('competing edits with the same __v yield one revision and one conflict', async () => {
  const h = harness();
  const body = { __v: 0, objectiveResults: [{ objectiveId, status: 'achieved' }], observations: 'Winner' };
  const [first, second] = await Promise.all([h.call('put', '/:id', { body }), h.call('put', '/:id', { body: { ...body, observations: 'Loser' } })]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
  const conflict = first.statusCode === 409 ? first : second;
  assert.equal(conflict.body.code, 'PROGRESS_REVISION_CONFLICT'); assert.equal(h.row.revisions.length, 1); assert.equal(h.row.revisionNumber, 2);
});

test('revision endpoint is tenant-safe, staff-only, teacher-scoped and newest-first', async () => {
  const h = harness();
  await h.call('put', '/:id', { body: { __v: 0, objectiveResults: [{ objectiveId, status: 'achieved' }], observations: 'Second' } });
  await h.call('put', '/:id', { body: { __v: 1, objectiveResults: [{ objectiveId, status: 'partially_achieved' }], observations: 'Third' } });
  const admin = await h.call('get', '/:id/revisions');
  assert.equal(admin.statusCode, 200); assert.equal(admin.body.data.revisions.map(item => item.revisionNumber).join(','), '2,1');
  assert.equal((await h.call('get', '/:id/revisions', { role: 'teacher' })).statusCode, 200);
  assert.equal((await h.call('get', '/:id/revisions', { role: 'teacher', userId: otherTeacher })).statusCode, 404);
  assert.equal((await h.call('get', '/:id/revisions', { role: 'parent' })).statusCode, 403);
  assert.equal((await h.call('get', '/:id/revisions', { role: 'super_admin' })).statusCode, 404);
  assert.equal((await h.call('get', '/:id/revisions', { role: 'super_admin', requestedSchoolId: school })).statusCode, 200);
  assert.equal((await h.call('get', '/:id/revisions', { role: 'super_admin', requestedSchoolId: otherSchool })).statusCode, 404);
});

test('missing or invalid expected __v is rejected without a revision write', async () => {
  for (const body of [{}, { __v: -1 }, { __v: '0' }, { __v: 1.5 }]) {
    const h = harness(); const response = await h.call('put', '/:id', { body });
    assert.equal(response.statusCode, 400); assert.equal(h.row.revisions.length, 0); assert.equal(h.row.__v, 0);
  }
});
