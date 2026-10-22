const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const fixtures = require('../scripts/verticalDemoFixtures');
const { canCreateOperationalParticipation } = require('../utils/operationalParticipationAuthorization');

// Real schema casting/validation, substituted empty reads; no MongoDB connection.
function harness(existing = false) {
  const documents = {};
  const models = {};
  for (const name of ['School', 'User', 'Program', 'Level', 'Requirement', 'Parameter', 'Class', 'Enrollment', 'ReportTemplate']) {
    const Model = require('../models/' + name);
    documents[name] = [];
    function Wrapped(payload) {
      const document = new Model(payload);
      documents[name].push(document);
      return document;
    }
    Wrapped.modelName = name;
    Wrapped.schema = { set() {} };
    Wrapped.find = query => ({ limit() { return this; }, async lean() {
      return existing ? [{ ...query, _id: query._id || new mongoose.Types.ObjectId(), ...(name === 'User' ? { email: query.email } : {}) }] : [];
    } });
    Wrapped.create = () => { throw Error('Database writes are forbidden in this test'); };
    models[name] = Wrapped;
  }
  const sandbox = { module: { exports: {} }, require(name) {
    if (name === './verticalDemoFixtures') return fixtures;
    if (name === 'mongoose') return { Types: mongoose.Types, set() {}, connection: { config: {} } };
    if (name.startsWith('../models/')) return models[name.slice('../models/'.length)];
    throw Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/runVerticalDemoFixtures.js'), 'utf8'), sandbox);
  return { ...sandbox.module.exports, documents };
}

test('Swimming empty-database preflight validates all 31 records and operational relationships without writes', async () => {
  const prior = process.env.KIDSIBLE_DEMO_PASSWORD;
  process.env.KIDSIBLE_DEMO_PASSWORD = randomUUID();
  try {
    const h = harness();
    const result = await h.runVerticalDemo({ slug: 'barrana-swimming-demo' });
    assert.equal(result.dryRun, true);
    assert.equal(result.preflightPassed, true, JSON.stringify(result.validationFailures));
    assert.equal(result.conflicts.length, 0);
    assert.equal(result.validationFailures.length, 0);
    assert.equal(result.results.length, 31);
    assert.ok(result.results.every(r => r.action === 'missing'));
    const d = h.documents;
    assert.deepEqual(Object.fromEntries(Object.entries(d).map(([k,v]) => [k,v.length])), { School:1, User:6, Program:1, Level:4, Requirement:6, Parameter:6, Class:3, Enrollment:3, ReportTemplate:1 });
    const maya = d.User.find(x => x.studentId === 'SWIM-DEMO-001');
    const morgan = d.User.find(x => x.role === 'teacher');
    const avery = d.User.find(x => x.role === 'school_admin');
    const taylor = d.User.find(x => x.role === 'parent');
    const level = d.Level.find(x => x.name === 'Water Confidence');
    const cls = d.Class.find(x => x.name === 'Water Confidence - Saturday');
    const enrollment = d.Enrollment.find(x => String(x.childId) === String(maya._id));
    assert.equal(String(maya.parentId), String(taylor._id));
    assert.equal(String(cls.createdBy), String(avery._id));
    assert.equal(String(d.ReportTemplate[0].createdBy), String(avery._id));
    assert.equal(String(enrollment.currentLevelId), String(level._id));
    assert.equal(String(enrollment.currentClassId), String(cls._id));
    assert.equal(String(enrollment.programId), String(d.Program[0]._id));
    for (const r of d.Requirement) assert.ok(d.Level.some(l => String(l._id) === String(r.levelId) && String(l.programId) === String(r.programId)));
    for (const p of d.Parameter) assert.ok(d.Requirement.some(r => String(r._id) === String(p.requirementId) && String(r.programId) === String(p.programId)));
    assert.equal(canCreateOperationalParticipation({ teacher:morgan, child:maya, enrollment, cls,
      childId:maya._id, enrollmentId:enrollment._id,
      session:{ schoolId:maya.schoolId, classId:cls._id, programId:enrollment.programId, levelId:level._id, deliveredBy:morgan._id, scheduledAt:'2026-09-19T09:00:00Z' } }), true);
    for (const rows of Object.values(d)) for (const row of rows) assert.equal(String(row.schoolId || row._id), String(d.School[0]._id));
  } finally { if (prior === undefined) delete process.env.KIDSIBLE_DEMO_PASSWORD; else process.env.KIDSIBLE_DEMO_PASSWORD = prior; }
});

test('invalid creator/teacher references and assignment dates fail definition preflight', () => {
  const h = harness();
  for (const change of [f => { f.classes[0].teacherKey = 'parent'; }, f => { f.reportTemplates[0].createdByKey = 'missing'; }, f => { f.enrollments[0].startDate = 'invalid'; }, f => { f.enrollments[0].assignedByKey = 'teacher'; }]) {
    const f = JSON.parse(JSON.stringify(fixtures.verticalDemos.swimming));
    change(f);
    assert.ok(h.preflight(f, f.school.slug).length > 0);
  }
});

test('missing runtime password fails closed before any writes', async () => {
  const prior = process.env.KIDSIBLE_DEMO_PASSWORD;
  delete process.env.KIDSIBLE_DEMO_PASSWORD;
  try {
    const result = await harness().runVerticalDemo({ slug:'barrana-swimming-demo' });
    assert.equal(result.preflightPassed, false);
    assert.ok(result.conflicts.length > 0);
  } finally { if (prior !== undefined) process.env.KIDSIBLE_DEMO_PASSWORD = prior; }
});

test('write execution fails closed without an active bootstrap transaction', async () => {
  const result = await harness().runVerticalDemo({ slug: 'barrana-swimming-demo', dryRun: false });
  assert.equal(result.preflightPassed, false);
  assert.equal(result.results.length, 0);
  assert.match(result.conflicts[0].reason, /active transaction/);
});

test('bootstrap target, topology, and empty-database guards reject unsafe environments', () => {
  const bootstrap = require('../scripts/bootstrapSwimmingDemo');
  const safeUri = 'mongodb://127.0.0.1:27019/barrana_ai?replicaSet=kidsible-demo-rs&directConnection=true';
  assert.ok(Object.values(bootstrap.targetChecks(safeUri)).every(Boolean));
  for (const unsafeUri of [
    'mongodb://localhost:27019/barrana_ai?replicaSet=kidsible-demo-rs&directConnection=true',
    'mongodb://127.0.0.1:27017/barrana_ai?replicaSet=kidsible-demo-rs&directConnection=true',
    'mongodb://127.0.0.1:27019/production?replicaSet=kidsible-demo-rs&directConnection=true',
    'mongodb://127.0.0.1:27019/barrana_ai?replicaSet=other&directConnection=true'
  ]) assert.ok(Object.values(bootstrap.targetChecks(unsafeUri)).some(value => value === false));

  const hello = { setName: 'kidsible-demo-rs', isWritablePrimary: true, primary: 'localhost:27019', hosts: ['localhost:27019'] };
  assert.ok(Object.values(bootstrap.topologyChecks('barrana_ai', hello)).every(Boolean));
  assert.equal(bootstrap.topologyChecks('production', hello).databaseMatches, false);
  assert.deepEqual(bootstrap.nonSystemCollectionNames([{ name: 'system.profile' }]), []);
  assert.deepEqual(bootstrap.nonSystemCollectionNames([{ name: 'users' }, { name: 'system.profile' }]), ['users']);
});

test('demo bootstrap uses a transaction and contains no destructive database operation', () => {
  const sources = ['../scripts/bootstrapSwimmingDemo.js', '../scripts/runVerticalDemoFixtures.js']
    .map(file => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n');
  assert.match(sources, /withTransaction/);
  assert.doesNotMatch(sources, /deleteMany|deleteOne|findOneAndDelete|dropDatabase|\.drop\s*\(|remove\s*\(/);
});
