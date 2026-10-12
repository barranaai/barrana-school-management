const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'meeting-tenant-test-secret';
const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const schoolA = id(1), schoolB = id(2), adminId = id(3), teacherId = id(4), otherTeacherId = id(5), parentId = id(6), studentId = id(7), meetingId = id(8), slotId = id(9), newSlotId = id(10);
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const lifecyclePath = require.resolve('../middleware/lifecycleAuthorization');
const guardianPath = require.resolve('../services/guardianAccessService');
const firebasePath = require.resolve('../services/firebaseService');
const routesPath = require.resolve('../routes/meetings');
const cached = { lifecycle: require.cache[lifecyclePath], guardian: require.cache[guardianPath], firebase: require.cache[firebasePath] };
const original = { userFindById: User.findById, meetingFindOne: Meeting.findOne, meetingCreate: Meeting.create, slotFindOneAndUpdate: AvailabilitySlot.findOneAndUpdate, slotUpdateOne: AvailabilitySlot.updateOne };
let actor;
const effects = { meetingSaves: 0, slotWrites: 0, replacements: 0, notifications: 0 };

require.cache[lifecyclePath] = { id: lifecyclePath, filename: lifecyclePath, loaded: true, exports: { requireActiveOrganization: (_req, _res, next) => next() } };
require.cache[guardianPath] = { id: guardianPath, filename: guardianPath, loaded: true, exports: { authorizeGuardianParticipant: async () => ({ allowed: true }) } };
require.cache[firebasePath] = { id: firebasePath, filename: firebasePath, loaded: true, exports: { isFirebaseInitialized: () => false, sendNotificationToUser: async () => { effects.notifications += 1; } } };
User.findById = () => ({
  select: async fields => fields === '-password'
    ? { ...actor, isActive: true, async save() {} }
    : { notifications: [], fcmTokens: [], async save() { effects.notifications += 1; } }
});
delete require.cache[routesPath];
const app = express(); app.use(express.json()); app.use('/api/meetings', require('../routes/meetings'));

function token(nextActor) { actor = nextActor; return jwt.sign({ id: String(nextActor._id) }, process.env.JWT_SECRET); }
function row(schoolId = schoolA) {
  return {
    _id: meetingId, schoolId, teacherId, parentId, studentId, slotId,
    status: 'confirmed', startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    meetingNumber: 'MTG-1',
    async save() { effects.meetingSaves += 1; }, async populate() { return this; }
  };
}
async function resetEffects() {
  await new Promise(resolve => setImmediate(resolve));
  Object.keys(effects).forEach(key => { effects[key] = 0; });
}
function installMeeting(current) {
  Meeting.findOne = async query => String(query._id) === String(current._id) && String(query.schoolId) === String(current.schoolId) ? current : null;
}

test.after(() => {
  User.findById = original.userFindById; Meeting.findOne = original.meetingFindOne; Meeting.create = original.meetingCreate;
  AvailabilitySlot.findOneAndUpdate = original.slotFindOneAndUpdate; AvailabilitySlot.updateOne = original.slotUpdateOne;
  for (const [name, modulePath] of [['lifecycle', lifecyclePath], ['guardian', guardianPath], ['firebase', firebasePath]]) {
    if (cached[name]) require.cache[modulePath] = cached[name]; else delete require.cache[modulePath];
  }
  delete require.cache[routesPath];
});

test('school admin cannot mutate another organization meeting and causes zero side effects', async () => {
  await resetEffects(); const meeting = row(schoolB); installMeeting(meeting);
  AvailabilitySlot.updateOne = async () => { effects.slotWrites += 1; };
  AvailabilitySlot.findOneAndUpdate = async () => { effects.slotWrites += 1; return null; };
  Meeting.create = async () => { effects.replacements += 1; };
  const auth = token({ _id: adminId, schoolId: schoolA, role: 'school_admin' });
  const cases = [['cancel', {}], ['reschedule', { newSlotId }], ['complete', {}], ['no-show', {}]];
  for (const [suffix, body] of cases) {
    const response = await request(app).post(`/api/meetings/${meetingId}/${suffix}`).set('Authorization', 'Bearer ' + auth).send(body);
    assert.equal(response.status, 404, suffix);
  }
  assert.deepEqual(effects, { meetingSaves: 0, slotWrites: 0, replacements: 0, notifications: 0 });
});

test('super admin requires explicit matching organization for every meeting mutation', async () => {
  await resetEffects(); const meeting = row(schoolA); installMeeting(meeting);
  const auth = token({ _id: adminId, role: 'super_admin' });
  for (const [suffix, body] of [['cancel', {}], ['reschedule', { newSlotId }], ['complete', {}], ['no-show', {}]]) {
    const missing = await request(app).post(`/api/meetings/${meetingId}/${suffix}`).set('Authorization', 'Bearer ' + auth).send(body);
    assert.equal(missing.status, 400, `${suffix} missing scope`);
    const wrong = await request(app).post(`/api/meetings/${meetingId}/${suffix}?schoolId=${schoolB}`).set('Authorization', 'Bearer ' + auth).send(body);
    assert.equal(wrong.status, 404, `${suffix} wrong scope`);
  }
  assert.deepEqual(effects, { meetingSaves: 0, slotWrites: 0, replacements: 0, notifications: 0 });
});

test('same-organization administrator can cancel, complete, and record no-show', async () => {
  const auth = token({ _id: adminId, schoolId: schoolA, role: 'school_admin' });
  AvailabilitySlot.updateOne = async () => { effects.slotWrites += 1; };
  for (const suffix of ['cancel', 'complete', 'no-show']) {
    await resetEffects(); const meeting = row(); installMeeting(meeting);
    const response = await request(app).post(`/api/meetings/${meetingId}/${suffix}`).set('Authorization', 'Bearer ' + auth).send({});
    assert.equal(response.status, 200, suffix); assert.equal(effects.meetingSaves, 1, suffix);
  }
});

test('same-organization meeting parties retain cancellation permission', async () => {
  AvailabilitySlot.updateOne = async () => { effects.slotWrites += 1; };
  for (const party of [
    { _id: teacherId, schoolId: schoolA, role: 'teacher' },
    { _id: parentId, schoolId: schoolA, role: 'parent' }
  ]) {
    await resetEffects(); const meeting = row(); installMeeting(meeting);
    const response = await request(app).post(`/api/meetings/${meetingId}/cancel`).set('Authorization', 'Bearer ' + token(party)).send({});
    assert.equal(response.status, 200, party.role); assert.equal(effects.meetingSaves, 1, party.role);
  }
});

test('correctly scoped super admin can reschedule without broadening party permissions', async () => {
  await resetEffects(); const meeting = row(); installMeeting(meeting);
  AvailabilitySlot.findOneAndUpdate = async query => {
    effects.slotWrites += 1;
    return { _id: newSlotId, schoolId: schoolA, teacherId, startsAt: meeting.startsAt, endsAt: new Date(meeting.startsAt.getTime() + 30 * 60 * 1000), status: 'booked', async save() { effects.slotWrites += 1; } };
  };
  AvailabilitySlot.updateOne = async () => { effects.slotWrites += 1; };
  Meeting.create = async payload => { effects.replacements += 1; return { _id: id(11), ...payload, meetingNumber: 'MTG-2', async populate() { return this; } }; };
  const response = await request(app).post(`/api/meetings/${meetingId}/reschedule?schoolId=${schoolA}`).set('Authorization', 'Bearer ' + token({ _id: adminId, role: 'super_admin' })).send({ newSlotId });
  assert.equal(response.status, 200); assert.equal(effects.replacements, 1); assert.equal(effects.meetingSaves, 2); assert.ok(effects.slotWrites >= 2);
});

test('rescheduling cannot write a replacement slot from another organization', async () => {
  await resetEffects(); const meeting = row(); installMeeting(meeting);
  const candidate = { _id: newSlotId, schoolId: schoolB, teacherId, status: 'published' };
  AvailabilitySlot.findOneAndUpdate = async query => {
    assert.equal(String(query.schoolId), String(meeting.schoolId));
    assert.equal(String(query.teacherId), String(meeting.teacherId));
    const matches = String(query._id) === String(candidate._id) && String(query.schoolId) === String(candidate.schoolId) && String(query.teacherId) === String(candidate.teacherId) && query.status === candidate.status;
    if (matches) effects.slotWrites += 1;
    return matches ? candidate : null;
  };
  AvailabilitySlot.updateOne = async () => { effects.slotWrites += 1; };
  Meeting.create = async () => { effects.replacements += 1; };
  const response = await request(app).post(`/api/meetings/${meetingId}/reschedule`).set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ newSlotId });
  assert.equal(response.status, 409);
  assert.deepEqual(effects, { meetingSaves: 0, slotWrites: 0, replacements: 0, notifications: 0 });
});

test('rescheduling cannot write a replacement slot owned by another teacher', async () => {
  await resetEffects(); const meeting = row(); installMeeting(meeting);
  const candidate = { _id: newSlotId, schoolId: schoolA, teacherId: otherTeacherId, status: 'published' };
  AvailabilitySlot.findOneAndUpdate = async query => {
    assert.equal(String(query.schoolId), String(meeting.schoolId));
    assert.equal(String(query.teacherId), String(meeting.teacherId));
    const matches = String(query._id) === String(candidate._id) && String(query.schoolId) === String(candidate.schoolId) && String(query.teacherId) === String(candidate.teacherId) && query.status === candidate.status;
    if (matches) effects.slotWrites += 1;
    return matches ? candidate : null;
  };
  AvailabilitySlot.updateOne = async () => { effects.slotWrites += 1; };
  Meeting.create = async () => { effects.replacements += 1; };
  const response = await request(app).post(`/api/meetings/${meetingId}/reschedule`).set('Authorization', 'Bearer ' + token({ _id: adminId, schoolId: schoolA, role: 'school_admin' })).send({ newSlotId });
  assert.equal(response.status, 409);
  assert.deepEqual(effects, { meetingSaves: 0, slotWrites: 0, replacements: 0, notifications: 0 });
});

test('unrelated teacher remains denied after tenant-scoped lookup', async () => {
  await resetEffects(); const meeting = row(); installMeeting(meeting);
  const response = await request(app).post(`/api/meetings/${meetingId}/cancel`).set('Authorization', 'Bearer ' + token({ _id: otherTeacherId, schoolId: schoolA, role: 'teacher' })).send({});
  assert.equal(response.status, 403); assert.deepEqual(effects, { meetingSaves: 0, slotWrites: 0, replacements: 0, notifications: 0 });
});
