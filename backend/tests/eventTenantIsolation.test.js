const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const eventId = '333333333333333333333333';
const classA = '444444444444444444444444';
const classB = '555555555555555555555555';
const guardianId = '666666666666666666666666';

const paths = {
  auth: require.resolve('../middleware/auth'),
  lifecycle: require.resolve('../middleware/lifecycleAuthorization'),
  guardian: require.resolve('../services/guardianAccessService'),
  notifications: require.resolve('../services/notificationService'),
  recurring: require.resolve('../services/recurringEventService'),
  firebase: require.resolve('../services/firebaseService'),
  routes: require.resolve('../routes/events')
};
const cached = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, require.cache[value]]));
const Event = require('../models/Event');
const EventReminder = require('../models/EventReminder');
const User = require('../models/User');
const Class = require('../models/Class');
const ParentGroup = require('../models/ParentGroup');
const originals = {
  eventFindOne: Event.findOne, eventCreate: Event.create, eventFindOneAndUpdate: Event.findOneAndUpdate,
  reminderFind: EventReminder.find,
  userFind: User.find, classFindOne: Class.findOne, groupFindOne: ParentGroup.findOne
};

const effects = { creates: 0, updates: 0, saves: 0, reminders: 0, updateNotifications: 0, deletionNotifications: 0 };
let storedEvent;
let guardianRows = [];
let guardianError = null;
let reminderRows = [];
let reminderReads = 0;

const chain = value => ({
  populate() { return this; }, select() { return this; }, sort() { return this; },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});
const resetEffects = () => Object.keys(effects).forEach(key => { effects[key] = 0; });
const eventRow = (schoolId = schoolA, extras = {}) => ({
  _id: eventId, schoolId, title: 'Existing event', description: '',
  startDate: new Date('2026-12-01T09:00:00Z'), endDate: new Date('2026-12-01T10:00:00Z'),
  reminderTime: '09:00', targetType: 'all', isRecurring: false, isRecurringInstance: false,
  reminders: { immediate: {}, twoDaysBefore: {}, oneDayBefore: {} }, isActive: true,
  toObject() { return { ...this }; }, async save() { effects.saves += 1; }, ...extras
});

require.cache[paths.auth] = { id: paths.auth, filename: paths.auth, loaded: true, exports: {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = { _id: '777777777777777777777777', role, schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA) };
    next();
  },
  authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
} };
require.cache[paths.lifecycle] = { id: paths.lifecycle, filename: paths.lifecycle, loaded: true, exports: { requireActiveOrganization: (_req, _res, next) => next() } };
require.cache[paths.guardian] = { id: paths.guardian, filename: paths.guardian, loaded: true, exports: {
  eligibleGuardians: async () => { if (guardianError) throw guardianError; return guardianRows; }
} };
require.cache[paths.notifications] = { id: paths.notifications, filename: paths.notifications, loaded: true, exports: {
  sendEventReminder: async (_event, recipient) => { effects.reminders += 1; return recipient; },
  sendEventUpdateNotification: async () => { effects.updateNotifications += 1; },
  sendEventDeletionNotification: async () => { effects.deletionNotifications += 1; }
} };
require.cache[paths.recurring] = { id: paths.recurring, filename: paths.recurring, loaded: true, exports: {
  createRecurringInstances: async () => [], updateRecurringInstances: async () => 0, deleteRecurringInstances: async () => 0
} };
require.cache[paths.firebase] = { id: paths.firebase, filename: paths.firebase, loaded: true, exports: { sendNotificationToUser: async () => ({ success: true }) } };

Event.findOne = query => chain(storedEvent && String(query._id) === eventId && String(query.schoolId) === String(storedEvent.schoolId) ? storedEvent : null);
Event.create = async data => { effects.creates += 1; storedEvent = eventRow(String(data.schoolId), { ...data }); return storedEvent; };
Event.findOneAndUpdate = async (query, update) => {
  if (!storedEvent || String(query._id) !== eventId || String(query.schoolId) !== String(storedEvent.schoolId)) return null;
  effects.updates += 1; Object.assign(storedEvent, update); return storedEvent;
};
User.find = query => chain(query.role === 'student' ? [{ _id: '888888888888888888888888' }] : []);
Class.findOne = async query => String(query._id) === classA && String(query.schoolId) === schoolA ? { _id: classA, schoolId: schoolA } : null;
ParentGroup.findOne = () => chain(null);
EventReminder.find = query => {
  reminderReads += 1;
  return chain(String(query.eventId) === eventId ? reminderRows : []);
};
delete require.cache[paths.routes];
const app = express(); app.use(express.json()); app.use('/api/events', require('../routes/events'));

test.after(() => {
  Event.findOne = originals.eventFindOne; Event.create = originals.eventCreate; Event.findOneAndUpdate = originals.eventFindOneAndUpdate;
  EventReminder.find = originals.reminderFind;
  User.find = originals.userFind; Class.findOne = originals.classFindOne; ParentGroup.findOne = originals.groupFindOne;
  for (const [key, modulePath] of Object.entries(paths)) {
    if (cached[key]) require.cache[modulePath] = cached[key]; else delete require.cache[modulePath];
  }
});

test.beforeEach(() => { resetEffects(); guardianRows = []; guardianError = null; reminderRows = [{ _id: '999999999999999999999999', eventId }]; reminderReads = 0; storedEvent = eventRow(); });

test('single-event read, update, and delete are tenant scoped before side effects', async () => {
  storedEvent = eventRow(schoolB);
  assert.equal((await request(app).get(`/api/events/${eventId}`).set('x-school', schoolA)).status, 404);
  assert.equal((await request(app).put(`/api/events/${eventId}`).set('x-school', schoolA).send({ title: 'No' })).status, 404);
  assert.equal((await request(app).delete(`/api/events/${eventId}`).set('x-school', schoolA)).status, 404);
  assert.deepEqual(effects, { creates: 0, updates: 0, saves: 0, reminders: 0, updateNotifications: 0, deletionNotifications: 0 });
});

test('school admin cannot overpost organization identity during an update', async () => {
  const response = await request(app).put(`/api/events/${eventId}`).send({ schoolId: schoolB, title: 'Updated safely' });
  assert.equal(response.status, 200); assert.equal(storedEvent.title, 'Updated safely'); assert.equal(String(storedEvent.schoolId), schoolA);
  assert.equal(effects.updates, 1);
});

test('super admin requires explicit matching organization for reads and mutations', async () => {
  for (const [method, body] of [['get'], ['put', { title: 'Scoped' }], ['delete']]) {
    const missing = await request(app)[method](`/api/events/${eventId}`).set('x-role', 'super_admin').send(body);
    assert.equal(missing.status, 400, `${method} missing scope`);
    const wrong = await request(app)[method](`/api/events/${eventId}?schoolId=${schoolB}`).set('x-role', 'super_admin').send(body);
    assert.equal(wrong.status, 404, `${method} wrong scope`);
  }
  assert.equal(effects.updates, 0); assert.equal(effects.saves, 0); assert.equal(effects.deletionNotifications, 0);
  assert.equal((await request(app).put(`/api/events/${eventId}?schoolId=${schoolA}`).set('x-role', 'super_admin').send({ title: 'Scoped' })).status, 200);
  assert.equal((await request(app).delete(`/api/events/${eventId}?schoolId=${schoolA}`).set('x-role', 'super_admin')).status, 200);
  assert.equal(effects.saves, 1);
});

test('super admin creation uses explicit scope and rejects an incompatible target class before writes', async () => {
  const payload = { title: 'Class event', startDate: '2026-12-01', endDate: '2026-12-01', targetType: 'class', targetClass: classA };
  assert.equal((await request(app).post('/api/events').set('x-role', 'super_admin').send(payload)).status, 400);
  assert.equal((await request(app).post(`/api/events?schoolId=${schoolB}`).set('x-role', 'super_admin').send(payload)).status, 400);
  assert.equal(effects.creates, 0); assert.equal(effects.reminders, 0);
  const valid = await request(app).post(`/api/events?schoolId=${schoolA}`).set('x-role', 'super_admin').send(payload);
  assert.equal(valid.status, 201); assert.equal(String(storedEvent.schoolId), schoolA);
});

test('invalid and cross-tenant targets are rejected before event writes or notifications', async () => {
  for (const targetClass of ['999999999999999999999999', classB]) {
    const response = await request(app).post('/api/events').send({ title: 'Invalid', startDate: '2026-12-01', endDate: '2026-12-01', targetType: 'class', targetClass });
    assert.equal(response.status, 400);
  }
  const group = await request(app).post('/api/events').send({ title: 'Invalid group', startDate: '2026-12-01', endDate: '2026-12-01', targetType: 'group', targetGroup: '999999999999999999999999' });
  assert.equal(group.status, 400);
  const update = await request(app).put(`/api/events/${eventId}`).send({ targetType: 'class', targetClass: classB });
  assert.equal(update.status, 400);
  assert.equal(effects.creates, 0); assert.equal(effects.updates, 0); assert.equal(effects.reminders, 0); assert.equal(effects.updateNotifications, 0);
});

test('valid class notifications use eligible guardians from the authorized organization', async () => {
  guardianRows = [
    { _id: guardianId, firstName: 'Valid', lastName: 'Guardian', email: 'guardian@example.invalid', schoolId: schoolA, role: 'parent', isActive: true },
    { _id: '999999999999999999999999', firstName: 'Other', lastName: 'Tenant', email: 'other@example.invalid', schoolId: schoolB, role: 'parent', isActive: true }
  ];
  const response = await request(app).post('/api/events').send({ title: 'Class event', startDate: '2026-12-01', endDate: '2026-12-01', targetType: 'class', targetClass: classA });
  assert.equal(response.status, 201);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(effects.reminders, 1);
});

test('recipient lookup failure prevents persistence and is not reported as successful delivery', async () => {
  guardianError = new Error('recipient store unavailable');
  const response = await request(app).post('/api/events').send({ title: 'Class event', startDate: '2026-12-01', endDate: '2026-12-01', targetType: 'class', targetClass: classA });
  assert.equal(response.status, 500); assert.equal(effects.creates, 0); assert.equal(effects.reminders, 0);
});

test('event reminder logs require same-organization access', async () => {
  storedEvent = eventRow(schoolB);
  const response = await request(app).get(`/api/events/${eventId}/reminders`).set('x-school', schoolA);
  assert.equal(response.status, 404); assert.equal(reminderReads, 0);
});

test('Super Admin event reminder logs require explicit matching organization scope', async () => {
  const missing = await request(app).get(`/api/events/${eventId}/reminders`).set('x-role', 'super_admin');
  assert.equal(missing.status, 400); assert.equal(reminderReads, 0);
  const wrong = await request(app).get(`/api/events/${eventId}/reminders?schoolId=${schoolB}`).set('x-role', 'super_admin');
  assert.equal(wrong.status, 404); assert.equal(reminderReads, 0);
  const correct = await request(app).get(`/api/events/${eventId}/reminders?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(correct.status, 200); assert.equal(reminderReads, 1); assert.equal(correct.body.count, 1);
});
