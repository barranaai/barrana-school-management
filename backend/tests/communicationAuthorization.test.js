const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const teacherA = '333333333333333333333333';
const teacherB = '444444444444444444444444';
const studentA = '555555555555555555555555';
const reportId = '666666666666666666666666';
const adminId = '777777777777777777777777';

const sameId = (left, right) => String(left?._id || left) === String(right?._id || right);
const reportRow = (changes = {}) => ({
  _id: reportId, schoolId: schoolA,
  studentId: { _id: studentA, schoolId: schoolA, role: 'student', firstName: 'Maya', lastName: 'Participant' },
  teacherId: { _id: teacherA, schoolId: schoolA, role: 'teacher', firstName: 'Tariq', lastName: 'Teacher' },
  templateId: { _id: '888888888888888888888888', name: 'Progress Summary' },
  title: 'Autumn Progress', status: 'review', createdAt: new Date('2026-10-10T10:00:00.000Z'),
  ...changes
});

function harness(initialReport = reportRow(), { activeOrganization = true } = {}) {
  let report = initialReport;
  const effects = { lifecycleChecks: 0, reportQueries: [], adminQueries: [], writes: [], sends: [] };
  const auth = {
    protect(req, _res, next) {
      const role = req.get('x-role') || 'teacher';
      req.user = { _id: req.get('x-user') || teacherA, role, schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA) };
      next();
    },
    authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
  };
  const resourceAuthorization = {
    scopeSchoolId: (user, requested) => user.role === 'super_admin' ? requested : String(user.schoolId),
    sameId,
    canAccessReport(user, candidate) {
      if (!candidate) return false;
      if (user.role === 'super_admin') return true;
      if (!sameId(user.schoolId, candidate.schoolId)) return false;
      return user.role === 'school_admin' || (user.role === 'teacher' && sameId(user._id, candidate.teacherId));
    }
  };
  const lifecycleAuthorization = {
    requireActiveOrganization(_req, res, next) {
      effects.lifecycleChecks += 1;
      return activeOrganization ? next() : res.status(409).json({ success: false, message: 'Organization is inactive' });
    }
  };
  const User = {
    find(criteria) {
      effects.adminQueries.push(criteria);
      return { select: async () => [{ _id: adminId, firstName: 'Ada', lastName: 'Admin', email: 'admin@example.test' }] };
    },
    async findByIdAndUpdate(id, update) { effects.writes.push({ id, update }); return {}; },
    findById() { throw new Error('Unexpected user lookup'); },
    updateOne() { throw new Error('Unexpected notification update'); }
  };
  const Report = {
    findOne(criteria) {
      effects.reportQueries.push(criteria);
      const found = report && sameId(criteria._id, report._id) && sameId(criteria.schoolId, report.schoolId) ? report : null;
      return { populate() { return this; }, then(resolve, reject) { return Promise.resolve(found).then(resolve, reject); } };
    }
  };
  const firebaseService = {
    isFirebaseInitialized: () => true,
    async sendNotificationToUser(admin, notification, data) { effects.sends.push({ admin, notification, data }); }
  };
  const routePath = require.resolve(path.join('..', 'routes', 'communication.js'));
  delete require.cache[routePath];
  const originalLoad = Module._load;
  Module._load = function (requestName, parent, isMain) {
    const stubs = {
      '../middleware/auth': auth,
      '../middleware/lifecycleAuthorization': lifecycleAuthorization,
      '../middleware/resourceAuthorization': resourceAuthorization,
      '../models/User': User,
      '../models/Report': Report,
      '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
      '../services/firebaseService': firebaseService
    };
    if (Object.hasOwn(stubs, requestName)) return stubs[requestName];
    return originalLoad.call(this, requestName, parent, isMain);
  };
  let router;
  try { router = require(routePath); } finally { Module._load = originalLoad; }
  const app = express(); app.use(express.json()); app.use(router);
  return { app, effects };
}

const postNotification = (app, body = {}, headers = {}) => {
  let call = request(app).post('/report-approval-notification');
  for (const [name, value] of Object.entries(headers)) call = call.set(name, value);
  return call.send({ reportId, ...body });
};

test('authorized teacher notification uses authoritative report content', async () => {
  const h = harness();
  const response = await postNotification(h.app, { schoolId: schoolA, reportData: {
    reportId, studentName: 'Forged Student', teacherName: 'Forged Teacher', reportTitle: 'Forged Report', status: 'approved'
  } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { success: true, sentCount: 1, failedCount: 0 });
  assert.equal(h.effects.writes.length, 1);
  const notification = h.effects.writes[0].update.$push.notifications;
  assert.match(notification.message, /Tariq Teacher.*Maya Participant/);
  assert.equal(notification.data.reportTitle, 'Autumn Progress');
  assert.equal(notification.data.studentName, 'Maya Participant');
  assert.equal(notification.data.teacherName, 'Tariq Teacher');
  assert.equal(h.effects.sends[0].data.studentName, 'Maya Participant');
});

test('draft and review reports retain the existing approval-notification workflow', async () => {
  for (const status of ['draft', 'review']) {
    const h = harness(reportRow({ status }));
    const response = await postNotification(h.app, { schoolId: schoolA });
    assert.equal(response.status, 200); assert.equal(h.effects.writes.length, 1); assert.equal(h.effects.sends.length, 1);
  }
});

test('inactive organization is rejected before report or notification side effects', async () => {
  const h = harness(reportRow(), { activeOrganization: false });
  const response = await postNotification(h.app, { schoolId: schoolA });
  assert.equal(response.status, 409);
  assert.equal(h.effects.lifecycleChecks, 1);
  assert.equal(h.effects.reportQueries.length, 0);
  assert.equal(h.effects.adminQueries.length, 0);
  assert.equal(h.effects.writes.length, 0);
  assert.equal(h.effects.sends.length, 0);
});

test('missing, nonexistent, and cross-tenant reports cause zero notification side effects', async () => {
  const missing = harness();
  const missingResponse = await request(missing.app).post('/report-approval-notification').send({ schoolId: schoolA });
  assert.equal(missingResponse.status, 400); assert.equal(missing.effects.writes.length, 0); assert.equal(missing.effects.sends.length, 0);

  const nonexistent = harness(null);
  const nonexistentResponse = await postNotification(nonexistent.app, { schoolId: schoolA });
  assert.equal(nonexistentResponse.status, 404); assert.equal(nonexistent.effects.writes.length, 0); assert.equal(nonexistent.effects.sends.length, 0);

  const crossTenant = harness(reportRow({ schoolId: schoolB }));
  const crossTenantResponse = await postNotification(crossTenant.app, { schoolId: schoolA });
  assert.equal(crossTenantResponse.status, 404); assert.equal(crossTenant.effects.writes.length, 0); assert.equal(crossTenant.effects.sends.length, 0);
});

test('unrelated teacher cannot notify about another teacher report', async () => {
  const h = harness();
  const response = await postNotification(h.app, { schoolId: schoolA }, { 'x-user': teacherB });
  assert.equal(response.status, 404); assert.equal(h.effects.adminQueries.length, 0); assert.equal(h.effects.writes.length, 0); assert.equal(h.effects.sends.length, 0);
});

test('reports that are no longer awaiting approval cause zero notification side effects', async () => {
  for (const status of ['approved', 'sent', 'archived']) {
    const h = harness(reportRow({ status }));
    const response = await postNotification(h.app, { schoolId: schoolA });
    assert.equal(response.status, 409); assert.equal(h.effects.adminQueries.length, 0); assert.equal(h.effects.writes.length, 0); assert.equal(h.effects.sends.length, 0);
  }
});

test('organization administrator retains same-organization notification access', async () => {
  const h = harness();
  const response = await postNotification(h.app, { schoolId: schoolA }, { 'x-role': 'school_admin' });
  assert.equal(response.status, 200); assert.equal(h.effects.writes.length, 1); assert.equal(h.effects.sends.length, 1);
});

test('Super Admin requires explicit matching organization scope', async () => {
  const missing = harness();
  const missingResponse = await postNotification(missing.app, {}, { 'x-role': 'super_admin' });
  assert.equal(missingResponse.status, 400); assert.equal(missing.effects.writes.length, 0);

  const wrong = harness();
  const wrongResponse = await postNotification(wrong.app, { schoolId: schoolB }, { 'x-role': 'super_admin' });
  assert.equal(wrongResponse.status, 404); assert.equal(wrong.effects.writes.length, 0); assert.equal(wrong.effects.sends.length, 0);

  const correct = harness();
  const correctResponse = await postNotification(correct.app, { schoolId: schoolA }, { 'x-role': 'super_admin' });
  assert.equal(correctResponse.status, 200); assert.equal(correct.effects.writes.length, 1); assert.equal(correct.effects.sends.length, 1);
});
