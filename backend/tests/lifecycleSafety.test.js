const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';

function loadWith(stubs, file) {
  const resolved = require.resolve(file);
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    return original.call(this, name, parent, isMain);
  };
  try { return require(resolved); } finally { Module._load = original; }
}

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

function organizationQuery(organization) {
  return { select: async () => organization };
}

test('active organization permits new operational activity', async () => {
  const School = { findOne: () => organizationQuery({ _id: schoolA, isActive: true }) };
  const { requireActiveOrganization } = loadWith({
    '../models/School': School,
    './resourceAuthorization': { scopeSchoolId: (_user, requested) => requested }
  }, path.join(__dirname, '../middleware/lifecycleAuthorization.js'));
  const req = { user: { role: 'super_admin' }, body: { schoolId: schoolA }, query: {} };
  const res = response(); let continued = false;
  await requireActiveOrganization(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.statusCode, 200);
});

test('deactivated organization rejects new operational activity without deleting history', async () => {
  const School = { findOne: () => organizationQuery({ _id: schoolA, isActive: false }) };
  const { requireActiveOrganization } = loadWith({
    '../models/School': School,
    './resourceAuthorization': { scopeSchoolId: (_user, requested) => requested }
  }, path.join(__dirname, '../middleware/lifecycleAuthorization.js'));
  const req = { user: { role: 'super_admin' }, body: { schoolId: schoolA }, query: {} };
  const res = response(); let continued = false;
  await requireActiveOrganization(req, res, () => { continued = true; });
  assert.equal(continued, false);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, 'Organization is deactivated');
});

test('Super Admin activity is checked against the explicit organization context', async () => {
  let observed;
  const School = { findOne: criteria => { observed = String(criteria._id); return organizationQuery({ _id: schoolB, isActive: true }); } };
  const { requireActiveOrganization } = loadWith({
    '../models/School': School,
    './resourceAuthorization': { scopeSchoolId: (user, requested) => user.role === 'super_admin' ? requested : String(user.schoolId) }
  }, path.join(__dirname, '../middleware/lifecycleAuthorization.js'));
  const req = { user: { role: 'super_admin' }, body: { schoolId: schoolB }, query: {} };
  await requireActiveOrganization(req, response(), () => {});
  assert.equal(observed, schoolB);
});

test('lifecycle implementation soft-deactivates organizations and teachers and preserves historical reads', () => {
  const fs = require('node:fs');
  const schools = fs.readFileSync(path.join(__dirname, '../routes/schools.js'), 'utf8');
  const teachers = fs.readFileSync(path.join(__dirname, '../routes/teachers.js'), 'utf8');
  const delivered = fs.readFileSync(path.join(__dirname, '../routes/deliveredSessions.js'), 'utf8');
  const progress = fs.readFileSync(path.join(__dirname, '../routes/progress.js'), 'utf8');
  assert.doesNotMatch(schools, /findByIdAndDelete\(req\.params\.id\)/);
  assert.match(schools, /school\.isActive = false/);
  assert.doesNotMatch(teachers, /findByIdAndDelete\(req\.params\.id\)/);
  assert.match(teachers, /teacher\.isActive = false/);
  assert.match(delivered, /router\.get\('\/:id', authorize\(\.\.\.readers\), async/);
  assert.match(progress, /router\.get\('\/:id', authorize\(\.\.\.readers\), async/);
});

test('new staff assignments require an active same-tenant teacher', () => {
  const fs = require('node:fs');
  const classes = fs.readFileSync(path.join(__dirname, '../routes/classes.js'), 'utf8');
  const assignmentChecks = [...classes.matchAll(/role: 'teacher',[\s\S]{0,100}?isActive: true/g)];
  assert.ok(assignmentChecks.length >= 3);
});
