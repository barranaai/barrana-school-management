const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const ClassModel = require('../models/Class');
const workspaceProfile = require('../domain/workspaceProfile');

const schoolId = '111111111111111111111111';
const otherSchoolId = '222222222222222222222222';
const adminId = '333333333333333333333333';
const teacherId = '444444444444444444444444';
const programId = '555555555555555555555555';
const otherProgramId = '666666666666666666666666';
const levelId = '888888888888888888888888';
const otherLevelId = '999999999999999999999999';

function query(value) {
  const result = {
    select() { return result; },
    populate() { return result; },
    sort() { return result; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
  };
  return result;
}

function validator() {
  const chain = {};
  for (const method of ['trim', 'isLength', 'withMessage', 'optional', 'isMongoId', 'isInt', 'isIn', 'isArray', 'notEmpty']) {
    chain[method] = () => chain;
  }
  return chain;
}

function loadHarness({ organizationType = 'school', validProgram = programId, validLevels = [levelId], teacherExists = true, ongoingEnrollments = [] } = {}) {
  const routes = [];
  const router = {
    use() {},
    get(routePath, ...handlers) { routes.push({ method: 'get', path: routePath, handlers }); },
    post(routePath, ...handlers) { routes.push({ method: 'post', path: routePath, handlers }); },
    put(routePath, ...handlers) { routes.push({ method: 'put', path: routePath, handlers }); },
    delete(routePath, ...handlers) { routes.push({ method: 'delete', path: routePath, handlers }); }
  };

  let created;
  const updates = [];
  const existingClass = {
    _id: '777777777777777777777777', name: 'Existing Group', schoolId,
    programId, levelIds: [levelId], grade: undefined, schedule: {}, assignedTeachers: []
  };
  function Class(data) {
    Object.assign(this, data);
    this._id = '777777777777777777777777';
    this.save = async () => { created = this; return this; };
  }
  Class.findById = () => query(created);
  Class.find = () => query([]);
  Class.findOne = criteria => query(String(criteria?._id) === existingClass._id ? existingClass : null);
  Class.findByIdAndUpdate = (_id, update) => { updates.push(update); return query({ ...existingClass, ...update }); };
  const Enrollment = { find: criteria => query(ongoingEnrollments.filter(row => !criteria.status?.$in || criteria.status.$in.includes(row.status))) };

  const School = {
    findOne(criteria) {
      assert.equal(String(criteria._id), schoolId);
      return query({
        _id: schoolId,
        accountType: 'organization',
        organizationType,
        terminologyProfile: organizationType === 'school' ? 'education' : 'training'
      });
    }
  };
  const Program = {
    findOne(criteria) {
      const found = criteria._id === validProgram && String(criteria.schoolId) === schoolId
        ? { _id: validProgram, schoolId, name: 'Learn to Swim', isActive: true }
        : null;
      return query(found);
    }
  };
  const Level = {
    findOne(criteria) {
      const found = validLevels.includes(criteria._id) && criteria.programId === validProgram && String(criteria.schoolId) === schoolId
        ? { _id: criteria._id, schoolId, programId: validProgram, isActive: true }
        : null;
      return query(found);
    }
  };
  const User = {
    async findOne(criteria) {
      return teacherExists && criteria._id === teacherId && String(criteria.schoolId) === schoolId
        ? { _id: teacherId, schoolId, role: 'teacher' }
        : null;
    },
    aggregate: async () => []
  };

  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'routes', 'classes.js'), 'utf8'), {
    module,
    process: { env: {} },
    Date,
    console,
    require(name) {
      const dependencies = {
        express: { Router: () => router },
        'express-validator': { body: () => validator(), validationResult: () => ({ isEmpty: () => true, array: () => [] }) },
        '../models/Class': Class,
        '../models/User': User,
        '../models/School': School,
        '../models/Program': Program,
        '../models/Level': Level,
        '../models/Enrollment': Enrollment,
        '../domain/workspaceProfile': workspaceProfile,
        '../middleware/auth': { protect(req, res, next) { next(); }, authorize() { return (req, res, next) => next(); } },
        '../middleware/lifecycleAuthorization': { requireActiveOrganization(req, res, next) { next(); } },
        '../services/deliveryGroupCompatibility': require('../services/deliveryGroupCompatibility'),
        '../services/enrollmentLifecycleService': require('../services/enrollmentLifecycleService'),
        '../utils/logger': { logger: { info() {}, error() {} } },
        './classOptions': {}
      };
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });

  async function create(body) {
    const route = routes.find(item => item.method === 'post' && item.path === '/');
    const handler = route.handlers.at(-1);
    const req = { body, user: { id: adminId, _id: adminId, role: 'school_admin', schoolId } };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; }
    };
    await handler(req, res);
    return { res, created };
  }

  async function update(body) {
    const route = routes.find(item => item.method === 'put' && item.path === '/:id');
    const handler = route.handlers.at(-1);
    const req = { params: { id: existingClass._id }, body, user: { id: adminId, _id: adminId, role: 'school_admin', schoolId } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    await handler(req, res);
    return { res, updates };
  }

  return { routes, create, update, updates };
}

test('legacy Class validates without Program or Level and keeps existing identifiers', async () => {
  const legacy = new ClassModel({
    name: 'Legacy Class',
    schoolId: new mongoose.Types.ObjectId(schoolId),
    grade: 'grade1',
    schedule: { academicYear: '2026', semester: 'fall' },
    createdBy: new mongoose.Types.ObjectId(adminId)
  });
  await legacy.validate();
  assert.equal(legacy.programId, null);
  assert.deepEqual(legacy.levelIds, []);
});

test('Class model supports a non-school delivery group without academic fields', async () => {
  const group = new ClassModel({
    name: 'Saturday Swim Group',
    schoolId: new mongoose.Types.ObjectId(schoolId),
    programId: new mongoose.Types.ObjectId(programId),
    createdBy: new mongoose.Types.ObjectId(adminId)
  });
  await group.validate();
  assert.equal(group.grade, undefined);
  assert.equal(group.schedule?.academicYear, undefined);
  assert.equal(group.schedule?.semester, undefined);
});

test('school-style workspace still requires grade and academic year at the API boundary', async () => {
  const { res } = await loadHarness({ organizationType: 'school' }).create({ name: 'Grade One' });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(Array.from(res.body.errors, error => error.path), ['grade', 'academicYear']);
});

test('school-style workspace preserves existing academic creation behavior', async () => {
  const { res, created } = await loadHarness({ organizationType: 'school' }).create({
    name: 'Grade One',
    grade: 'grade1',
    academicYear: '2026',
    assignedTeachers: [{ teacherId, role: 'primary' }]
  });
  assert.equal(res.statusCode, 201);
  assert.equal(created.grade, 'grade1');
  assert.equal(created.schedule.academicYear, '2026');
  assert.equal(created.schedule.semester, 'fall');
  assert.equal(created.assignedTeachers[0].teacherId, teacherId);
});

test('non-school workspace creates a delivery group without academic fields', async () => {
  const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
    name: 'Saturday Swim Group'
  });
  assert.equal(res.statusCode, 201);
  assert.equal(created.grade, undefined);
  assert.equal(created.schedule.academicYear, undefined);
  assert.equal(created.schedule.semester, undefined);
});

test('same-tenant active Program is accepted', async () => {
  const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
    name: 'Saturday Swim Group',
    programId
  });
  assert.equal(res.statusCode, 201);
  assert.equal(created.programId, programId);
});

test('same-tenant Level belonging to the selected Program is accepted', async () => {
  const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
    name: 'Water Confidence Group', programId, levelIds: [levelId]
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Array.from(created.levelIds), [levelId]);
});

test('Program-wide group is accepted without a Level', async () => {
  const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
    name: 'All Levels Group', programId
  });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(Array.from(created.levelIds), []);
});

test('Level from another Program or tenant is rejected', async () => {
  for (const suppliedLevel of [otherLevelId, 'aaaaaaaaaaaaaaaaaaaaaaaa']) {
    const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
      name: 'Invalid Group', programId, levelIds: [suppliedLevel]
    });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Level not found/);
    assert.equal(created, undefined);
  }
});

test('Levels cannot be selected without a Program', async () => {
  const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
    name: 'Invalid Group', levelIds: [levelId]
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Select a Program/);
  assert.equal(created, undefined);
});

test('changing a group Program is rejected when an ongoing Enrollment would become incompatible', async () => {
  const enrollment = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', programId, currentLevelId: levelId, status: 'active' };
  const harness = loadHarness({ organizationType: 'sports_club', validProgram: otherProgramId, validLevels: [], ongoingEnrollments: [enrollment] });
  const { res, updates } = await harness.update({ programId: otherProgramId, levelIds: [] });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /ongoing Enrollments/);
  assert.equal(updates.length, 0);
});

test('removing a Level used by an ongoing Enrollment is rejected without writes', async () => {
  const enrollment = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', programId, currentLevelId: levelId, status: 'paused' };
  const harness = loadHarness({ organizationType: 'sports_club', validLevels: [levelId, otherLevelId], ongoingEnrollments: [enrollment] });
  const { res, updates } = await harness.update({ levelIds: [otherLevelId] });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /Reassign or end/);
  assert.equal(updates.length, 0);
});

test('compatible context changes succeed and terminal Enrollments do not block them', async () => {
  const rows = [
    { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', programId, currentLevelId: levelId, status: 'active' },
    { _id: 'bbbbbbbbbbbbbbbbbbbbbbbb', programId: otherProgramId, currentLevelId: otherLevelId, status: 'completed' }
  ];
  const compatible = loadHarness({ organizationType: 'sports_club', validLevels: [levelId, otherLevelId], ongoingEnrollments: rows });
  let result = await compatible.update({ levelIds: [levelId, otherLevelId] });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.updates.length, 1);

  const terminalOnly = loadHarness({ organizationType: 'sports_club', validProgram: otherProgramId, validLevels: [], ongoingEnrollments: rows.slice(1) });
  result = await terminalOnly.update({ programId: otherProgramId, levelIds: [] });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.updates.length, 1);
});

test('unrelated group updates and legacy unrestricted context remain compatible', async () => {
  const enrollment = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', programId, currentLevelId: levelId, status: 'active' };
  const unchanged = loadHarness({ organizationType: 'sports_club', ongoingEnrollments: [enrollment] });
  let result = await unchanged.update({ description: 'Updated description' });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.updates.length, 1);

  const legacy = loadHarness({ organizationType: 'sports_club', ongoingEnrollments: [enrollment] });
  result = await legacy.update({ programId: null, levelIds: [] });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.updates.length, 1);
});

for (const [name, suppliedProgram] of [
  ['cross-tenant Program', otherProgramId],
  ['nonexistent Program', '999999999999999999999999']
]) {
  test(`${name} is rejected`, async () => {
    const { res, created } = await loadHarness({ organizationType: 'sports_club' }).create({
      name: 'Saturday Swim Group',
      programId: suppliedProgram
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Program not found or not available for this organization');
    assert.equal(created, undefined);
  });
}

test('teacher assignment retains same-tenant teacher validation', async () => {
  const accepted = await loadHarness({ organizationType: 'sports_club', teacherExists: true }).create({
    name: 'Saturday Swim Group',
    assignedTeachers: [{ teacherId, role: 'primary' }]
  });
  assert.equal(accepted.res.statusCode, 201);

  const rejected = await loadHarness({ organizationType: 'sports_club', teacherExists: false }).create({
    name: 'Saturday Swim Group',
    assignedTeachers: [{ teacherId, role: 'primary' }]
  });
  assert.equal(rejected.res.statusCode, 400);
  assert.equal(rejected.created, undefined);
});

test('literal teacher assignment route is registered before the parameterized class route', () => {
  const { routes } = loadHarness();
  const teacherRoute = routes.findIndex(item => item.method === 'get' && item.path === '/teacher/assigned');
  const classRoute = routes.findIndex(item => item.method === 'get' && item.path === '/:id');
  assert.ok(teacherRoute >= 0);
  assert.ok(classRoute >= 0);
  assert.ok(teacherRoute < classRoute);
});
