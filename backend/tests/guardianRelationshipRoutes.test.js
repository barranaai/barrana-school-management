const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'guardian-route-test-secret';
const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const schoolA = id(1), schoolB = id(2), adminId = id(3), childId = id(4), guardianId = id(5);
const User = require('../models/User');
const Relationship = require('../models/GuardianParticipantRelationship');
const emailPath = require.resolve('../utils/email');
const lifecyclePath = require.resolve('../middleware/lifecycleAuthorization');
const originalEmail = require.cache[emailPath];
const originalLifecycle = require.cache[lifecyclePath];
let organizationActive = true;
require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true, exports: { sendEmail: async () => ({ success: true }) } };
require.cache[lifecyclePath] = { id: lifecyclePath, filename: lifecyclePath, loaded: true, exports: {
  requireActiveOrganization: (_req, res, next) => organizationActive ? next() : res.status(409).json({ success: false, message: 'Organization is deactivated' })
} };
const original = { findById: User.findById, findOne: User.findOne, createUser: User.create, exists: Relationship.exists, create: Relationship.create, relationshipFindOne: Relationship.findOne, relationshipFindById: Relationship.findById };

function token(actor) {
  User.findById = () => ({ select: async () => ({ ...actor, isActive: true, async save() {} }) });
  return jwt.sign({ id: String(actor._id) }, process.env.JWT_SECRET);
}
const app = express();
app.use(express.json());
app.use('/api/guardian-relationships', require('../routes/guardianRelationships'));

test.after(() => { Object.assign(User, { findById: original.findById, findOne: original.findOne, create: original.createUser }); Object.assign(Relationship, { exists: original.exists, create: original.create, findOne: original.relationshipFindOne, findById: original.relationshipFindById }); if (originalEmail) require.cache[emailPath] = originalEmail; else delete require.cache[emailPath]; if (originalLifecycle) require.cache[lifecyclePath] = originalLifecycle; else delete require.cache[lifecyclePath]; });

test('teacher and parent are denied relationship management at HTTP route level', async () => {
  for (const role of ['teacher', 'parent']) {
    const response = await request(app).get('/api/guardian-relationships/participant/' + childId).set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role }));
    assert.equal(response.status, 403);
  }
});

test('super admin must provide explicit organization context', async () => {
  const response = await request(app).get('/api/guardian-relationships/participant/' + childId).set('Authorization', 'Bearer ' + token({ _id: adminId, role: 'super_admin' }));
  assert.equal(response.status, 400);
});

test('organization admin cannot link cross-tenant guardian or participant IDs', async () => {
  User.findOne = async query => String(query.schoolId) === String(schoolA) && String(query._id) === String(childId) && query.role === 'student' ? { _id: childId } : null;
  Relationship.exists = async () => false;
  let created = false; Relationship.create = async () => { created = true; };
  const response = await request(app).post('/api/guardian-relationships').set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ participantId: childId, guardianId, relationshipType: 'parent', schoolId: schoolB });
  assert.equal(response.status, 404); assert.equal(created, false);
});

test('new guardian setup never returns a password or setup token', async () => {
  User.findOne = async () => null;
  let resetGenerated = false;
  User.create = async payload => ({ _id: guardianId, ...payload, generatePasswordResetToken() { resetGenerated = true; return 'private-token'; }, async save() {} });
  const response = await request(app).post('/api/guardian-relationships/guardians').set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ firstName: 'New', lastName: 'Guardian', email: 'new@test.local' });
  assert.equal(response.status, 201); assert.equal(resetGenerated, true); assert.equal(response.body.data.role, undefined); assert.equal(JSON.stringify(response.body).includes('private-token'), false); assert.equal(Object.hasOwn(response.body.data, 'password'), false); assert.equal(response.body.invitationSent, true);
});

test('inactive organization cannot create a guardian relationship', async () => {
  organizationActive = false;
  let created = false; Relationship.create = async () => { created = true; };
  const response = await request(app).post('/api/guardian-relationships').set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ participantId: childId, guardianId, relationshipType: 'parent' });
  organizationActive = true;
  assert.equal(response.status, 409); assert.equal(created, false);
});

test('inactive guardian cannot receive a newly active relationship', async () => {
  User.findOne = async query => {
    if (query.role === 'student') return { _id: childId };
    if (query.role === 'parent' && query.isActive) return null;
    return null;
  };
  Relationship.exists = async () => false;
  let created = false; Relationship.create = async () => { created = true; };
  const response = await request(app).post('/api/guardian-relationships').set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ participantId: childId, guardianId, relationshipType: 'parent' });
  assert.equal(response.status, 404); assert.equal(created, false);
});

test('inactive participant cannot receive or activate an active relationship', async () => {
  User.findOne = async query => {
    if (query.role === 'student') return query.isActive ? null : { _id: childId, isActive: false };
    if (query.role === 'parent') return { _id: guardianId, isActive: true };
    return null;
  };
  Relationship.exists = async () => false;
  let created = false; Relationship.create = async () => { created = true; };
  const createResponse = await request(app).post('/api/guardian-relationships').set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ participantId: childId, guardianId, relationshipType: 'parent' });
  assert.equal(createResponse.status, 404); assert.equal(created, false);

  const row = { _id: id(9), schoolId: schoolA, guardianId, participantId: childId, relationshipType: 'parent', status: 'revoked', isPrimaryContact: false, permissions: {}, lifecycleHistory: [{ toStatus: 'revoked', changedBy: adminId }], async save() { throw new Error('must not save'); } };
  Relationship.findOne = async () => row;
  const activateResponse = await request(app).post(`/api/guardian-relationships/${row._id}/activate`).set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({});
  assert.equal(activateResponse.status, 409); assert.equal(row.status, 'revoked'); assert.equal(row.lifecycleHistory.length, 1);
});

test('active organization can reactivate a valid relationship without losing lifecycle history', async () => {
  const row = { _id: id(9), schoolId: schoolA, guardianId, participantId: childId, relationshipType: 'parent', status: 'revoked', isPrimaryContact: false, permissions: {}, lifecycleHistory: [{ toStatus: 'revoked', changedBy: adminId }], async save() {} };
  User.findOne = async query => query.role === 'parent' ? { _id: guardianId, isActive: true } : { _id: childId };
  Relationship.findOne = async () => row;
  Relationship.findById = () => ({ populate() { return this; }, then(resolve) { resolve(row); } });
  const response = await request(app).post(`/api/guardian-relationships/${row._id}/activate`).set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({});
  assert.equal(response.status, 200); assert.equal(row.status, 'active'); assert.equal(row.lifecycleHistory.length, 2); assert.equal(row.lifecycleHistory[0].toStatus, 'revoked');
});
