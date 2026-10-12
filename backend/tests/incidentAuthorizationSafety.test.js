const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'incident-authorization-test-secret';
const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const schoolA = id(1), schoolB = id(2), admin = id(3), teacher = id(4), otherTeacher = id(5), child = id(6), foreignChild = id(7), incidentId = id(8);
const User = require('../models/User');
const Incident = require('../models/IncidentReport');
const lifecyclePath = require.resolve('../middleware/lifecycleAuthorization');
const accessPath = require.resolve('../services/guardianAccessService');
const routesPath = require.resolve('../routes/incidents');
const originalLifecycle = require.cache[lifecyclePath], originalAccess = require.cache[accessPath];
const original = { userFindById: User.findById, userFind: User.find, incidentFindById: Incident.findById, save: Incident.prototype.save, populate: Incident.prototype.populate };
let actor;
require.cache[lifecyclePath] = { id: lifecyclePath, filename: lifecyclePath, loaded: true, exports: { requireActiveOrganization: (_req, _res, next) => next() } };
require.cache[accessPath] = { id: accessPath, filename: accessPath, loaded: true, exports: {
  authorizedParticipants: async () => [], authorizeGuardianParticipant: async () => ({ allowed: false }), eligibleGuardiansForAll: async () => []
} };
User.findById = () => ({ select: async () => ({ ...actor, isActive: true, async save() {} }) });
delete require.cache[routesPath];
const app = express(); app.use(express.json()); app.use('/api/incidents', require('../routes/incidents'));

function auth(nextActor) {
  actor = nextActor;
  return jwt.sign({ id: String(nextActor._id) }, process.env.JWT_SECRET);
}
function row(overrides = {}) {
  return {
    _id: incidentId, schoolId: schoolA, reportedBy: teacher, status: 'reported', isLocked: false,
    studentsInvolved: [{ studentId: child }], parentNotifications: [], attachments: [], editHistory: [],
    saveCount: 0, deleteCount: 0,
    async save() { this.saveCount += 1; }, async deleteOne() { this.deleteCount += 1; }, async populate() { return this; },
    ...overrides
  };
}
function participantQuery(rows) {
  return { select() { return this; }, lean: async () => rows, then(resolve, reject) { return Promise.resolve(rows).then(resolve, reject); } };
}

test.after(() => {
  User.findById = original.userFindById; User.find = original.userFind; Incident.findById = original.incidentFindById;
  Incident.prototype.save = original.save; Incident.prototype.populate = original.populate;
  if (originalLifecycle) require.cache[lifecyclePath] = originalLifecycle; else delete require.cache[lifecyclePath];
  if (originalAccess) require.cache[accessPath] = originalAccess; else delete require.cache[accessPath];
  delete require.cache[routesPath];
});

test('cross-organization administrators cannot mutate incidents and cause zero side effects', async () => {
  const incident = row({ schoolId: schoolB }); Incident.findById = async () => incident;
  const token = auth({ _id: admin, schoolId: schoolA, role: 'school_admin' });
  const cases = [
    ['post', 'notify-parents', {}], ['post', 'resolve', {}], ['post', 'review', {}],
    ['post', 'lock', { lock: true }], ['post', 'media', {}], ['delete', '', {}]
  ];
  for (const [method, suffix, body] of cases) {
    const target = `/api/incidents/${incidentId}${suffix ? `/${suffix}` : ''}`;
    const response = await request(app)[method](target).set('Authorization', 'Bearer ' + token).send(body);
    assert.equal(response.status, 404, target);
  }
  assert.equal(incident.saveCount, 0); assert.equal(incident.deleteCount, 0); assert.equal(incident.parentNotifications.length, 0); assert.equal(incident.attachments.length, 0);
});

test('unrelated teachers cannot notify, resolve, or upload to another teacher incident', async () => {
  const incident = row(); Incident.findById = async () => incident;
  const token = auth({ _id: otherTeacher, schoolId: schoolA, role: 'teacher' });
  for (const suffix of ['notify-parents', 'resolve', 'media']) {
    const response = await request(app).post(`/api/incidents/${incidentId}/${suffix}`).set('Authorization', 'Bearer ' + token).send({});
    assert.equal(response.status, 404, suffix);
  }
  assert.equal(incident.saveCount, 0); assert.equal(incident.parentNotifications.length, 0); assert.equal(incident.attachments.length, 0);
});

test('incident creation rejects inactive or cross-organization participants before writes or notifications', async () => {
  let saves = 0; Incident.prototype.save = async function () { saves += 1; };
  User.find = () => participantQuery([]);
  const token = auth({ _id: admin, schoolId: schoolA, role: 'school_admin' });
  for (const studentId of [child, foreignChild]) {
    const response = await request(app).post('/api/incidents').set('Authorization', 'Bearer ' + token).send({
      occurredAt: new Date().toISOString(), incidentType: 'injury', severity: 'minor', description: 'Valid description', studentsInvolved: [{ studentId }]
    });
    assert.equal(response.status, 400);
  }
  assert.equal(saves, 0);
});

test('incident update rejects invalid participant replacement without changing the incident', async () => {
  const incident = row(); Incident.findById = async () => incident; User.find = () => participantQuery([]);
  const response = await request(app).put(`/api/incidents/${incidentId}`).set('Authorization', 'Bearer ' + auth({ _id: admin, schoolId: schoolA, role: 'school_admin' })).send({ studentsInvolved: [{ studentId: foreignChild }] });
  assert.equal(response.status, 400); assert.equal(incident.saveCount, 0); assert.equal(String(incident.studentsInvolved[0].studentId), String(child));
});

test('authorized incident teacher and administrator retain intended mutation behavior', async () => {
  const teacherIncident = row(); Incident.findById = async () => teacherIncident;
  let response = await request(app).post(`/api/incidents/${incidentId}/resolve`).set('Authorization', 'Bearer ' + auth({ _id: teacher, schoolId: schoolA, role: 'teacher' })).send({ resolutionNotes: 'Completed' });
  assert.equal(response.status, 200); assert.equal(teacherIncident.status, 'resolved'); assert.equal(teacherIncident.saveCount, 1);
  const adminIncident = row(); Incident.findById = async () => adminIncident;
  response = await request(app).post(`/api/incidents/${incidentId}/review`).set('Authorization', 'Bearer ' + auth({ _id: admin, schoolId: schoolA, role: 'school_admin' })).send({ reviewNotes: 'Reviewed' });
  assert.equal(response.status, 200); assert.equal(adminIncident.status, 'under_review'); assert.equal(adminIncident.saveCount, 1);
});

test('super admin mutation requires explicit matching organization scope', async () => {
  const incident = row(); Incident.findById = async () => incident;
  const token = auth({ _id: admin, role: 'super_admin' });
  const missing = await request(app).post(`/api/incidents/${incidentId}/review`).set('Authorization', 'Bearer ' + token).send({});
  assert.equal(missing.status, 400); assert.equal(incident.saveCount, 0);
  const scoped = await request(app).post(`/api/incidents/${incidentId}/review?schoolId=${schoolA}`).set('Authorization', 'Bearer ' + token).send({});
  assert.equal(scoped.status, 200); assert.equal(incident.saveCount, 1);
});
