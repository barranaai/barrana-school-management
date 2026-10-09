const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const id = value => String(value).padStart(24, '0');

function harness(change = () => {}) {
  const ids = { school: id(1), progress: id(2), participation: id(3), sourceSession: id(4), sourcePlan: id(5), roadmap: id(6), target: id(7), teacher: id(8), objective: id(9) };
  const progress = { _id: ids.progress, childParticipationId: ids.participation, objectiveResults: [{ objectiveId: ids.objective, status: 'partially_achieved', instructorNote: 'private' }] };
  const participation = { _id: ids.participation, deliveredSessionId: ids.sourceSession };
  const session = { _id: ids.sourceSession, deliveredBy: ids.teacher, plannedSessionId: ids.sourcePlan, roadmapId: ids.roadmap, roadmapVersion: 2, programId: id(10), levelId: id(11), plannedSessionSnapshot: { objectives: [{ objectiveId: ids.objective, title: 'Float', description: 'Supported float', expectedOutcome: 'Five seconds' }] } };
  const target = { _id: ids.target, __v: 0, title: 'Next lesson', sequence: 2, roadmapId: ids.roadmap, roadmapVersion: 2, status: 'draft', objectives: [] };
  const state = { progress, participation, session, target, updated: null };
  change(state, ids);
  const routes = []; const router = { use() {} };
  for (const method of ['get', 'post']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false });
  const dependencies = {
    express: { Router: () => router }, mongoose,
    '../middleware/auth': { protect: (_req, _res, next) => next(), authorize },
    '../middleware/resourceAuthorization': { scopeSchoolId: (user, selected) => user.role === 'super_admin' ? selected : user.schoolId },
    '../models/Progress': { findOne: async query => String(query._id) === ids.progress && String(query.schoolId) === ids.school ? state.progress : null },
    '../models/ChildParticipation': { findOne: async query => String(query._id) === ids.participation ? state.participation : null },
    '../models/DeliveredSession': { findOne: async query => String(query._id) === ids.sourceSession ? state.session : null },
    '../models/PlannedSession': {
      find(query) { const rows = String(query.schoolId) === ids.school && String(query.roadmapId) === ids.roadmap && query.roadmapVersion === 2 ? [state.target] : []; return { sort: async () => rows }; },
      async findOne(query) { return String(query._id) === ids.target && String(query.schoolId) === ids.school && String(query.roadmapId) === ids.roadmap && query.roadmapVersion === state.target.roadmapVersion && state.target.roadmapVersion === 2 ? state.target : null; },
      async findOneAndUpdate(query, update) { if (String(query._id) !== ids.target || state.target.objectives.length) return null; state.updated = update.$push.objectives; state.target.objectives.push(state.updated); return state.target; }
    },
    '../services/objectiveCarryForwardService': require('../services/objectiveCarryForwardService')
  };
  const file = path.resolve(__dirname, '../routes/objectiveCarryForward.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: { exports: {} }, console, Date, require(name) { assert.ok(dependencies[name], name); return dependencies[name]; } }, { filename: file });
  async function request(method, url, { role = 'teacher', schoolId = ids.school, body = {}, query = {} } = {}) {
    const route = routes.find(item => item.method === method && item.url === url); assert.ok(route);
    const req = { user: { _id: ids.teacher, role, schoolId }, params: { progressId: ids.progress }, body, query };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { ids, state, request };
}

test('authorized source instructor reviews and accepts a compatible suggestion', async () => {
  const h = harness();
  const suggestions = await h.request('get', '/:progressId', { query: { schoolId: h.ids.school } });
  assert.equal(suggestions.statusCode, 200);
  assert.equal(suggestions.body.data.length, 1);
  assert.equal(suggestions.body.data[0].status, 'partially_achieved');
  assert.equal(suggestions.body.data[0].targets[0]._id, h.ids.target);
  const snapshotBefore = JSON.stringify(h.state.session.plannedSessionSnapshot);
  const accepted = await h.request('post', '/:progressId/accept', { body: { schoolId: h.ids.school, objectiveId: h.ids.objective, targetPlannedSessionId: h.ids.target, objective: { title: 'Edited float', expectedOutcome: 'Ten seconds', instructorNote: 'must not copy' } } });
  assert.equal(accepted.statusCode, 200);
  assert.equal(h.state.updated.title, 'Edited float');
  assert.equal(h.state.updated.expectedOutcome, 'Ten seconds');
  assert.equal(h.state.updated.metadata.carryForward.sourceDeliveredSessionId, h.ids.sourceSession);
  assert.equal(JSON.stringify(h.state.updated).includes('private'), false);
  assert.equal(JSON.stringify(h.state.session.plannedSessionSnapshot), snapshotBefore);
});

test('not observed, achieved and missing Progress produce no failed-objective suggestion', async () => {
  for (const status of ['not_observed', 'achieved']) {
    const h = harness(state => { state.progress.objectiveResults[0].status = status; });
    assert.deepEqual((await h.request('get', '/:progressId', { query: { schoolId: h.ids.school } })).body.data, []);
  }
  const missing = harness(state => { state.progress = null; });
  assert.equal((await missing.request('get', '/:progressId', { query: { schoolId: missing.ids.school } })).statusCode, 404);
});

test('incompatible target, duplicate objective, unauthorized role and cross tenant access are rejected', async () => {
  const incompatible = harness(state => { state.target.roadmapVersion = 3; });
  assert.equal((await incompatible.request('post', '/:progressId/accept', { body: { schoolId: incompatible.ids.school, objectiveId: incompatible.ids.objective, targetPlannedSessionId: incompatible.ids.target } })).statusCode, 409);
  const duplicate = harness((state, ids) => { state.target.objectives.push({ _id: 'new', metadata: { carryForward: { sourceObjectiveId: ids.objective } } }); });
  assert.equal((await duplicate.request('post', '/:progressId/accept', { body: { schoolId: duplicate.ids.school, objectiveId: duplicate.ids.objective, targetPlannedSessionId: duplicate.ids.target } })).statusCode, 409);
  const roles = harness();
  assert.equal((await roles.request('get', '/:progressId', { role: 'parent' })).statusCode, 403);
  assert.equal((await roles.request('get', '/:progressId', { schoolId: id(99), query: { schoolId: id(99) } })).statusCode, 404);
  assert.equal((await roles.request('get', '/:progressId', { role: 'super_admin' })).statusCode, 404);
});

test('teacher who did not deliver the source session cannot review or accept', async () => {
  const h = harness(state => { state.session.deliveredBy = id(99); });
  assert.equal((await h.request('get', '/:progressId', { query: { schoolId: h.ids.school } })).statusCode, 404);
});
