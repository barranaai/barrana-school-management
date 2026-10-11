const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const teacherA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teacherB = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const auth = {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = {
      _id: 'cccccccccccccccccccccccc',
      role,
      schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA)
    };
    next();
  },
  authorize(...roles) {
    return (req, res, next) => roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ success: false, message: 'Access denied' });
  }
};

const logger = { info() {}, warn() {}, error() {} };

function loadRoute(file, stubs) {
  const resolved = require.resolve(path.join('..', 'routes', file));
  delete require.cache[resolved];
  const lifecycle = require.resolve('../middleware/lifecycleAuthorization');
  delete require.cache[lifecycle];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

function appFor(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

function selectable(value) {
  return { select: async () => value };
}

function teacherHarness({ organizationActive = true } = {}) {
  const effects = { queries: [], saves: 0, updates: [], hardDeletes: 0 };
  const teachers = new Map([
    [teacherA, { _id: teacherA, schoolId: schoolA, role: 'teacher', email: 'a@example.test', isActive: true }],
    [teacherB, { _id: teacherB, schoolId: schoolB, role: 'teacher', email: 'b@example.test', isActive: true }]
  ]);
  for (const teacher of teachers.values()) {
    teacher.save = async function () { effects.saves += 1; return this; };
  }
  const matches = query => {
    const teacher = teachers.get(String(query._id));
    return teacher && teacher.role === query.role && String(teacher.schoolId) === String(query.schoolId)
      ? teacher
      : null;
  };
  const User = {
    async findOne(query) { effects.queries.push({ ...query }); return matches(query); },
    findByIdAndUpdate(id, update) {
      effects.updates.push({ id: String(id), update: { ...update } });
      const teacher = teachers.get(String(id));
      if (teacher) Object.assign(teacher, update);
      return { select: async () => teacher };
    },
    async findByIdAndDelete() { effects.hardDeletes += 1; }
  };
  const School = {
    findOne(query) {
      const school = [schoolA, schoolB].includes(String(query._id))
        ? { _id: String(query._id), isActive: organizationActive }
        : null;
      return selectable(school);
    }
  };
  const router = loadRoute('teachers.js', {
    '../models/User': User,
    '../models/Class': {},
    '../models/Enrollment': {},
    '../models/Program': {},
    '../models/Level': {},
    '../models/Report': {},
    '../models/School': School,
    '../middleware/auth': auth,
    '../utils/logger': { logger },
    '../services/emailService': { async sendTeacherWelcomeEmail() {} }
  });
  return { app: appFor(router), effects, teachers };
}

test('organization admin deactivates only a teacher in their organization and preserves the record', async () => {
  const own = teacherHarness();
  const allowed = await request(own.app).delete(`/${teacherA}`).set('x-role', 'school_admin');
  assert.equal(allowed.status, 200);
  assert.equal(own.teachers.get(teacherA).isActive, false);
  assert.equal(own.effects.saves, 1);
  assert.equal(own.effects.hardDeletes, 0);
  assert.equal(String(own.effects.queries[0].schoolId), schoolA);

  const other = teacherHarness();
  const denied = await request(other.app).delete(`/${teacherB}`).set('x-role', 'school_admin');
  assert.equal(denied.status, 404);
  assert.equal(other.effects.saves, 0);
  assert.equal(other.effects.hardDeletes, 0);
  assert.equal(other.teachers.get(teacherB).isActive, true);
});

test('Super Admin teacher deactivation requires explicit matching organization scope', async () => {
  const missing = teacherHarness();
  const missingResponse = await request(missing.app).delete(`/${teacherB}`).set('x-role', 'super_admin');
  assert.equal(missingResponse.status, 400);
  assert.equal(missing.effects.queries.length, 0);
  assert.equal(missing.effects.saves, 0);

  const incorrect = teacherHarness();
  const incorrectResponse = await request(incorrect.app).delete(`/${teacherB}?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(incorrectResponse.status, 404);
  assert.equal(incorrect.effects.saves, 0);
  assert.equal(incorrect.teachers.get(teacherB).isActive, true);

  const correct = teacherHarness();
  const correctResponse = await request(correct.app).delete(`/${teacherB}?schoolId=${schoolB}`).set('x-role', 'super_admin');
  assert.equal(correctResponse.status, 200);
  assert.equal(correct.effects.saves, 1);
  assert.equal(correct.teachers.get(teacherB).isActive, false);
  assert.equal(String(correct.effects.queries[0].schoolId), schoolB);
});

test('teacher reactivation uses the same tenant scope and active organization rule', async () => {
  const h = teacherHarness();
  h.teachers.get(teacherA).isActive = false;
  const response = await request(h.app).put(`/${teacherA}`).set('x-role', 'school_admin').send({ isActive: true });
  assert.equal(response.status, 200);
  assert.equal(h.effects.updates.length, 1);
  assert.equal(h.effects.updates[0].update.isActive, true);
  assert.equal(String(h.effects.queries[0].schoolId), schoolA);

  const inactiveOrganization = teacherHarness({ organizationActive: false });
  inactiveOrganization.teachers.get(teacherA).isActive = false;
  const rejected = await request(inactiveOrganization.app).put(`/${teacherA}`).set('x-role', 'school_admin').send({ isActive: true });
  assert.equal(rejected.status, 409);
  assert.equal(inactiveOrganization.effects.queries.length, 0);
  assert.equal(inactiveOrganization.effects.updates.length, 0);
});

function schoolHarness() {
  const effects = { saves: 0, updates: [], hardDeletes: 0, userWrites: 0 };
  const school = {
    _id: schoolA,
    name: 'Kidsible Organization',
    isActive: true,
    async save() { effects.saves += 1; return this; },
    toObject() { return { _id: this._id, name: this.name, isActive: this.isActive }; }
  };
  const School = {
    findById(id) {
      const value = String(id) === schoolA ? school : null;
      return {
        populate: async () => value,
        then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
      };
    },
    async findByIdAndUpdate(id, update) {
      effects.updates.push({ id: String(id), update });
      Object.assign(school, update.$set || update);
      return school;
    },
    async findByIdAndDelete() { effects.hardDeletes += 1; }
  };
  const router = loadRoute('schools.js', {
    '../models/School': School,
    '../models/User': { async updateMany() { effects.userWrites += 1; } },
    '../models/Report': {},
    '../middleware/auth': auth,
    '../utils/logger': { logger },
    '../services/logoService': {
      upload: { single: () => (_req, _res, next) => next() },
      uploadSchoolLogo() {}, getSchoolLogo() {}, deleteSchoolLogo() {}
    },
    '../services/emailService': { async sendWelcomeEmail() {} }
  });
  return { app: appFor(router), effects, school };
}

test('Super Admin deactivates and reactivates an organization without deleting related records', async () => {
  const h = schoolHarness();
  const deactivated = await request(h.app).delete(`/${schoolA}`).set('x-role', 'super_admin');
  assert.equal(deactivated.status, 200);
  assert.equal(h.school.isActive, false);
  assert.equal(h.effects.saves, 1);
  assert.equal(h.effects.hardDeletes, 0);
  assert.equal(h.effects.userWrites, 0);

  const reactivated = await request(h.app).put(`/${schoolA}`).set('x-role', 'super_admin').send({ isActive: true });
  assert.equal(reactivated.status, 200);
  assert.equal(h.school.isActive, true);
  assert.equal(h.effects.updates.length, 1);
  assert.equal(h.effects.updates[0].update.$set.isActive, true);
  assert.equal(h.effects.hardDeletes, 0);
  assert.equal(h.effects.userWrites, 0);
});
