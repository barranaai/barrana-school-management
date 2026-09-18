const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const participantId = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const auth = {
  protect(req, res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', role, schoolId: role === 'super_admin' ? undefined : schoolA };
    next();
  },
  authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403); }
};

function loadRoute(stubs) {
  const resolved = require.resolve(path.join('..', 'routes', 'students.js'));
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

function chain(value) {
  const q = { populate() { return q; }, select() { return q; }, sort() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
  return q;
}

function harness() {
  const observed = { participantQuery: null, listQuery: null, enrollmentQuery: null, saves: 0, hardDeletes: 0 };
  const participant = {
    _id: participantId, role: 'student', schoolId: schoolA, isActive: true, assignedTeacher: null, classId: null,
    async save() { observed.saves += 1; return this; }
  };
  const User = {
    findOne(query) {
      observed.participantQuery = query;
      return chain(String(query.schoolId) === schoolA && query._id === participantId ? participant : null);
    },
    async findByIdAndUpdate() {},
    async findByIdAndDelete() { observed.hardDeletes += 1; },
    async countDocuments() { return 0; },
    find(query) { observed.listQuery = query; return chain([]); },
    async create() { throw new Error('not expected'); },
    async findOneAndUpdate() { return participant; },
    async updateMany() { return { modifiedCount: 0 }; }
  };
  const enrollments = [{
    _id: 'cccccccccccccccccccccccc', childId: participantId, schoolId: schoolA, status: 'active',
    programId: { name: 'Swimming' }, currentLevelId: { name: 'Water Confidence' }, currentClassId: { name: 'Saturday' },
    levelHistory: [], classAssignments: []
  }];
  const Enrollment = { find(query) { observed.enrollmentQuery = query; return chain(enrollments); } };
  const Class = { findOne: async () => null, findByIdAndUpdate: async () => null, exists: async () => false };
  const router = loadRoute({
    '../models/User': User, '../models/Class': Class, '../models/Enrollment': Enrollment,
    '../middleware/auth': auth,
    '../middleware/resourceAuthorization': {
      scopeSchoolId(user, requested) { return user.role === 'super_admin' ? requested : String(user.schoolId); }
    },
    '../utils/logger': { logger: { info() {}, warn() {}, error() {} } }
  });
  const app = express(); app.use(express.json()); app.use(router);
  return { app, observed, participant };
}


test('super admin participant listing requires and applies explicit organization context', async () => {
  const missing = await request(harness().app).get('/').set('x-role', 'super_admin');
  assert.equal(missing.status, 400);

  const h = harness();
  const scoped = await request(h.app).get(`/?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(scoped.status, 200);
  assert.equal(String(h.observed.listQuery.schoolId), schoolA);
});

test('organization admin sees enrollment context only through their tenant-scoped participant', async () => {
  const h = harness();
  const response = await request(h.app).get(`/${participantId}/enrollments`).set('x-role', 'school_admin');
  assert.equal(response.status, 200);
  assert.equal(response.body.count, 1);
  assert.equal(response.body.data[0].programId.name, 'Swimming');
  assert.equal(String(h.observed.participantQuery.schoolId), schoolA);
  assert.equal(String(h.observed.enrollmentQuery.schoolId), schoolA);
  assert.equal(String(h.observed.enrollmentQuery.childId), participantId);
});

test('super admin participant access fails closed without explicit organization context', async () => {
  const response = await request(harness().app).get(`/${participantId}/enrollments`).set('x-role', 'super_admin');
  assert.equal(response.status, 400);
  assert.match(response.body.error, /organization/i);
});

test('super admin participant access accepts an explicit organization context', async () => {
  const response = await request(harness().app).get(`/${participantId}/enrollments?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(response.status, 200);
  assert.equal(response.body.count, 1);
});

test('participant removal deactivates identity and never physically deletes it', async () => {
  const h = harness();
  const response = await request(h.app).delete(`/${participantId}`).set('x-role', 'school_admin');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.isActive, false);
  assert.equal(h.observed.saves, 1);
  assert.equal(h.observed.hardDeletes, 0);
});
