const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { integrationUri } = require('../config/integrationDatabase');
const { openRoadmapIntegration, prepareRoadmapIndexes } = require('./helpers/roadmapIntegration');

// Explicit environment is mandatory. No application/default URI fallback.
test('real Roadmap integration (isolated replica set)', { timeout: 120000 }, async t => {
  const target = new URL(integrationUri());
  assert.equal(target.hostname, '127.0.0.1');
  process.env.JWT_SECRET = randomUUID();
  process.env.ENABLE_SCHEDULERS = 'false';
  process.env.ENABLE_DEBUG_ROUTES = 'false';
  console.log(JSON.stringify({ host: target.hostname, port: target.port, database: target.pathname.slice(1), replicaSet: target.searchParams.get('replicaSet'), appName: target.searchParams.get('appName'), NODE_ENV: process.env.NODE_ENV, testJWT: true }));
  const h = await openRoadmapIntegration();
  const { Roadmap, School } = h.models;
  const owned = new Map();
  const names = ['Roadmap', 'Level', 'Program', 'User', 'School'];
  const scenario = () => h.createScenario(s => owned.set(String(s._id), s.slug));
  const call = (s, method, suffix, body) => request(h.app)[method]('/api/roadmaps' + suffix).set('Authorization', 'Bearer ' + s.token).send(body);
  const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body.data; };
  const conflict = r => { assert.equal(r.status, 409, JSON.stringify(r.body)); assert.equal(r.body.code, 'ROADMAP_REVISION_CONFLICT'); };
  const read = id => Roadmap.findById(id).lean();
  const snapshot = s => Roadmap.find({ schoolId: s.school._id }).sort({ version: 1 }).lean();
  const create = async s => ok(await call(s, 'post', '', { programId: s.program._id, levelId: s.level._id, name: 'Integration draft' }), 201);
  const activate = (s, d, predecessor = null, extra = {}) => call(s, 'patch', '/' + d._id + '/activate', { __v: d.__v, expectedPredecessor: predecessor && { _id: predecessor._id, __v: predecessor.__v }, effectiveFrom: '2026-09-20T00:00:00Z', ...extra });
  const active = async s => { const d = await create(s); ok(await activate(s, d)); return read(d._id); };
  const cases = [
    ['draft creation persists revision and hierarchy', async () => {
      const s = await scenario(), d = await create(s), row = await read(d._id);
      assert.equal(row.status, 'draft'); assert.equal(row.__v, 0); assert.equal(row.version, 1);
      for (const [field, value] of [['schoolId', s.school._id], ['programId', s.program._id], ['levelId', s.level._id]]) assert.equal(String(row[field]), String(value));
    }],
    ['draft edit increments revision and rejects stale edit', async () => {
      const s = await scenario(), d = await create(s);
      ok(await call(s, 'put', '/' + d._id, { __v: 0, name: 'Winning edit' }));
      const winner = await read(d._id); assert.equal(winner.__v, 1);
      conflict(await call(s, 'put', '/' + d._id, { __v: 0, name: 'Stale edit' }));
      assert.deepEqual(await read(d._id), winner);
    }],
    ['first activation commits with explicit null predecessor', async () => {
      const s = await scenario(), d = await create(s); ok(await activate(s, d));
      const rows = await snapshot(s); assert.equal(rows.length, 1); assert.equal(rows[0].status, 'active'); assert.equal(rows[0].__v, 1);
    }],
    ['replacement commits both exact predecessor archival and target activation', async () => {
      const s = await scenario(), old = await active(s), d = await create(s);
      ok(await activate(s, d, old));
      const rows = await snapshot(s); assert.equal(rows.length, 2);
      const archived = await read(old._id), winner = await read(d._id);
      assert.equal(archived.status, 'archived'); assert.equal(archived.__v, old.__v + 1);
      assert.equal(winner.status, 'active'); assert.equal(winner.__v, d.__v + 1);
      assert.equal(archived.effectiveTo.getTime(), winner.effectiveFrom.getTime());
      for (const key of ['schoolId', 'programId', 'levelId']) assert.equal(String(archived[key]), String(winner[key]));
    }],
    ['wrong predecessor identity and revision leave both documents unchanged', async () => {
      const s = await scenario(), old = await active(s), d = await create(s), before = await snapshot(s);
      for (const predecessor of [{ ...old, _id: d._id }, { ...old, __v: old.__v + 1 }]) {
        conflict(await activate(s, d, predecessor)); assert.deepEqual(await snapshot(s), before);
      }
    }],
    ['stale activation revision cannot partially activate', async () => {
      const s = await scenario(), d = await create(s); ok(await call(s, 'put', '/' + d._id, { __v: 0, name: 'Edited' }));
      const before = await snapshot(s); conflict(await activate(s, d)); assert.deepEqual(await snapshot(s), before);
    }],
    ['deactivation persists archival and rejects stale revision', async () => {
      const s = await scenario(), a = await active(s);
      conflict(await call(s, 'patch', '/' + a._id + '/deactivate', { __v: 0 }));
      ok(await call(s, 'patch', '/' + a._id + '/deactivate', { __v: a.__v, effectiveTo: '2026-09-21T00:00:00Z' }));
      const row = await read(a._id); assert.equal(row.status, 'archived'); assert.equal(row.__v, a.__v + 1);
      conflict(await call(s, 'patch', '/' + a._id + '/deactivate', { __v: a.__v })); assert.deepEqual(await read(a._id), row);
    }],
    ['date validation and stale effectiveTo clearing', async () => {
      const s = await scenario(), d = await create(s), before = await read(d._id);
      ok(await activate(s, d, null, { effectiveFrom: 'invalid' }), 400);
      ok(await call(s, 'put', '/' + d._id, { __v: 0, effectiveFrom: '2026-09-20', effectiveTo: '2026-09-19' }), 400);
      assert.deepEqual(await read(d._id), before);
      const edited = ok(await call(s, 'put', '/' + d._id, { __v: 0, effectiveTo: '2026-09-19' }));
      ok(await activate(s, edited)); const a = await read(d._id); assert.equal(a.effectiveTo, undefined);
      ok(await call(s, 'patch', '/' + a._id + '/deactivate', { __v: a.__v, effectiveTo: '2026-09-19' }), 400);
      const replacement = await create(s); const rows = await snapshot(s);
      ok(await activate(s, replacement, a, { effectiveFrom: '2026-09-19' }), 400); assert.deepEqual(await snapshot(s), rows);
    }],
    ['tenant and program/level validation reject foreign relationships', async () => {
      const a = await scenario(), b = await scenario(), existing = await active(a), foreign = await active(b), d = await create(a);
      const before = await snapshot(a), other = await snapshot(b);
      ok(await activate(b, d), 404); conflict(await activate(a, d, foreign));
      ok(await call(a, 'post', '', { name: 'Foreign', programId: b.program._id, levelId: b.level._id }), 400);
      // Synthetic invalid imported records exercise activation's own hierarchy checks.
      for (const fields of [{ programId: b.program._id }, { levelId: b.level._id }]) {
        const bad = await a.createDraft(fields.programId ? 50 : 51);
        await Roadmap.updateOne({ _id: bad._id, schoolId: a.school._id }, { $set: fields });
        const saved = await read(bad._id); ok(await activate(a, saved, existing), 400); assert.deepEqual(await read(bad._id), saved);
      }
      assert.deepEqual((await snapshot(a)).filter(r => r.version < 50), before); assert.deepEqual(await snapshot(b), other);
    }],
    ['real transaction rolls back predecessor archival on test-local target failure', async () => {
      const s = await scenario(), old = await active(s), d = await create(s), before = await snapshot(s);
      const original = Roadmap.findOneAndUpdate; let archived = false;
      Roadmap.findOneAndUpdate = function(filter, update, options) {
        if (String(filter._id) === String(old._id) && update.$set?.status === 'archived') {
          return original.call(this, filter, update, options).then(row => { assert.ok(options.session?.inTransaction()); archived = true; return row; });
        }
        if (String(filter._id) === String(d._id) && update.$set?.status === 'active') { assert.ok(archived); throw Error('Test-only failure after real archive'); }
        return original.call(this, filter, update, options);
      };
      try { ok(await activate(s, d, old), 503); } finally { Roadmap.findOneAndUpdate = original; }
      assert.ok(archived); assert.deepEqual(await snapshot(s), before);
    }],
    ['real partial unique index rejects a second active version', async () => {
      const s = await scenario(), a = await active(s), d = await create(s);
      const indexes = await Roadmap.collection.indexes(); assert.ok(indexes.some(i => i.unique && i.partialFilterExpression?.status === 'active'));
      await assert.rejects(Roadmap.updateOne({ _id: d._id, schoolId: s.school._id }, { $set: { status: 'active' } }), e => e.code === 11000);
      assert.equal((await read(d._id)).status, 'draft'); assert.equal((await read(a._id)).status, 'active');
    }]
  ];
  try {
    await h.verify();
    await prepareRoadmapIndexes(h);
    const actualIndexes = await Roadmap.collection.indexes();
    for (const [key, options] of Roadmap.schema.indexes()) {
      assert.ok(actualIndexes.some(index => JSON.stringify(index.key) === JSON.stringify(key) &&
        !!index.unique === !!options.unique &&
        JSON.stringify(index.partialFilterExpression) === JSON.stringify(options.partialFilterExpression)),
      'Missing declared Roadmap index: ' + JSON.stringify(key));
    }
    let failed = false;
    for (const [name, fn] of cases) {
      if (failed) { await t.test(name, { skip: 'Stopped after earlier failure' }, () => {}); continue; }
      await t.test(name, async () => { try { await fn(); } catch (e) { failed = true; throw e; } });
    }
  } finally {
    try {
      await t.test('cleanup removes only this run synthetic tenants and verifies absence', async () => {
        await h.verify();
        for (const [id, slug] of owned) {
          assert.match(slug, /^integration-[0-9a-f-]{36}$/);
          const owner = await School.findOne({ _id: id, slug }).lean(); assert.ok(owner, 'Synthetic tenant ownership must still match');
          for (const name of names.filter(n => n !== 'School')) {
            await h.models[name].deleteMany({ schoolId: id });
            assert.equal(await h.models[name].countDocuments({ schoolId: id }), 0);
          }
          await School.deleteOne({ _id: id, slug }); assert.equal(await School.countDocuments({ _id: id }), 0);
        }
        console.log('Verified cleanup of ' + owned.size + ' uniquely tracked synthetic tenants');
      });
    } finally { await h.close(); }
  }
});
