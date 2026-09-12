const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const DeliveredSession = require('../models/DeliveredSession');
const PlannedSession = require('../models/PlannedSession');
const access = require('../middleware/resourceAuthorization');
const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const school = id(1), teacher = id(2), roadmap = id(3), program = id(4), level = id(5), cls = id(6), requirement = id(7), parameter = id(8), objective = id(9);

function setup() {
  const planned = new PlannedSession({ schoolId: school, roadmapId: roadmap, roadmapVersion: 1, sequence: 1, title: 'Floating', description: 'Lesson', methodology: 'Supported practice', expectedOutcomes: ['Float safely'], createdBy: teacher, updatedBy: teacher,
    objectives: [{ _id: objective, sequence: 1, title: 'Float', description: 'Supported float', expectedOutcome: 'Float safely', instructionalGuidance: 'Offer support', requirementId: requirement, parameterId: parameter, metadata: { demo: true } }] });
  const state = { planned, delivered: null, progressCreates: [] };
  const models = {
    PlannedSession: { findOne: async () => state.planned },
    Roadmap: { findOne: async () => ({ _id: roadmap, schoolId: school, programId: program, levelId: level, version: 1 }) },
    Program: { findOne: async () => ({ _id: program }) }, Level: { findOne: async () => ({ _id: level }) },
    Class: { findOne: async () => ({ _id: cls, assignedTeachers: [{ teacherId: teacher }] }) },
    Requirement: { find: async () => [{ _id: requirement, name: 'Floating' }] },
    Parameter: { find: async () => [{ _id: parameter, requirementId: requirement, name: 'Seconds', type: 'number' }] },
    DeliveredSession: { findOne: async () => state.delivered, create: async payload => {
      const row = new DeliveredSession(payload); await row.validate();
      // BSON round-trip + hydration approximates persistence without any connection or save.
      state.delivered = DeliveredSession.hydrate(mongoose.mongo.BSON.deserialize(mongoose.mongo.BSON.serialize(row.toObject())));
      return state.delivered;
    } },
    ChildParticipation: { findOne: async () => ({ _id: id(10), schoolId: school, deliveredSessionId: state.delivered._id, status: 'active' }) },
    Progress: { create: async payload => { state.progressCreates.push(payload); return payload; } }
  };
  async function request(routeFile, body) {
    const routes = [];
    const router = { use() {} };
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
    const deps = { express: { Router: () => router }, mongoose, '../middleware/resourceAuthorization': access,
      '../middleware/auth': { protect() {}, authorize: () => (_req, _res, next) => next() } };
    for (const [name, model] of Object.entries(models)) deps['../models/' + name] = model;
    const file = path.join(__dirname, '../routes/' + routeFile + '.js');
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: { exports: {} }, require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; } }, { filename: file });
    const route = routes.find(r => r.method === 'post' && r.url === '/');
    const req = { body, user: { _id: teacher, schoolId: school, role: 'teacher' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { state, request, create: extra => request('deliveredSessions', { plannedSessionId: planned._id, classId: cls, scheduledAt: '2026-09-19T09:00:00Z', ...extra }) };
}

test('authoritative objective ID survives DeliveredSession validation, BSON and hydration; client snapshot is ignored', async () => {
  const h = setup();
  const r = await h.create({ objectives: [{ objectiveId: id(99) }], plannedSessionSnapshot: { objectives: [{ objectiveId: id(99) }] } });
  assert.equal(r.statusCode, 201);
  const snapshot = h.state.delivered.plannedSessionSnapshot;
  const o = snapshot.objectives[0].toObject();
  assert.equal(String(o.objectiveId), String(objective));
  assert.equal(o._id, undefined);
  assert.equal(String(snapshot.plannedSessionId), String(h.state.planned._id));
  assert.equal(String(snapshot.roadmapId), String(roadmap));
  assert.equal(snapshot.roadmapVersion, 1);
  assert.equal(snapshot.title, 'Floating');
  assert.equal(snapshot.description, 'Lesson');
  assert.equal(snapshot.methodology, 'Supported practice');
  assert.deepEqual([...snapshot.expectedOutcomes], ['Float safely']);
  const expected = h.state.planned.objectives[0].toObject(); delete expected._id;
  assert.deepEqual(o, { ...expected, objectiveId: objective, requirementLabel: 'Floating', parameterLabel: 'Seconds' });
  assert.equal(JSON.parse(JSON.stringify(snapshot)).objectives[0].objectiveId, String(objective));
});

test('new Delivered Session rejects authoritative objectives with no ID rather than generating one', async () => {
  const h = setup(); h.state.planned.objectives[0]._id = null;
  const r = await h.create(); assert.equal(r.statusCode, 400);
  assert.match(r.body.message, /objective identity/); assert.equal(h.state.delivered, null);
});

test('legacy snapshots without objectiveId remain valid and readable without invented identity', async () => {
  const h = setup(); await h.create();
  const data = h.state.delivered.toObject(); delete data.plannedSessionSnapshot.objectives[0].objectiveId;
  const legacy = DeliveredSession.hydrate(data); await legacy.validate();
  assert.equal(legacy.plannedSessionSnapshot.objectives[0].objectiveId, undefined);
  assert.equal(legacy.plannedSessionSnapshot.objectives[0].title, 'Float');
});

test('Progress accepts the preserved ID, but rejects title/sequence or unrelated IDs', async () => {
  const h = setup(); await h.create(); h.state.delivered.status = 'in_progress';
  const preservedId = h.state.delivered.plannedSessionSnapshot.objectives[0].objectiveId;
  const valid = await h.request('progress', { childParticipationId: id(10), objectiveResults: [{ objectiveId: preservedId, status: 'achieved' }] });
  assert.equal(valid.statusCode, 201);
  assert.equal(String(h.state.progressCreates[0].objectiveResults[0].objectiveId), String(objective));
  for (const result of [{ sequence: 1, title: 'Float' }, { objectiveId: id(99), sequence: 1, title: 'Float' }]) {
    const r = await h.request('progress', { childParticipationId: id(10), objectiveResults: [{ ...result, status: 'achieved' }] });
    assert.equal(r.statusCode, 400); assert.match(r.body.message, /does not match/);
  }
  assert.equal(h.state.progressCreates.length, 1);
});
