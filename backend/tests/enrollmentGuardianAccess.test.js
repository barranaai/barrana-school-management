const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');

const User = require('../models/User');
const Relationship = require('../models/GuardianParticipantRelationship');
const guardianAccess = require('../services/guardianAccessService');
const resourceAuthorization = require('../middleware/resourceAuthorization');

const objectId = value => new mongoose.Types.ObjectId(String(value).padStart(24, '0'));
const ids = {
  school: objectId(1), otherSchool: objectId(2), guardian: objectId(3), otherGuardian: objectId(4),
  child: objectId(5), otherChild: objectId(6), enrollment: objectId(7), otherEnrollment: objectId(8)
};

const same = (left, right) => String(left) === String(right);

function relationship(overrides = {}) {
  return {
    schoolId: ids.school,
    guardianId: ids.guardian,
    participantId: ids.child,
    status: 'active',
    permissions: { canViewProfile: true },
    ...overrides
  };
}

function child(overrides = {}) {
  return {
    _id: ids.child,
    schoolId: ids.school,
    role: 'student',
    isActive: true,
    ...overrides
  };
}

function matchesSchool(row, schoolId) {
  return same(row.schoolId, schoolId);
}

function harness({ relationships = [], children = [child()], guardian = {}, enrollments } = {}) {
  const guardianUser = {
    _id: ids.guardian,
    schoolId: ids.school,
    role: 'parent',
    isActive: true,
    email: 'guardian@example.test',
    ...guardian
  };
  const rows = enrollments || [
    { _id: ids.enrollment, schoolId: ids.school, childId: ids.child, status: 'active' },
    { _id: ids.otherEnrollment, schoolId: ids.school, childId: ids.otherChild, status: 'active' },
    { _id: objectId(9), schoolId: ids.otherSchool, childId: ids.child, status: 'active' }
  ];
  const routes = [];
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'delete']) {
    router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  }
  const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false });
  const Enrollment = {
    find(query) {
      const result = rows.filter(row => matchesSchool(row, query.schoolId));
      return { sort: async () => result };
    },
    async findOne(query) {
      return rows.find(row => same(row._id, query._id) && matchesSchool(row, query.schoolId)) || null;
    }
  };
  const dependencies = {
    express: { Router: () => router },
    mongoose,
    '../middleware/auth': { protect: (_req, _res, next) => next(), authorize },
    '../middleware/resourceAuthorization': resourceAuthorization,
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_req, _res, next) => next() },
    '../models/Enrollment': Enrollment,
    '../models/User': User,
    '../models/Program': {},
    '../models/Level': {},
    '../models/Class': {},
    '../services/guardianAccessService': guardianAccess,
    '../services/deliveryGroupCompatibility': { supportsProgramAndLevel: () => true },
    '../services/enrollmentLifecycleService': require('../services/enrollmentLifecycleService')
  };
  const routeFile = path.resolve(__dirname, '../routes/enrollments.js');
  vm.runInNewContext(fs.readFileSync(routeFile, 'utf8'), {
    module: { exports: {} }, Date, console,
    require(name) { assert.ok(dependencies[name], name); return dependencies[name]; }
  }, { filename: routeFile });

  const originals = {
    userFind: User.find,
    userFindOne: User.findOne,
    relationshipFind: Relationship.find,
    relationshipDistinct: Relationship.distinct
  };
  Relationship.find = async query => relationships.filter(row =>
    matchesSchool(row, query.schoolId)
    && (!query.guardianId || same(row.guardianId, query.guardianId))
    && (!query.participantId || same(row.participantId, query.participantId))
  );
  Relationship.distinct = async (_field, query) => relationships
    .filter(row => matchesSchool(row, query.schoolId))
    .map(row => row.participantId);
  User.find = async query => children.filter(row => {
    if (!matchesSchool(row, query.schoolId) || row.role !== query.role) return false;
    if (query._id?.$in && !query._id.$in.some(value => same(value, row._id))) return false;
    if (query._id?.$nin && query._id.$nin.some(value => same(value, row._id))) return false;
    if (query.isActive && row.isActive === false) return false;
    if (query.$or) {
      const legacyMatch = query.$or.some(condition =>
        (condition.parentId && same(condition.parentId, row.parentId))
        || (condition.parentEmail && String(condition.parentEmail).toLowerCase() === String(row.parentEmail || '').toLowerCase())
      );
      if (!legacyMatch) return false;
    }
    return true;
  });
  User.findOne = async query => children.find(row =>
    same(row._id, query._id) && matchesSchool(row, query.schoolId) && row.role === query.role
  ) || null;

  async function request(url) {
    const route = routes.find(item => item.method === 'get' && item.url === url);
    assert.ok(route, `GET ${url}`);
    const req = {
      user: guardianUser,
      query: {},
      body: {},
      params: url === '/:id' ? { id: String(ids.enrollment) } : {}
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; }
    };
    for (const handler of route.handlers) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) break;
    }
    return res;
  }

  function restore() {
    User.find = originals.userFind;
    User.findOne = originals.userFindOne;
    Relationship.find = originals.relationshipFind;
    Relationship.distinct = originals.relationshipDistinct;
  }
  return { request, restore };
}

async function verifyListAndDetail(options, { listed, detailStatus }) {
  const h = harness(options);
  try {
    const list = await h.request('/');
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.body.data.map(row => String(row._id)), listed ? [String(ids.enrollment)] : []);
    const detail = await h.request('/:id');
    assert.equal(detail.statusCode, detailStatus);
    if (detailStatus === 200) assert.equal(String(detail.body.data._id), String(ids.enrollment));
  } finally {
    h.restore();
  }
}

test('active guardian sees only the authorized child Enrollment through list and detail routes', async () => {
  await verifyListAndDetail({ relationships: [relationship()] }, { listed: true, detailStatus: 200 });
});

test('pending guardian relationship grants no Enrollment access', async () => {
  await verifyListAndDetail({ relationships: [relationship({ status: 'pending' })] }, { listed: false, detailStatus: 403 });
});

test('revoked relationship cannot fall back to matching legacy parent identity', async () => {
  await verifyListAndDetail({
    relationships: [relationship({ status: 'revoked' })],
    children: [child({ parentId: ids.guardian, parentEmail: 'guardian@example.test' })]
  }, { listed: false, detailStatus: 403 });
});

test('cross-organization relationship grants no Enrollment access', async () => {
  await verifyListAndDetail({
    relationships: [relationship({ schoolId: ids.otherSchool })]
  }, { listed: false, detailStatus: 403 });
});

test('inactive child historical Enrollment remains available through an active authorized relationship', async () => {
  await verifyListAndDetail({
    relationships: [relationship()],
    children: [child({ isActive: false })]
  }, { listed: true, detailStatus: 200 });
});

test('guardian with no relationship or legacy identity receives no Enrollment records', async () => {
  await verifyListAndDetail({}, { listed: false, detailStatus: 403 });
});

test('legacy parent ID and email remain compatible only when no managed relationship exists', async () => {
  await verifyListAndDetail({ children: [child({ parentId: ids.guardian })] }, { listed: true, detailStatus: 200 });
  await verifyListAndDetail({
    guardian: { _id: ids.otherGuardian, email: 'LEGACY@example.test' },
    children: [child({ parentEmail: 'legacy@example.test' })]
  }, { listed: true, detailStatus: 200 });
});
