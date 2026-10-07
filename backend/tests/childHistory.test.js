const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const childId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teacherId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const otherTeacherId = 'cccccccccccccccccccccccc';

const chain = value => {
  const query = {
    select() { return query; }, populate() { return query; }, sort() { return query; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
  return query;
};

const auth = {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = { _id: req.get('x-user') || teacherId, role, schoolId: role === 'super_admin' ? undefined : schoolA };
    next();
  },
  authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403); }
};

function loadRoute(stubs) {
  const resolved = require.resolve(path.join('..', 'routes', 'childHistory.js'));
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

function harness({ empty = false } = {}) {
  const child = { _id: childId, schoolId: schoolA, role: 'student', firstName: 'Maya', lastName: 'Demo', studentId: 'P-001', isActive: true };
  const enrollment = {
    _id: 'dddddddddddddddddddddddd', schoolId: schoolA, childId, status: 'active', startDate: new Date('2026-09-01T00:00:00Z'),
    programId: { _id: 'eeeeeeeeeeeeeeeeeeeeeeee', name: 'Learn-to-Swim' },
    currentLevelId: { _id: 'ffffffffffffffffffffffff', name: 'Water Confidence' },
    currentClassId: { _id: '121212121212121212121212', name: 'Saturday Group' },
    statusHistory: [{ status: 'active', changedAt: new Date('2026-09-01T00:00:00Z') }],
    levelHistory: [{ levelId: { _id: 'ffffffffffffffffffffffff', name: 'Water Confidence' }, effectiveFrom: new Date('2026-09-01T00:00:00Z') }],
    classAssignments: [{ classId: { _id: '121212121212121212121212', name: 'Saturday Group' }, effectiveFrom: new Date('2026-09-01T00:00:00Z'), status: 'active' }]
  };
  const participation = { _id: '131313131313131313131313', schoolId: schoolA, childId, deliveredSessionId: '141414141414141414141414', status: 'active' };
  const session = {
    _id: '141414141414141414141414', schoolId: schoolA, deliveredBy: { _id: teacherId, firstName: 'Morgan', lastName: 'Coach' },
    title: 'Safe Entry', scheduledAt: new Date('2026-09-05T09:00:00Z'), status: 'completed',
    programId: enrollment.programId, levelId: enrollment.currentLevelId, classId: enrollment.currentClassId
  };
  const progress = {
    _id: '151515151515151515151515', schoolId: schoolA, childParticipationId: participation._id,
    createdAt: new Date('2026-09-05T10:00:00Z'), updatedAt: new Date('2026-09-05T10:00:00Z'), overallStatus: 'partially_achieved',
    objectiveResults: [{ objectiveId: '161616161616161616161616', title: 'Safe entry', status: 'achieved' }], parameterResults: [],
    observations: 'Calm entry', recommendations: 'Practise floating'
  };
  const report = {
    _id: '171717171717171717171717', schoolId: schoolA, studentId: childId, teacherId: session.deliveredBy,
    templateId: { _id: '181818181818181818181818', name: 'Progress Report' }, title: 'September progress', reportType: 'progress', status: 'approved',
    reportPeriod: { startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2026-09-08T00:00:00Z') },
    finalizedSnapshot: { finalizedAt: new Date('2026-09-08T12:00:00Z') }, approvals: [], createdAt: new Date('2026-09-08T00:00:00Z')
  };
  const observed = { childQuery: null, sessionQuery: null, reportQuery: null };
  const models = {
    '../models/User': { findOne(query) { observed.childQuery = query; return chain(String(query.schoolId) === schoolA && query._id === childId ? child : null); } },
    '../models/Enrollment': { find() { return chain(empty ? [] : [enrollment]); } },
    '../models/ChildParticipation': { find() { return chain(empty ? [] : [participation]); } },
    '../models/DeliveredSession': { find(query) { observed.sessionQuery = query; const allowed = !query.deliveredBy || String(query.deliveredBy) === teacherId; return chain(empty || !allowed ? [] : [session]); } },
    '../models/Progress': { find(query) { return chain(empty || !query.childParticipationId.$in.length ? [] : [progress]); } },
    '../models/Report': { find(query) { observed.reportQuery = query; const allowed = !query.teacherId || String(query.teacherId) === teacherId; return chain(empty || !allowed ? [] : [report]); } }
  };
  const router = loadRoute({
    ...models, '../middleware/auth': auth,
    '../middleware/resourceAuthorization': {
      scopeSchoolId(user, requested) { return user.role === 'super_admin' ? requested : String(user.schoolId); },
      async canAccessStudent(user, row) { return user.role !== 'teacher' || (String(user._id) === teacherId && String(row.schoolId) === schoolA); }
    },
    '../utils/logger': { logger: { error() {} } }
  });
  const app = express(); app.use(express.json()); app.use(router);
  return { app, observed };
}

test('organization admin receives aggregated chronological child history', async () => {
  const response = await request(harness().app).get(`/${childId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.child.firstName, 'Maya');
  assert.equal(response.body.data.currentEnrollments.length, 1);
  for (const type of ['enrollment', 'level', 'group', 'session', 'progress', 'report']) {
    assert.ok(response.body.data.events.some(item => item.type === type), `missing ${type}`);
  }
  assert.deepEqual([...response.body.data.events].map(item => item.date), [...response.body.data.events].map(item => item.date).sort().reverse());
});

test('empty child history returns identity and an empty timeline', async () => {
  const response = await request(harness({ empty: true }).app).get(`/${childId}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.currentEnrollments, []);
  assert.deepEqual(response.body.data.events, []);
});

test('authorized teacher sees only sessions and reports already scoped to that teacher', async () => {
  const h = harness();
  const response = await request(h.app).get(`/${childId}`).set('x-role', 'teacher').set('x-user', teacherId);
  assert.equal(response.status, 200);
  assert.equal(String(h.observed.sessionQuery.deliveredBy), teacherId);
  assert.equal(String(h.observed.reportQuery.teacherId), teacherId);
  assert.ok(response.body.data.events.some(item => item.type === 'progress'));
});

test('unauthorized teacher cannot retrieve child history', async () => {
  const response = await request(harness().app).get(`/${childId}`).set('x-role', 'teacher').set('x-user', otherTeacherId);
  assert.equal(response.status, 404);
});

test('parent is not granted the staff history endpoint', async () => {
  const response = await request(harness().app).get(`/${childId}`).set('x-role', 'parent');
  assert.equal(response.status, 403);
});

test('super admin requires explicit organization context', async () => {
  const missing = await request(harness().app).get(`/${childId}`).set('x-role', 'super_admin');
  assert.equal(missing.status, 400);
  const scoped = await request(harness().app).get(`/${childId}?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(scoped.status, 200);
});

test('cross-tenant organization context cannot retrieve a participant', async () => {
  const response = await request(harness().app).get(`/${childId}?schoolId=${schoolB}`).set('x-role', 'super_admin');
  assert.equal(response.status, 404);
});
