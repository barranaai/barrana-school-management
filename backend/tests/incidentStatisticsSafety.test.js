const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const schoolMissing = '333333333333333333333333';

const auth = {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = {
      _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      role,
      schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA)
    };
    next();
  },
  authorize(...roles) {
    return (req, res, next) => roles.includes(req.user?.role)
      ? next()
      : res.status(403).json({ success: false, error: 'Forbidden' });
  }
};

function loadRoute(stubs) {
  const resolved = require.resolve(path.join('..', 'routes', 'incidents.js'));
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

function selectable(value) {
  return { select: async () => value };
}

function harness() {
  const effects = { countQueries: [], aggregateQueries: [], lifecycleCalls: 0 };
  const School = {
    findOne(query) {
      const id = String(query._id);
      if (id === schoolA) return selectable({ _id: schoolA, isActive: false });
      if (id === schoolB) return selectable({ _id: schoolB, isActive: true });
      return selectable(null);
    }
  };
  const IncidentReport = {
    INCIDENT_TYPES: [], SEVERITY_LEVELS: [], STATUS_FLOW: [], NOTIFICATION_METHODS: [],
    async countDocuments(query) {
      effects.countQueries.push(query);
      return String(query.schoolId) === schoolA ? 3 : 5;
    },
    async aggregate(pipeline) {
      effects.aggregateQueries.push(pipeline);
      return [];
    }
  };
  const router = loadRoute({
    '../models/IncidentReport': IncidentReport,
    '../models/User': {},
    '../models/School': School,
    '../middleware/auth': auth,
    '../middleware/lifecycleAuthorization': {
      requireActiveOrganization(_req, _res, next) { effects.lifecycleCalls += 1; next(); }
    },
    '../middleware/resourceAuthorization': {
      scopeSchoolId(user, requested) { return user.role === 'super_admin' ? requested : String(user.schoolId); }
    },
    '../services/guardianAccessService': {
      async authorizedParticipants() { return []; },
      async authorizeGuardianParticipant() { return { allowed: false }; },
      async eligibleGuardiansForAll() { return []; }
    },
    '../services/firebaseService': {},
    '../utils/logger': { logger: { info() {}, warn() {}, error() {} }, auditLogger: { info() {} } }
  });
  const app = express();
  app.use(express.json());
  app.use(router);
  return { app, effects };
}

test('Super Admin incident statistics require one explicit valid organization', async () => {
  const missing = harness();
  const missingResponse = await request(missing.app).get('/stats').set('x-role', 'super_admin');
  assert.equal(missingResponse.status, 400);
  assert.equal(missing.effects.countQueries.length, 0);

  const invalid = harness();
  const invalidResponse = await request(invalid.app).get('/stats?schoolId=invalid').set('x-role', 'super_admin');
  assert.equal(invalidResponse.status, 400);
  assert.equal(invalid.effects.countQueries.length, 0);

  const unknown = harness();
  const unknownResponse = await request(unknown.app).get(`/stats?schoolId=${schoolMissing}`).set('x-role', 'super_admin');
  assert.equal(unknownResponse.status, 404);
  assert.equal(unknown.effects.countQueries.length, 0);
});

test('Super Admin statistics queries and aggregates stay inside the selected organization', async () => {
  const h = harness();
  const response = await request(h.app).get(`/stats?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.total, 3);
  assert.ok(h.effects.countQueries.length > 0);
  assert.ok(h.effects.aggregateQueries.length > 0);
  for (const query of h.effects.countQueries) assert.equal(String(query.schoolId), schoolA);
  for (const pipeline of h.effects.aggregateQueries) assert.equal(String(pipeline[0].$match.schoolId), schoolA);
});

test('inactive organizations retain authorized historical incident statistics access', async () => {
  const h = harness();
  const response = await request(h.app).get('/stats').set('x-role', 'school_admin').set('x-school', schoolA);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.total, 3);
  assert.equal(h.effects.lifecycleCalls, 0);
  for (const query of h.effects.countQueries) assert.equal(String(query.schoolId), schoolA);
});

test('unauthorized roles cannot query incident statistics or cause statistics work', async () => {
  const h = harness();
  const response = await request(h.app).get('/stats').set('x-role', 'parent').set('x-school', schoolA);
  assert.equal(response.status, 403);
  assert.equal(h.effects.countQueries.length, 0);
  assert.equal(h.effects.aggregateQueries.length, 0);
});
