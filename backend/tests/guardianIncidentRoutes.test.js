const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'guardian-incident-test-secret';
const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const guardianA = id(1), guardianB = id(2), child = id(3), school = id(4);
const User = require('../models/User');
const Incident = require('../models/IncidentReport');
const accessPath = require.resolve('../services/guardianAccessService');
const lifecyclePath = require.resolve('../middleware/lifecycleAuthorization');
const routesPath = require.resolve('../routes/incidents');
const originalAccess = require.cache[accessPath];
const originalLifecycle = require.cache[lifecyclePath];
const originalFindById = User.findById, originalIncidentFind = Incident.findById;
let allowed = true;
require.cache[accessPath] = { id: accessPath, filename: accessPath, loaded: true, exports: {
  authorizedParticipants: async () => [], eligibleGuardiansForAll: async () => [],
  authorizeGuardianParticipant: async (guardian, participantId, permission) => ({ allowed: allowed && String(guardian._id) === String(guardianA) && String(participantId) === String(child) && ['incidents', 'communication'].includes(permission) })
}};
require.cache[lifecyclePath] = { id: lifecyclePath, filename: lifecyclePath, loaded: true, exports: {
  requireActiveOrganization: (_req, _res, next) => next()
}};
delete require.cache[routesPath];
const app = express(); app.use(express.json()); app.use('/api/incidents', require('../routes/incidents'));
const auth = () => { User.findById = () => ({ select: async () => ({ _id: guardianA, schoolId: school, role: 'parent', email: 'guardian@example.test', isActive: true, async save() {} }) }); return jwt.sign({ id: String(guardianA) }, process.env.JWT_SECRET); };
test.after(() => { User.findById = originalFindById; Incident.findById = originalIncidentFind; if (originalAccess) require.cache[accessPath] = originalAccess; else delete require.cache[accessPath]; if (originalLifecycle) require.cache[lifecyclePath] = originalLifecycle; else delete require.cache[lifecyclePath]; delete require.cache[routesPath]; });

function incident() {
  return { _id: id(10), status: 'parent_notified', parentNotifications: [
    { guardianId: guardianA, studentId: child, acknowledged: false },
    { guardianId: guardianB, studentId: child, acknowledged: false }
  ], editHistory: [], async save() {}, async populate() {} };
}

function serializedIncident() {
  const document = new Incident({
    _id: id(10),
    schoolId: school,
    reportNumber: 'INC-GUARDIAN-TEST',
    occurredAt: new Date('2026-01-01T10:00:00.000Z'),
    reportedBy: id(11),
    incidentType: 'injury',
    severity: 'minor',
    description: 'A focused guardian notification persistence test.',
    studentsInvolved: [{ studentId: child }],
    status: 'parent_notified',
    parentNotifications: [
      { guardianId: guardianA, studentId: child, method: 'push', acknowledged: false },
      { guardianId: guardianB, studentId: child, method: 'push', acknowledged: false }
    ]
  });
  return document.toObject();
}

test('guardianId survives incident notification document serialization', () => {
  const row = serializedIncident();
  assert.equal(String(row.parentNotifications[0].guardianId), String(guardianA));
  assert.equal(String(row.parentNotifications[1].guardianId), String(guardianB));
  assert.equal(row.studentsInvolved[0].guardianId, undefined);
});

test('guardian acknowledgement changes only the authenticated guardian notification', async () => {
  const row = incident(); Incident.findById = async () => row; allowed = true;
  const response = await request(app).post('/api/incidents/' + row._id + '/acknowledge').set('Authorization', 'Bearer ' + auth()).send({ notes: 'Reviewed' });
  assert.equal(response.status, 200); assert.equal(row.parentNotifications[0].acknowledged, true); assert.equal(row.parentNotifications[1].acknowledged, false);
});

test('serialized notification still identifies the guardian for acknowledgement after reload', async () => {
  const serialized = serializedIncident();
  const row = { ...serialized, async save() {}, async populate() {} };
  Incident.findById = async () => row; allowed = true;
  const response = await request(app).post('/api/incidents/' + row._id + '/acknowledge').set('Authorization', 'Bearer ' + auth()).send({ notes: 'Reviewed after reload' });
  assert.equal(response.status, 200);
  assert.equal(row.parentNotifications[0].acknowledged, true);
  assert.equal(row.parentNotifications[1].acknowledged, false);
});

test('authorized guardian can acknowledge a legacy email-only notification', async () => {
  const row = { _id: id(10), status: 'parent_notified', parentNotifications: [
    { parentEmail: 'GUARDIAN@example.test', studentId: child, acknowledged: false }
  ], editHistory: [], async save() {}, async populate() {} };
  Incident.findById = async () => row; allowed = true;
  const response = await request(app).post('/api/incidents/' + row._id + '/acknowledge').set('Authorization', 'Bearer ' + auth()).send({ notes: 'Reviewed legacy notification' });
  assert.equal(response.status, 200);
  assert.equal(row.parentNotifications[0].acknowledged, true);
});

test('revoked or permission-denied guardian cannot use legacy email acknowledgement', async () => {
  const row = { _id: id(10), status: 'parent_notified', parentNotifications: [
    { parentEmail: 'guardian@example.test', studentId: child, acknowledged: false }
  ], editHistory: [], async save() {}, async populate() {} };
  Incident.findById = async () => row; allowed = false;
  const response = await request(app).post('/api/incidents/' + row._id + '/acknowledge').set('Authorization', 'Bearer ' + auth()).send({});
  assert.equal(response.status, 400);
  assert.equal(row.parentNotifications[0].acknowledged, false);
});

test('revoked or permission-denied guardian cannot acknowledge', async () => {
  const row = incident(); Incident.findById = async () => row; allowed = false;
  const response = await request(app).post('/api/incidents/' + row._id + '/acknowledge').set('Authorization', 'Bearer ' + auth()).send({});
  assert.equal(response.status, 400); assert.equal(row.parentNotifications.some(item => item.acknowledged), false);
});
