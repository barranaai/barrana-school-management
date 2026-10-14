const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const schoolId = '111111111111111111111111';
const otherSchoolId = '222222222222222222222222';
const childId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const teacherId = 'bbbbbbbbbbbbbbbbbbbbbbbb';

function loadAuthorization({ classAccess = false, enrollmentAccess = false } = {}) {
  const observed = { classQuery: null, enrollmentQuery: null };
  const resolved = require.resolve(path.join('..', 'middleware', 'resourceAuthorization.js'));
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function load(name, parent, isMain) {
    if (name === '../models/Class') return {
      exists(query) { observed.classQuery = query; return Promise.resolve(classAccess); }
    };
    if (name === '../models/Enrollment') return {
      exists(query) { observed.enrollmentQuery = query; return Promise.resolve(enrollmentAccess); }
    };
    return original.call(this, name, parent, isMain);
  };
  try {
    return { authorization: require(resolved), observed };
  } finally {
    Module._load = original;
  }
}

const teacher = (overrides = {}) => ({ _id: teacherId, role: 'teacher', schoolId, ...overrides });
const child = (overrides = {}) => ({ _id: childId, role: 'student', schoolId, ...overrides });

test('active Enrollment staff assignment authorizes the assigned instructor', async () => {
  const { authorization, observed } = loadAuthorization({ enrollmentAccess: true });

  assert.equal(await authorization.canAccessStudent(teacher(), child()), true);
  assert.equal(String(observed.enrollmentQuery.schoolId), schoolId);
  assert.equal(String(observed.enrollmentQuery.childId), childId);
  assert.equal(observed.enrollmentQuery.status, 'active');
  assert.equal(String(observed.enrollmentQuery.staffAssignments.$elemMatch.staffId), teacherId);
  assert.equal(observed.enrollmentQuery.staffAssignments.$elemMatch.status, 'active');
  assert.ok(observed.enrollmentQuery.staffAssignments.$elemMatch.effectiveFrom.$lte instanceof Date);
});

test('unrelated instructor is denied when no current assignment exists', async () => {
  const { authorization, observed } = loadAuthorization();

  assert.equal(await authorization.canAccessStudent(teacher(), child()), false);
  assert.ok(observed.enrollmentQuery);
});

test('cross-organization child is denied before assignment lookup', async () => {
  const { authorization, observed } = loadAuthorization({ enrollmentAccess: true });

  assert.equal(await authorization.canAccessStudent(teacher(), child({ schoolId: otherSchoolId })), false);
  assert.equal(observed.classQuery, null);
  assert.equal(observed.enrollmentQuery, null);
});

test('legacy direct and class assignments retain their existing access behavior', async () => {
  const direct = loadAuthorization();
  assert.equal(await direct.authorization.canAccessStudent(teacher(), child({ assignedTeacher: teacherId })), true);
  assert.equal(direct.observed.enrollmentQuery, null);

  const assignedClass = loadAuthorization({ classAccess: true });
  assert.equal(await assignedClass.authorization.canAccessStudent(teacher(), child({ classId: 'cccccccccccccccccccccccc' })), true);
  assert.equal(assignedClass.observed.enrollmentQuery, null);
});

test('organization and platform administrators retain existing access behavior', async () => {
  const { authorization, observed } = loadAuthorization();

  assert.equal(await authorization.canAccessStudent({ role: 'school_admin', schoolId }, child()), true);
  assert.equal(await authorization.canAccessStudent({ role: 'school_admin', schoolId: otherSchoolId }, child()), false);
  assert.equal(await authorization.canAccessStudent({ role: 'super_admin' }, child()), true);
  assert.equal(observed.enrollmentQuery, null);
});
