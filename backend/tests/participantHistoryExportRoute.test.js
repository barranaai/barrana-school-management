const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const childA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const childB = 'bbbbbbbbbbbbbbbbbbbbbbbb';

const chain = value => { const result = { select() { return result; }, populate() { return result; }, sort() { return result; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } }; return result; };

function harness() {
  const routes = [];
  const router = { use() {}, get(route, ...handlers) { routes.push({ route, handlers }); } };
  const exports = [];
  const users = {
    [childA]: { _id: childA, schoolId: schoolA, role: 'student', firstName: 'Maya', lastName: 'Demo' },
    [childB]: { _id: childB, schoolId: schoolB, role: 'student', firstName: 'Other', lastName: 'Child' }
  };
  const deps = {
    express: { Router: () => router }, mongoose: require('mongoose'),
    '../middleware/auth': { protect(_req, _res, next) { next(); }, authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); } },
    '../middleware/resourceAuthorization': { scopeSchoolId(user, requested) { return user.role === 'super_admin' ? requested : String(user.schoolId); }, canAccessStudent: async () => true },
    '../models/User': { findOne(query) { const row = users[String(query._id)]; return chain(row && String(row.schoolId) === String(query.schoolId) ? row : null); } },
    '../models/School': { findOne(query) { return chain(String(query._id) === schoolA ? { _id: schoolA, name: 'Kidsible Academy' } : String(query._id) === schoolB ? { _id: schoolB, name: 'Other Academy' } : null); } },
    '../models/Enrollment': { find: () => chain([]) }, '../models/ChildParticipation': { find: () => chain([]) }, '../models/DeliveredSession': { find: () => chain([]) }, '../models/Progress': { find: () => chain([]) }, '../models/Report': { find: () => chain([]) },
    '../services/participantHistoryExport': { async buildParticipantHistoryExport(child, schoolId) { exports.push({ child, schoolId }); return { schema: 'kidsible.participant-history.v1' }; } },
    '../utils/logger': { logger: { error() {} } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../routes/childHistory.js'), 'utf8'), { module: { exports: {} }, require(name) { assert.ok(Object.hasOwn(deps, name), `unexpected dependency ${name}`); return deps[name]; }, console });
  const route = routes.find(item => item.route === '/:childId/export');
  async function call({ role = 'school_admin', schoolId = schoolA, requestedSchool, childId = childA } = {}) {
    const req = { user: { _id: 'cccccccccccccccccccccccc', role, schoolId: role === 'super_admin' ? undefined : schoolId }, params: { childId }, query: requestedSchool ? { schoolId: requestedSchool } : {} };
    const res = { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { call, exports };
}

test('organization admin export is tenant-scoped and private', async () => {
  const h = harness(); const response = await h.call();
  assert.equal(response.statusCode, 200); assert.equal(h.exports.length, 1); assert.equal(String(h.exports[0].schoolId), schoolA);
  assert.match(response.headers['content-disposition'], /attachment/); assert.equal(response.headers['cache-control'], 'private, no-store');
  const foreign = await h.call({ childId: childB, requestedSchool: schoolB });
  assert.equal(foreign.statusCode, 404); assert.equal(h.exports.length, 1);
});

test('teacher and parent cannot export organizational history', async () => {
  for (const role of ['teacher', 'parent']) assert.equal((await harness().call({ role })).statusCode, 403);
});

test('super admin requires explicit organization context', async () => {
  const h = harness();
  assert.equal((await h.call({ role: 'super_admin' })).statusCode, 400);
  assert.equal((await h.call({ role: 'super_admin', requestedSchool: schoolA })).statusCode, 200);
  assert.equal((await h.call({ role: 'super_admin', requestedSchool: schoolB, childId: childA })).statusCode, 404);
});
