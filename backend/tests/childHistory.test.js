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

function harness({ empty = false, participationStatus = 'active', sessionStatus = 'completed', multipleContexts = false, individual = false } = {}) {
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
  const participation = { _id: '131313131313131313131313', schoolId: schoolA, childId, deliveredSessionId: '141414141414141414141414', status: participationStatus };
  const session = {
    _id: '141414141414141414141414', schoolId: schoolA, deliveredBy: { _id: teacherId, firstName: 'Morgan', lastName: 'Coach' },
    title: 'Safe Entry', scheduledAt: new Date('2026-09-05T09:00:00Z'), status: sessionStatus,
    programId: enrollment.programId, levelId: enrollment.currentLevelId,
    deliveryMode: individual ? 'individual' : 'group', classId: individual ? null : enrollment.currentClassId
  };
  const progress = {
    _id: '151515151515151515151515', schoolId: schoolA, childParticipationId: participation._id,
    createdAt: new Date('2026-09-05T10:00:00Z'), updatedAt: new Date('2026-09-05T10:00:00Z'), overallStatus: 'partially_achieved',
    objectiveResults: [
      { objectiveId: '161616161616161616161616', title: 'Safe entry', status: 'achieved' },
      { objectiveId: '191919191919191919191919', title: 'Floating', status: 'not_observed' }
    ], parameterResults: [],
    observations: 'Calm entry', recommendations: 'Practise floating', revisionNumber: 2,
    revisions: [{ revisionNumber: 1 }]
  };
  const secondProgram = { _id: '202020202020202020202020', name: 'Piano' };
  const secondLevel = { _id: '212121212121212121212121', name: 'Foundation' };
  const secondParticipation = { _id: '222222222222222222222223', schoolId: schoolA, childId, deliveredSessionId: '232323232323232323232323', status: 'active' };
  const secondSession = { ...session, _id: secondParticipation.deliveredSessionId, title: 'Keyboard posture', scheduledAt: new Date('2026-09-10T09:00:00Z'), programId: secondProgram, levelId: secondLevel };
  const secondProgress = { ...progress, _id: '242424242424242424242424', childParticipationId: secondParticipation._id, createdAt: new Date('2026-09-10T10:00:00Z'), updatedAt: new Date('2026-09-10T10:00:00Z'), revisions: [], revisionNumber: 1 };
  const participations = multipleContexts ? [participation, secondParticipation] : [participation];
  const sessions = multipleContexts ? [session, secondSession] : [session];
  const progresses = multipleContexts ? [progress, secondProgress] : [progress];
  const report = {
    _id: '171717171717171717171717', schoolId: schoolA, studentId: childId, teacherId: session.deliveredBy,
    templateId: { _id: '181818181818181818181818', name: 'Progress Report' }, title: 'September progress', reportType: 'progress', status: 'approved',
    reportPeriod: { startDate: new Date('2026-09-01T00:00:00Z'), endDate: new Date('2026-09-08T00:00:00Z') },
    finalizedSnapshot: { finalizedAt: new Date('2026-09-08T12:00:00Z') }, approvals: [], createdAt: new Date('2026-09-08T00:00:00Z')
  };
  const observed = { childQuery: null, sessionQuery: null, reportQuery: null, exportCalls: [] };
  const models = {
    '../models/User': { findOne(query) { observed.childQuery = query; return chain(String(query.schoolId) === schoolA && query._id === childId ? child : null); } },
    '../models/School': { findOne(query) { return chain(String(query._id) === schoolA ? { _id: schoolA, name: 'Kidsible Academy' } : null); } },
    '../models/Enrollment': { find() { return chain(empty ? [] : [enrollment]); } },
    '../models/ChildParticipation': { find() { return chain(empty ? [] : participations); } },
    '../models/DeliveredSession': { find(query) { observed.sessionQuery = query; const allowed = !query.deliveredBy || String(query.deliveredBy) === teacherId; return chain(empty || !allowed ? [] : sessions); } },
    '../models/Progress': { find(query) { return chain(empty || !query.childParticipationId.$in.length ? [] : progresses); } },
    '../models/Report': { find(query) { observed.reportQuery = query; const allowed = !query.teacherId || String(query.teacherId) === teacherId; return chain(empty || !allowed ? [] : [report]); } }
  };
  const router = loadRoute({
    ...models, '../middleware/auth': auth,
    '../middleware/resourceAuthorization': {
      scopeSchoolId(user, requested) { return user.role === 'super_admin' ? requested : String(user.schoolId); },
      async canAccessStudent(user, row) { return user.role !== 'teacher' || (String(user._id) === teacherId && String(row.schoolId) === schoolA); }
    },
    '../services/participantHistoryExport': { async buildParticipantHistoryExport(row, scopedSchool, organization) { observed.exportCalls.push({ row, scopedSchool, organization }); return { schema: 'kidsible.participant-history.v1', participant: { id: row._id } }; } },
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
  assert.equal(response.body.data.development.timeline.length, 1);
  assert.equal(response.body.data.development.timeline[0].priorRevisionCount, 1);
  assert.equal(response.body.data.development.contexts[0].program.name, 'Learn-to-Swim');
  assert.equal(response.body.data.development.contexts[0].level.name, 'Water Confidence');
  assert.equal(response.body.data.development.contexts[0].objectiveStatusCounts.achieved, 1);
  assert.equal(response.body.data.development.contexts[0].objectiveStatusCounts.not_observed, 1);
  assert.equal(response.body.data.development.contexts[0].objectiveStatusCounts.not_achieved, 0);
});

test('empty child history returns identity and an empty timeline', async () => {
  const response = await request(harness({ empty: true }).app).get(`/${childId}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.currentEnrollments, []);
  assert.deepEqual(response.body.data.events, []);
  assert.deepEqual(response.body.data.development, { contexts: [], timeline: [] });
});

for (const options of [{ participationStatus: 'absent' }, { participationStatus: 'excused' }, { participationStatus: 'cancelled' }, { sessionStatus: 'cancelled' }]) {
  test(`historical Progress remains visible but is excluded from development evidence: ${JSON.stringify(options)}`, async () => {
    const response = await request(harness(options).app).get(`/${childId}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.development, { contexts: [], timeline: [] });
    const progressEvent = response.body.data.events.find(item => item.type === 'progress');
    assert.ok(progressEvent);
    assert.equal(progressEvent.details.participationStatus, options.participationStatus || 'active');
    assert.equal(progressEvent.details.sessionStatus, options.sessionStatus || 'completed');
    assert.equal(progressEvent.details.observations, 'Calm entry');
    assert.equal(progressEvent.details.objectiveResults[0].status, 'achieved');
  });
}

test('multiple Programs and Levels remain separate and chronological', async () => {
  const response = await request(harness({ multipleContexts: true }).app).get(`/${childId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.development.contexts.length, 2);
  assert.deepEqual(response.body.data.development.contexts.map(item => item.program.name), ['Learn-to-Swim', 'Piano']);
  assert.deepEqual(response.body.data.development.timeline.map(item => item.program.name), ['Learn-to-Swim', 'Piano']);
});

test('authorized teacher sees only sessions and reports already scoped to that teacher', async () => {
  const h = harness();
  const response = await request(h.app).get(`/${childId}`).set('x-role', 'teacher').set('x-user', teacherId);
  assert.equal(response.status, 200);
  assert.equal(String(h.observed.sessionQuery.deliveredBy), teacherId);
  assert.equal(String(h.observed.reportQuery.teacherId), teacherId);
  assert.ok(response.body.data.events.some(item => item.type === 'progress'));
});

test('individual lesson appears only through the designated child participation with attribution and context', async () => {
  const response = await request(harness({ individual: true }).app).get(`/${childId}`);
  assert.equal(response.status, 200);
  const session = response.body.data.events.find(item => item.type === 'session');
  assert.equal(session.details.deliveryMode, 'individual');
  assert.equal(session.details.group.name, 'Individual Lesson');
  assert.equal(session.details.instructor.name, 'Morgan Coach');
  assert.equal(session.details.program.name, 'Learn-to-Swim');
  assert.equal(session.details.level.name, 'Water Confidence');
  assert.equal(response.body.data.development.timeline[0].group.name, 'Individual Lesson');
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

test('organization admin can download only its participant export', async () => {
  const h = harness();
  const response = await request(h.app).get(`/${childId}/export`);
  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.match(response.headers['content-disposition'], /attachment/);
  assert.equal(response.headers['cache-control'], 'private, no-store');
  assert.equal(h.observed.exportCalls.length, 1);
  assert.equal(String(h.observed.exportCalls[0].scopedSchool), schoolA);
});

test('teacher and parent cannot use the organizational export', async () => {
  for (const role of ['teacher', 'parent']) {
    const response = await request(harness().app).get(`/${childId}/export`).set('x-role', role);
    assert.equal(response.status, 403);
  }
});

test('super admin export requires explicit organization context and rejects cross-tenant child', async () => {
  const missing = await request(harness().app).get(`/${childId}/export`).set('x-role', 'super_admin');
  assert.equal(missing.status, 400);
  const allowed = await request(harness().app).get(`/${childId}/export?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(allowed.status, 200);
  const foreign = await request(harness().app).get(`/${childId}/export?schoolId=${schoolB}`).set('x-role', 'super_admin');
  assert.equal(foreign.status, 404);
});
