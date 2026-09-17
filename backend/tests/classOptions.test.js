const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');

const school = '111111111111111111111111';
const otherSchool = '222222222222222222222222';
const teacher = '333333333333333333333333';
function load(file, dependencies) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, process: { env: { JWT_SECRET: 'synthetic-test-only' } }, Date,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  return module.exports;
}
function harness({ role = 'school_admin', active = true, missingUser = false, invalidToken = false, empty = false, schoolExists = true, readError = false } = {}) {
  let saves = 0;
  const user = { _id: teacher, schoolId: school, role, isActive: active, lastActivity: 'unchanged', async save() { saves++; } };
  const records = [
    { _id: 'a', name: 'Assigned', schoolId: school, isActive: true, teacherId: teacher, currentEnrollment: 7 },
    { _id: 'b', name: 'Other teacher', schoolId: school, isActive: true, teacherId: 'other', currentEnrollment: 8 },
    { _id: 'c', name: 'Other tenant', schoolId: otherSchool, isActive: true, teacherId: teacher, currentEnrollment: 9 },
    { _id: 'd', name: 'Inactive', schoolId: school, isActive: false, teacherId: teacher, currentEnrollment: 10 }
  ];
  const before = JSON.stringify(records);
  const auth = load('middleware/auth.js', {
    jsonwebtoken: { verify() { if (invalidToken) throw new Error('invalid'); return { id: teacher }; } },
    '../models/User': { findById(id) { assert.equal(id, teacher); return { select(fields) { assert.equal(fields, '-password'); return Promise.resolve(missingUser ? null : user); } }; } },
    '../utils/logger': { logger: { error() {} } }
  });
  let handlers;
  const router = { get(url, ...callbacks) { assert.equal(url, '/'); handlers = callbacks; } };
  const authorization = load('middleware/resourceAuthorization.js', { '../models/Class': {} });
  load('routes/classOptions.js', {
    express: { Router: () => router }, mongoose,
    '../middleware/auth': auth, '../middleware/resourceAuthorization': authorization,
    '../models/School': { async exists(query) { assert.ok([school, otherSchool].includes(query._id)); return schoolExists; } },
    '../models/Class': { find(query) {
      if (readError) throw new Error('sensitive detail');
      assert.equal(query.isActive, true);
      assert.ok(query.schoolId);
      return { select(fields) {
        assert.equal(fields, '_id name schoolId');
        return { sort() { return { async lean() {
          return empty ? [] : records.filter(r => r.schoolId === query.schoolId && r.isActive &&
            (!query['assignedTeachers.teacherId'] || r.teacherId === query['assignedTeachers.teacherId']))
            .map(({ _id, name, schoolId }) => ({ _id, name, schoolId }));
        } }; } };
      } };
    } }
  });
  return {
    user, auth, get saves() { return saves; },
    async request(query = {}, token = true, middleware) {
      const req = { headers: token ? { authorization: 'Bearer synthetic' } : {}, query };
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      for (const handler of middleware ? [middleware] : handlers) {
        let continued = false;
        await handler(req, res, () => { continued = true; });
        if (!continued) break;
      }
      assert.equal(JSON.stringify(records), before, 'Class records must remain unchanged');
      if (!middleware) { assert.equal(saves, 0); assert.equal(user.lastActivity, 'unchanged'); }
      return { req, res };
    }
  };
}

test('read-only request authenticates, preserves activity and classes, and projects options', async () => {
  const h = harness(); const { req, res } = await h.request();
  assert.equal(req.user, h.user);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.map(r => r._id), ['a', 'b']);
  assert.deepEqual(Object.keys(res.body.data[0]), ['_id', 'name', 'schoolId']);
});
for (const [name, options, token, message] of [
  ['invalid token', { invalidToken: true }, true, 'Not authorized, token failed'],
  ['missing token', {}, false, 'Not authorized, no token'],
  ['inactive account', { active: false }, true, 'Account is deactivated'],
  ['missing account', { missingUser: true }, true, 'User not found']
]) test(`${name}: normal and read-only authentication reject identically`, async () => {
  for (const mode of ['protect', 'protectReadOnly']) {
    const h = harness(options); const { res } = await h.request({}, token, h.auth[mode]);
    assert.equal(res.statusCode, 401); assert.equal(res.body.message, message); assert.equal(h.saves, 0);
  }
});
test('normal protect still updates activity and saves once', async () => {
  const h = harness(); const { req } = await h.request({ readOnly: true }, true, h.auth.protect);
  assert.equal(req.user, h.user); assert.equal(h.saves, 1); assert.ok(h.user.lastActivity instanceof Date);
});
test('school admin cannot request another tenant', async () => {
  assert.equal((await harness().request({ schoolId: otherSchool })).res.statusCode, 403);
});
test('super admin requires selected school and scopes results', async () => {
  const h = harness({ role: 'super_admin' });
  assert.equal((await h.request()).res.statusCode, 400);
  assert.deepEqual((await h.request({ schoolId: otherSchool })).res.body.data.map(r => r._id), ['c']);
});
test('invalid school and missing school are rejected', async () => {
  assert.equal((await harness().request({ schoolId: 'invalid' })).res.statusCode, 400);
  assert.equal((await harness({ schoolExists: false }).request()).res.statusCode, 404);
});
test('teacher sees only active assigned classes in own tenant', async () => {
  const h = harness({ role: 'teacher' });
  assert.deepEqual((await h.request()).res.body.data.map(r => r._id), ['a']);
  assert.equal((await h.request({ schoolId: otherSchool })).res.statusCode, 403);
});
test('parent and unauthenticated requests are denied', async () => {
  assert.equal((await harness({ role: 'parent' }).request()).res.statusCode, 403);
  assert.equal((await harness().request({}, false)).res.statusCode, 401);
});
test('empty options are successful', async () => {
  const { res } = await harness({ empty: true }).request();
  assert.equal(res.statusCode, 200); assert.equal(res.body.count, 0);
});
test('read failure returns a safe error', async () => {
  const { res } = await harness({ readError: true }).request();
  assert.equal(res.statusCode, 500); assert.equal(res.body.message, 'Unable to load class options');
});
