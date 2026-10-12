const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const teacherA = '333333333333333333333333';
const teacherB = '444444444444444444444444';
const inactiveTeacher = '555555555555555555555555';
const slotId = '666666666666666666666666';

const paths = {
  auth: require.resolve('../middleware/auth'),
  lifecycle: require.resolve('../middleware/lifecycleAuthorization'),
  guardian: require.resolve('../services/guardianAccessService'),
  routes: require.resolve('../routes/availability')
};
const cached = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, require.cache[value]]));
const AvailabilitySlot = require('../models/AvailabilitySlot');
const User = require('../models/User');
const originals = {
  slotFind: AvailabilitySlot.find, slotFindOne: AvailabilitySlot.findOne, slotInsertMany: AvailabilitySlot.insertMany,
  userFindOne: User.findOne
};
const effects = { inserts: 0, saves: 0 };
let slot;

const chain = value => ({
  select() { return this; }, populate() { return this; }, sort() { return this; }, limit() { return this; }, lean() { return Promise.resolve(value); },
  then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});
const reset = () => { effects.inserts = 0; effects.saves = 0; slot = row(); };
const row = (schoolId = schoolA, teacherId = teacherA) => ({
  _id: slotId, schoolId, teacherId, status: 'published',
  async save() { effects.saves += 1; }
});
const validPayload = (extra = {}) => ({
  teacherId: teacherA,
  startsAt: '2027-01-10T09:00:00.000Z', endsAt: '2027-01-10T10:00:00.000Z',
  ...extra
});

require.cache[paths.auth] = { id: paths.auth, filename: paths.auth, loaded: true, exports: {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = { _id: req.get('x-user') || teacherA, role, schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA) };
    next();
  },
  authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
} };
require.cache[paths.lifecycle] = { id: paths.lifecycle, filename: paths.lifecycle, loaded: true, exports: { requireActiveOrganization: (_req, _res, next) => next() } };
require.cache[paths.guardian] = { id: paths.guardian, filename: paths.guardian, loaded: true, exports: { authorizedParticipants: async () => [] } };

User.findOne = query => chain(
  String(query._id) === teacherA && String(query.schoolId) === schoolA && query.role === 'teacher' && query.isActive === true
    ? { _id: teacherA, schoolId: schoolA, role: 'teacher', isActive: true }
    : null
);
AvailabilitySlot.find = query => chain(query._id ? [{ _id: query._id.$in[0], schoolId: schoolA, teacherId: teacherA }] : []);
AvailabilitySlot.insertMany = async rows => { effects.inserts += rows.length; return rows.map((item, index) => ({ _id: `${index + 1}`.padStart(24, '0'), ...item })); };
AvailabilitySlot.findOne = query => chain(slot && String(query._id) === slotId && String(query.schoolId) === String(slot.schoolId) ? slot : null);
delete require.cache[paths.routes];
const app = express(); app.use(express.json()); app.use('/api/availability', require('../routes/availability'));

test.after(() => {
  AvailabilitySlot.find = originals.slotFind; AvailabilitySlot.findOne = originals.slotFindOne; AvailabilitySlot.insertMany = originals.slotInsertMany;
  User.findOne = originals.userFindOne;
  for (const [key, modulePath] of Object.entries(paths)) {
    if (cached[key]) require.cache[modulePath] = cached[key]; else delete require.cache[modulePath];
  }
});
test.beforeEach(reset);

test('creation rejects missing, invalid, inactive, and cross-tenant teachers before writes', async () => {
  const cases = [
    validPayload({ teacherId: undefined }),
    validPayload({ teacherId: 'not-an-object-id' }),
    validPayload({ teacherId: '999999999999999999999999' }),
    validPayload({ teacherId: inactiveTeacher }),
    validPayload({ teacherId: teacherB })
  ];
  for (const payload of cases) {
    const response = await request(app).post('/api/availability').send(payload);
    assert.equal(response.status, 400);
  }
  assert.equal(effects.inserts, 0);
});

test('valid same-organization administrator and teacher creation continue to work', async () => {
  const admin = await request(app).post('/api/availability').send(validPayload());
  assert.equal(admin.status, 201); assert.equal(effects.inserts, 1);
  const teacher = await request(app).post('/api/availability').set('x-role', 'teacher').set('x-user', teacherA).send(validPayload({ teacherId: teacherB }));
  assert.equal(teacher.status, 201); assert.equal(effects.inserts, 2);
});

test('organization administrator cannot delete another tenant slot and causes zero writes', async () => {
  slot = row(schoolB, teacherB);
  const response = await request(app).delete(`/api/availability/${slotId}`);
  assert.equal(response.status, 404); assert.equal(effects.saves, 0);
});

test('super admin deletion requires explicit matching organization scope', async () => {
  const missing = await request(app).delete(`/api/availability/${slotId}`).set('x-role', 'super_admin');
  assert.equal(missing.status, 400); assert.equal(effects.saves, 0);
  const wrong = await request(app).delete(`/api/availability/${slotId}?schoolId=${schoolB}`).set('x-role', 'super_admin');
  assert.equal(wrong.status, 404); assert.equal(effects.saves, 0);
  const correct = await request(app).delete(`/api/availability/${slotId}?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(correct.status, 200); assert.equal(effects.saves, 1); assert.equal(slot.status, 'cancelled');
});

test('teacher ownership remains enforced after tenant-scoped lookup', async () => {
  const denied = await request(app).delete(`/api/availability/${slotId}`).set('x-role', 'teacher').set('x-user', teacherB);
  assert.equal(denied.status, 403); assert.equal(effects.saves, 0);
  const allowed = await request(app).delete(`/api/availability/${slotId}`).set('x-role', 'teacher').set('x-user', teacherA);
  assert.equal(allowed.status, 200); assert.equal(effects.saves, 1);
});
