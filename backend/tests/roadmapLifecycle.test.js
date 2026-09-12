const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const Roadmap = require('../models/Roadmap');
const id = n => String(n).padStart(24, '0');
const school = id(1), program = id(2), level = id(3), actor = id(4);
const copy = value => JSON.parse(JSON.stringify(value));
const draft = (n = 10, extra = {}) => ({ _id: id(n), schoolId: school, programId: program, levelId: level, name: 'Demo', version: n, status: 'draft', __v: 0, createdBy: actor, updatedBy: actor, ...extra });
const activation = (extra = {}) => ({ __v: 0, expectedPredecessor: null, effectiveFrom: '2026-09-19T09:00:00Z', ...extra });

// Actual route code, substituted collections and transaction rollback. No DB connection.
// These tests do NOT demonstrate MongoDB isolation, index enforcement or driver retries.
function harness(initial = [draft()]) {
  const state = { rows: copy(initial), writes: [], sessions: 0, ended: 0, validProgram: true, validLevel: true, beforeUpdate: null, failTarget: false };
  let transactionTail = Promise.resolve();
  const match = (row, q) => Object.entries(q).every(([k, v]) => v && typeof v === 'object' && '$exists' in v ? (row[k] !== undefined) === v.$exists : v && typeof v === 'object' && '$in' in v ? v.$in.includes(row[k]) : String(row[k]) === String(v));
  const chain = value => ({ session() { return this; }, sort() { return this; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
  const doc = row => row ? { ...copy(row), toObject() { const result = { ...this }; delete result.toObject; return result; } } : null;
  const models = {
    Roadmap: {
      findOne: q => chain(doc(state.rows.filter(row => match(row, q)).sort((a, b) => b.version - a.version)[0])),
      find: q => chain(state.rows.filter(row => match(row, q)).map(doc)),
      async findOneAndUpdate(q, update, options) {
        if (state.beforeUpdate) { const hook = state.beforeUpdate; state.beforeUpdate = null; await hook(q, update); }
        if (state.failTarget && update.$set.status === 'active') throw Error('Injected persistence failure');
        const row = state.rows.find(r => match(r, q)); if (!row) return null;
        const next = { ...row, ...update.$set, __v: (row.__v || 0) + update.$inc.__v };
        for (const key of Object.keys(update.$unset || {})) delete next[key];
        await new Roadmap(next).validate();
        state.writes.push({ q: copy(q), update: copy(update), transactional: !!options.session });
        Object.assign(row, next); for (const key of Object.keys(update.$unset || {})) delete row[key];
        return doc(row);
      },
      async create(body) {
        const row = new Roadmap(body); await row.validate(); const data = JSON.parse(JSON.stringify(row));
        if (state.rows.some(r => r.schoolId === data.schoolId && r.programId === data.programId && r.levelId === data.levelId && r.version === data.version)) throw Object.assign(Error('Duplicate version'), { code: 11000 });
        state.rows.push(data); return doc(data);
      }
    },
    Program: { findOne: q => chain(state.validProgram && q.schoolId === school && String(q._id) === program ? { _id: program } : null) },
    Level: { findOne: q => chain(state.validLevel && q.schoolId === school && String(q.programId) === program && String(q._id) === level ? { _id: level } : null) }
  };
  const routes = [];
  const router = { use() {} }; for (const method of ['get', 'post', 'put', 'patch']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const deps = { express: { Router: () => router }, mongoose: { Types: mongoose.Types, async startSession() { state.sessions++; return {
    async withTransaction(fn) {
      // Serializes the fake store only; real isolation/retry behavior requires replica-set tests.
      const previous = transactionTail; let release;
      transactionTail = new Promise(resolve => { release = resolve; }); await previous;
      const before = copy(state.rows);
      try { await fn(); } catch (e) { state.rows = before; throw e; } finally { release(); }
    },
    async endSession() { state.ended++; }
  }; } }, '../middleware/auth': { protect() {}, authorize: (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }) }, '../middleware/resourceAuthorization': {} };
  models.Roadmap.db = { startSession: deps.mongoose.startSession };
  for (const [name, model] of Object.entries(models)) deps['../models/' + name] = model;
  const file = path.join(__dirname, '../routes/roadmaps.js');
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module: { exports: {} }, require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; } }, { filename: file });
  async function request(method, url, body = {}, target = id(10), role = 'school_admin') {
    const req = { body, query: {}, params: { id: target }, user: { _id: actor, schoolId: school, role } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    const route = routes.find(r => r.method === method && r.url === url); assert.ok(route);
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { state, request, activate: (body = activation(), target = id(10)) => request('patch', '/:id/activate', body, target) };
}
const isConflict = response => { assert.equal(response.statusCode, 409); assert.equal(response.body.code, 'ROADMAP_REVISION_CONFLICT'); };

test('first activation increments revision, preserves version and clears stale effectiveTo', async () => {
  const h = harness([draft(10, { effectiveTo: '2026-09-01T00:00:00Z' })]);
  assert.equal((await h.activate()).statusCode, 200);
  assert.equal(h.state.rows[0].status, 'active'); assert.equal(h.state.rows[0].version, 10); assert.equal(h.state.rows[0].__v, 1);
  assert.equal(new Date(h.state.rows[0].effectiveFrom).toISOString(), '2026-09-19T09:00:00.000Z'); assert.equal(h.state.rows[0].effectiveTo, undefined);
  assert.equal(h.state.sessions, 1); assert.equal(h.state.ended, 1); assert.ok(h.state.writes.every(w => w.transactional));
});
test('replacement archives exactly the expected predecessor and preserves other hierarchies', async () => {
  const old = draft(9, { status: 'active', __v: 3, effectiveFrom: '2026-09-01T00:00:00Z' });
  const unrelated = draft(8, { status: 'active', levelId: id(99) });
  const h = harness([draft(), old, unrelated]);
  assert.equal((await h.activate(activation({ expectedPredecessor: { _id: old._id, __v: 3 } }))).statusCode, 200);
  assert.equal(h.state.rows[1].status, 'archived'); assert.equal(h.state.rows[1].__v, 4);
  assert.equal(new Date(h.state.rows[1].effectiveTo).getTime(), new Date(h.state.rows[0].effectiveFrom).getTime());
  assert.deepEqual(h.state.rows[2], unrelated); assert.equal(h.state.writes.length, 2);
  assert.equal(h.state.writes[0].q._id, old._id); assert.equal(h.state.writes[0].q.__v, 3);
});
test('stale target and non-draft activation reject without changes', async () => {
  for (const extra of [{ __v: 1 }, { status: 'active' }, { status: 'archived' }]) {
    const h = harness([draft(10, extra)]), before = copy(h.state.rows);
    isConflict(await h.activate()); assert.deepEqual(h.state.rows, before); assert.equal(h.state.writes.length, 0);
  }
});
test('concurrent same-draft calls have one winner in the serialized mock transaction store', async () => {
  const h = harness(); const results = await Promise.all([h.activate(), h.activate()]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]); isConflict(results.find(r => r.statusCode === 409));
  const winner = copy(h.state.rows);
  isConflict(await h.activate()); assert.deepEqual(h.state.rows, winner);
});
test('competing draft cannot silently archive first winner using stale empty-slot expectation', async () => {
  const h = harness([draft(), draft(11)]);
  const results = await Promise.all([h.activate(), h.activate(activation(), id(11))]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]); isConflict(results.find(r => r.statusCode === 409));
  assert.equal(h.state.rows.filter(r => r.status === 'active').length, 1);
  assert.equal(h.state.rows.filter(r => r.status === 'archived').length, 0);
  const winner = copy(h.state.rows), loser = h.state.rows.find(r => r.status === 'draft');
  isConflict(await h.activate(activation(), loser._id)); assert.deepEqual(h.state.rows, winner);
});
test('missing, wrong or stale predecessor expectation cannot change records', async () => {
  for (const expected of [null, { _id: id(88), __v: 0 }, { _id: id(9), __v: 0 }]) {
    const h = harness([draft(), draft(9, { status: 'active', __v: 1 })]), before = copy(h.state.rows);
    isConflict(await h.activate(activation({ expectedPredecessor: expected }))); assert.deepEqual(h.state.rows, before);
  }
});
test('valid draft edit succeeds; activation between edit read and write rejects stale edit', async () => {
  const h = harness(); assert.equal((await h.request('put', '/:id', { __v: 0, name: 'Edited' })).statusCode, 200);
  assert.equal(h.state.rows[0].__v, 1); assert.equal(h.state.rows[0].name, 'Edited');
  h.state.beforeUpdate = async () => { assert.equal((await h.activate(activation({ __v: 1 }))).statusCode, 200); };
  isConflict(await h.request('put', '/:id', { __v: 1, name: 'Stale edit' }));
  assert.equal(h.state.rows[0].name, 'Edited'); assert.equal(h.state.rows[0].status, 'active');
  isConflict(await h.request('put', '/:id', { __v: 2, name: 'Already active' }));
});
test('stale draft revision is rejected while legacy missing revision initializes explicitly', async () => {
  const h = harness([draft(10, { __v: 2 })]); isConflict(await h.request('put', '/:id', { __v: 1, name: 'Stale' })); assert.equal(h.state.rows[0].name, 'Demo');
  const legacy = draft(); delete legacy.__v; const l = harness([legacy]);
  assert.equal((await l.request('put', '/:id', { __v: null, name: 'Legacy edit' })).statusCode, 200); assert.equal(l.state.rows[0].__v, 1);
});
test('deactivation rejects stale revisions including a change between read and write', async () => {
  const h = harness([draft(10, { status: 'active', __v: 2, effectiveFrom: '2026-09-01T00:00:00Z' })]);
  isConflict(await h.request('patch', '/:id/deactivate', { __v: 1 }));
  h.state.beforeUpdate = async () => { h.state.rows[0].__v++; };
  isConflict(await h.request('patch', '/:id/deactivate', { __v: 2 })); assert.equal(h.state.rows[0].status, 'active');
  assert.equal((await h.request('patch', '/:id/deactivate', { __v: 3, effectiveTo: '2026-09-19T09:00:00Z' })).statusCode, 200); assert.equal(h.state.rows[0].status, 'archived');
});
test('invalid program or level at activation causes no writes', async () => {
  for (const key of ['validProgram', 'validLevel']) { const h = harness(); h.state[key] = false; const before = copy(h.state.rows);
    assert.equal((await h.activate()).statusCode, 400); assert.deepEqual(h.state.rows, before); assert.equal(h.state.writes.length, 0); }
});
test('cross-tenant target and predecessor cannot be changed; teacher is forbidden', async () => {
  const h = harness([draft(), draft(9, { status: 'active', schoolId: id(99) })]), before = copy(h.state.rows);
  assert.equal((await h.activate(activation(), id(9))).statusCode, 404);
  isConflict(await h.activate(activation({ expectedPredecessor: { _id: id(9), __v: 0 } })));
  assert.equal((await h.request('patch', '/:id/activate', activation(), id(10), 'teacher')).statusCode, 403); assert.deepEqual(h.state.rows, before);
});
test('simulated transactional failure after archive restores both records (mock rollback only)', async () => {
  const h = harness([draft(), draft(9, { status: 'active' })]), before = copy(h.state.rows); h.state.failTarget = true;
  const r = await h.activate(activation({ expectedPredecessor: { _id: id(9), __v: 0 } }));
  assert.equal(r.statusCode, 503); assert.ok(!r.body.message.includes('Injected')); assert.deepEqual(h.state.rows, before); assert.equal(h.state.ended, 1);
});
test('date and expectation validation fails before changing Roadmaps', async () => {
  for (const body of [{}, activation({ __v: -1 }), activation({ expectedPredecessor: undefined }), activation({ effectiveFrom: null }), activation({ effectiveFrom: 'invalid' })]) {
    const h = harness(); assert.equal((await h.activate(body)).statusCode, 400); assert.equal(h.state.writes.length, 0);
  }
  const h = harness([draft(), draft(9, { status: 'active', effectiveFrom: '2026-10-01T00:00:00Z' })]);
  assert.equal((await h.activate(activation({ expectedPredecessor: { _id: id(9), __v: 0 } }))).statusCode, 400); assert.equal(h.state.writes.length, 0);
  assert.equal((await h.request('patch', '/:id/deactivate', { __v: 0, effectiveTo: '2026-09-01T00:00:00Z' }, id(9))).statusCode, 400);
});
test('draft creation/version routes retain draft status and duplicate-version handling', async () => {
  const h = harness(); const body = { programId: program, levelId: level, name: 'Next', status: 'active', version: 999 };
  const r = await h.request('post', '/', body); assert.equal(r.statusCode, 201); assert.equal(r.body.data.version, 11); assert.equal(r.body.data.status, 'draft'); assert.equal(h.state.sessions, 0);
  const duplicate = await h.request('post', '/:id/versions', {}); assert.equal(duplicate.statusCode, 400); assert.equal(duplicate.body.message, 'Roadmap version already exists');
  const v = harness(); const next = await v.request('post', '/:id/versions', {}); assert.equal(next.statusCode, 201); assert.equal(next.body.data.version, 11); assert.equal(next.body.data.status, 'draft');
});
