const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');

const id = n => String(n).padStart(24, '0');
const ids = { school: id(1), otherSchool: id(2), teacher: id(3), child: id(4), template: id(5), program: id(6), level: id(7) };
const query = value => ({
  select() { return this; }, lean() { return Promise.resolve(value); }, populate() { return this; },
  sort() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

function reportHarness({ authorized = true, enrollmentProgram = ids.program, enrollmentLevel = ids.level } = {}) {
  const routes = [], created = [], reportQueries = [], generatorCalls = [];
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const template = { _id: ids.template, schoolId: ids.school, programId: ids.program, levelId: ids.level, isActive: true, reportFrequency: 'Monthly' };
  const child = { _id: ids.child, schoolId: ids.school, role: 'student', isActive: true, studentGrade: 'Grade 1' };
  const teacher = { _id: ids.teacher, schoolId: ids.school, role: 'teacher', isActive: true };
  const Report = {
    findOne(criteria) { reportQueries.push(criteria); return query(null); },
    async create(payload) { created.push(payload); return { _id: id(20), ...payload }; },
    findById: value => query({ _id: value, teacherId: { _id: ids.teacher, firstName: 'Test', lastName: 'Teacher' }, templateId: template }),
    find() { return query([]); }, countDocuments: async () => 0
  };
  const models = {
    Report,
    ReportTemplate: { findOne: criteria => query(String(criteria.schoolId) === ids.school && String(criteria._id) === ids.template ? template : null), find: () => query([]) },
    User: {
      findOne: criteria => query(String(criteria.schoolId) === ids.school && String(criteria._id) === ids.child ? child : null),
      findById: value => query(String(value) === ids.teacher ? teacher : null), updateOne: async () => ({})
    },
    School: { findById: value => query(String(value) === ids.school ? { _id: ids.school, settings: {}, accountType: 'organization', organizationType: 'sports_club' } : null) },
    Enrollment: { find: () => query([{ _id: id(8), schoolId: ids.school, childId: ids.child, status: 'active', programId: enrollmentProgram, currentLevelId: enrollmentLevel }]), findOne: () => query(null) },
    Progress: { findOne: () => query(null) }, ChildParticipation: { findOne: () => query(null) }, DeliveredSession: { findOne: () => query(null) }
  };
  for (const name of ['Event', 'Class']) models[name] = {};
  const multer = () => ({ array: () => (_req, _res, next) => next(), single: () => (_req, _res, next) => next(), fields: () => (_req, _res, next) => next() });
  multer.diskStorage = () => ({});
  const dependencies = {
    express: { Router: () => router }, mongoose, multer,
    '../middleware/auth': { protect: (_q, _s, next) => next(), authorize: () => (_q, _s, next) => next() },
    '../middleware/environment': { developmentOnly: (_q, _s, next) => next() },
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_q, _s, next) => next() },
    '../middleware/resourceAuthorization': {
      scopeSchoolId: (user, supplied) => user.role === 'super_admin' ? supplied : user.schoolId,
      canAccessReport: () => true, canAccessStudent: async () => true,
      belongsToSchool: () => true
    },
    '../services/reportParticipantAuthorization': { canTeacherAccessParticipantReporting: async () => authorized },
    '../services/reportTemplateContext': require('../services/reportTemplateContext'),
    '../domain/workspaceProfile': require('../domain/workspaceProfile'),
    '../services/dueReportsCalculator': { canGenerateReport: async (...args) => { generatorCalls.push(args); return { canGenerate: true }; } },
    '../utils/dateUtils': {
      getCurrentDateInTimezone: () => ({ format: () => '2026-10-11', toDate: () => new Date('2026-10-11') }),
      isReportDue: () => true, calculateDueDate: () => ({ dueDate: { format: () => '2026-11-01', toDate: () => new Date('2026-11-01') } }),
      getStartOfFrequencyPeriod: () => new Date('2026-10-01')
    },
    '../utils/logger': { logger: { info() {}, warn() {}, error() {} }, logDueDateCalculation() {}, logError() {} },
    '../middleware/environment': { developmentOnly: (_q, _s, next) => next() },
    '../services/emailService': {}, '../services/firebaseService': {}, '../services/reportPdf': {},
    '../utils/reportPublication': {},
    fs: { existsSync: () => false, mkdirSync() {}, promises: {} }, path,
    'moment-timezone': () => ({ tz: () => ({}) })
  };
  for (const [name, value] of Object.entries(models)) dependencies[`../models/${name}`] = value;
  const filename = path.join(__dirname, '../routes/reports.js');
  const box = { module: { exports: {} }, console: { log() {}, error() {}, warn() {} }, setImmediate, Buffer, process, require: name => dependencies[name] || require(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), box, { filename });

  async function call(method, url, { role = 'teacher', body = {}, query: queryValues = {} } = {}) {
    const route = routes.find(item => item.method === method && item.url === url);
    assert.ok(route, `${method} ${url}`);
    const req = { user: { ...teacher, role, ...(role === 'super_admin' ? { schoolId: undefined } : {}) }, body, query: queryValues, params: {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; }, setHeader() {}, end() {} };
    await route.handlers.at(-1)(req, res);
    return res;
  }
  return { call, created, reportQueries, generatorCalls };
}

test('due-status and can-generate allow current or historical instructor policy and deny unrelated instructors safely', async () => {
  for (const url of ['/due-status', '/can-generate']) {
    const method = url === '/due-status' ? 'get' : 'post';
    const allowed = reportHarness({ authorized: true });
    const input = { studentId: ids.child, templateId: ids.template };
    const ok = await allowed.call(method, url, method === 'get' ? { query: input } : { body: input });
    assert.equal(ok.statusCode, 200);
    const denied = reportHarness({ authorized: false });
    const blocked = await denied.call(method, url, method === 'get' ? { query: input } : { body: input });
    assert.equal(blocked.statusCode, 404);
    assert.equal(blocked.body.message, 'Reporting context not found');
    assert.equal(denied.reportQueries.length, 0);
    assert.equal(denied.generatorCalls.length, 0);
  }
});

test('legacy report creation rejects incompatible Enrollment context before writing and accepts group or individual Enrollment context', async () => {
  const invalid = reportHarness({ enrollmentProgram: id(99) });
  let response = await invalid.call('post', '/', { body: { title: 'Report', studentId: ids.child, templateId: ids.template, content: 'Content' } });
  assert.equal(response.statusCode, 409);
  assert.equal(invalid.created.length, 0);

  for (const mode of ['group', 'individual']) {
    const valid = reportHarness();
    response = await valid.call('post', '/', { role: 'school_admin', body: { title: `${mode} report`, studentId: ids.child, templateId: ids.template, content: 'Content' } });
    assert.equal(response.statusCode, 201, JSON.stringify(response.body));
    assert.equal(valid.created.length, 1);
    assert.equal(String(valid.created[0].schoolId), ids.school);
  }
});

test('Super Admin legacy report creation requires explicit organization scope', async () => {
  const harness = reportHarness();
  const payload = { title: 'Report', studentId: ids.child, templateId: ids.template, content: 'Content' };
  let response = await harness.call('post', '/', { role: 'super_admin', body: payload });
  assert.equal(response.statusCode, 404);
  assert.equal(harness.created.length, 0);
  response = await harness.call('post', '/', { role: 'super_admin', body: { ...payload, schoolId: ids.school } });
  assert.equal(response.statusCode, 201, JSON.stringify(response.body));
  assert.equal(harness.created.length, 1);

  const due = reportHarness();
  response = await due.call('get', '/due-status', { role: 'super_admin', query: { studentId: ids.child, templateId: ids.template } });
  assert.equal(response.statusCode, 404);
  response = await due.call('get', '/due-status', { role: 'super_admin', query: { schoolId: ids.school, studentId: ids.child, templateId: ids.template } });
  assert.equal(response.statusCode, 200);
});

function templateDeleteHarness({ referenced }) {
  const routes = [], calls = { saves: 0, deletes: 0 };
  const router = { use() {} };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const template = { _id: ids.template, schoolId: ids.school, isActive: true, async save() { calls.saves++; } };
  const dependencies = {
    express: { Router: () => router }, mongoose,
    '../models/ReportTemplate': { findOne: () => query(template), async deleteOne() { calls.deletes++; } },
    '../models/Report': { exists: async () => referenced }, '../models/Program': {}, '../models/Level': {}, '../models/School': {},
    '../middleware/auth': { protect: (_q, _s, next) => next(), authorize: () => (_q, _s, next) => next() },
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: (_q, _s, next) => next() },
    '../middleware/resourceAuthorization': { scopeSchoolId: user => user.schoolId }, '../domain/workspaceProfile': {}
  };
  const filename = path.join(__dirname, '../routes/reportTemplates.js');
  const box = { module: { exports: {} }, console, require: name => dependencies[name] || require(name) };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), box, { filename });
  return { calls, async remove() {
    const route = routes.find(item => item.method === 'delete' && item.url === '/:id');
    const req = { user: { role: 'school_admin', schoolId: ids.school }, params: { id: ids.template }, query: {}, body: {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
    await route.handlers.at(-1)(req, res); return { res, template };
  } };
}

test('referenced templates are retired and their historical references remain intact', async () => {
  const referenced = templateDeleteHarness({ referenced: true });
  const { res, template } = await referenced.remove();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(template.isActive, false);
  assert.equal(referenced.calls.saves, 1);
  assert.equal(referenced.calls.deletes, 0);
  const unused = templateDeleteHarness({ referenced: false });
  assert.equal((await unused.remove()).res.statusCode, 200);
  assert.equal(unused.calls.deletes, 1);
});
