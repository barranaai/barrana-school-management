const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');
const { authorizeSchool } = require('../middleware/auth');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';

function harness() {
  const queries = [];
  const auth = {
    protect(req, _res, next) {
      req.user = {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        role: req.get('x-role'),
        schoolId: req.get('x-school') || schoolA
      };
      next();
    },
    authorize(...roles) {
      return (req, res, next) => roles.includes(req.user.role)
        ? next()
        : res.status(403).json({ success: false, message: 'Access denied' });
    },
    authorizeSchool
  };
  const User = {
    find(criteria) {
      queries.push(criteria);
      return { select: async () => [] };
    },
    findById() { throw new Error('Unexpected user lookup'); },
    updateOne() { throw new Error('Unexpected notification update'); },
    findByIdAndUpdate() { throw new Error('Unexpected notification write'); }
  };
  const routePath = require.resolve(path.join('..', 'routes', 'communication.js'));
  delete require.cache[routePath];
  const originalLoad = Module._load;
  Module._load = function (requestName, parent, isMain) {
    const stubs = {
      '../middleware/auth': auth,
      '../models/User': User,
      '../models/Report': {},
      '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
      '../services/firebaseService': { isFirebaseInitialized: () => false }
    };
    if (Object.hasOwn(stubs, requestName)) return stubs[requestName];
    return originalLoad.call(this, requestName, parent, isMain);
  };
  let router;
  try { router = require(routePath); } finally { Module._load = originalLoad; }
  const app = express();
  app.use(express.json());
  app.use(router);
  return { app, queries };
}

for (const role of ['teacher', 'school_admin']) {
  test(`${role} cannot target report notifications at another organization`, async () => {
    const h = harness();
    const response = await request(h.app)
      .post('/report-approval-notification')
      .set('x-role', role)
      .set('x-school', schoolA)
      .send({ schoolId: schoolB, reportData: { reportId: 'report' } });
    assert.equal(response.status, 403);
    assert.equal(h.queries.length, 0);
  });
}

test('same-organization report notifications retain existing behavior', async () => {
  const h = harness();
  const response = await request(h.app)
    .post('/report-approval-notification')
    .set('x-role', 'teacher')
    .set('x-school', schoolA)
    .send({ schoolId: schoolA, reportData: { reportId: 'report' } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data, { success: true, sentCount: 0, failedCount: 0 });
  assert.equal(h.queries.length, 1);
  assert.equal(h.queries[0].schoolId, schoolA);
  assert.equal(h.queries[0].role, 'school_admin');
  assert.equal(h.queries[0].isActive, true);
});
