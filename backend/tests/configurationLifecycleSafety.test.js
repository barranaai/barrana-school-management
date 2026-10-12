const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');
const path = require('node:path');

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const ids = {
  programs: '333333333333333333333333',
  levels: '444444444444444444444444',
  requirements: '555555555555555555555555',
  parameters: '666666666666666666666666'
};
const kinds = Object.keys(ids);

function harness() {
  const effects = { creates: [], updates: [], lifecycleChecks: 0, reads: 0 };
  const rows = {
    programs: { _id: ids.programs, schoolId: schoolA, name: 'Program', isActive: true },
    levels: { _id: ids.levels, schoolId: schoolA, programId: ids.programs, name: 'Level', isActive: true },
    requirements: { _id: ids.requirements, schoolId: schoolA, programId: ids.programs, levelId: ids.levels, name: 'Requirement', isActive: true },
    parameters: { _id: ids.parameters, schoolId: schoolA, programId: ids.programs, requirementId: ids.requirements, name: 'Parameter', type: 'text', isActive: true }
  };
  const auth = {
    protect(req, _res, next) {
      const role = req.get('x-role') || 'school_admin';
      req.user = { _id: '777777777777777777777777', role, schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA) };
      next();
    },
    authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
  };
  const scopeSchoolId = (user, requested) => user.role === 'super_admin' ? requested : String(user.schoolId);
  const lifecycle = {
    requireActiveOrganization(req, res, next) {
      effects.lifecycleChecks += 1;
      const schoolId = scopeSchoolId(req.user, req.body?.schoolId || req.query?.schoolId);
      if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
      if (req.get('x-inactive-organization') === 'true') return res.status(409).json({ success: false, message: 'Organization is deactivated' });
      next();
    }
  };
  const modelFor = kind => ({
    async create(body) {
      effects.creates.push({ kind, body });
      return { _id: ids[kind], ...body };
    },
    findOne(query) {
      effects.reads += 1;
      const row = rows[kind];
      return row && String(query._id) === String(row._id) && String(query.schoolId) === String(row.schoolId) ? Promise.resolve({ ...row }) : Promise.resolve(null);
    },
    async findOneAndUpdate(query, update) {
      const row = rows[kind];
      if (!row || String(query._id) !== String(row._id) || String(query.schoolId) !== String(row.schoolId)) return null;
      effects.updates.push({ kind, query, update });
      Object.assign(row, update.$set);
      return { ...row };
    },
    find(query) {
      effects.reads += 1;
      const data = rows[kind] && String(query.schoolId) === String(rows[kind].schoolId) ? [{ ...rows[kind] }] : [];
      return { sort: async () => data };
    }
  });
  const models = Object.fromEntries(kinds.map(kind => [kind, modelFor(kind)]));
  const routePath = require.resolve(path.join('..', 'routes', 'configuration.js'));
  delete require.cache[routePath];
  const originalLoad = Module._load;
  Module._load = function (requestName, parent, isMain) {
    const stubs = {
      '../middleware/auth': auth,
      '../middleware/resourceAuthorization': { scopeSchoolId },
      '../middleware/lifecycleAuthorization': lifecycle,
      '../models/Program': models.programs,
      '../models/Level': models.levels,
      '../models/Requirement': models.requirements,
      '../models/Parameter': models.parameters
    };
    if (Object.hasOwn(stubs, requestName)) return stubs[requestName];
    return originalLoad.call(this, requestName, parent, isMain);
  };
  let router;
  try { router = require(routePath); } finally { Module._load = originalLoad; }
  const app = express(); app.use(express.json()); app.use('/api/config', router);
  return { app, effects, rows };
}

const createPayload = kind => ({
  name: `New ${kind}`,
  ...(kind === 'levels' ? { programId: ids.programs } : {}),
  ...(kind === 'requirements' ? { programId: ids.programs, levelId: ids.levels } : {}),
  ...(kind === 'parameters' ? { programId: ids.programs, requirementId: ids.requirements, type: 'text' } : {})
});

test('inactive organizations cannot create, update, or deactivate any configuration resource', async () => {
  const h = harness();
  for (const kind of kinds) {
    const create = await request(h.app).post(`/api/config/${kind}`).set('x-inactive-organization', 'true').send(createPayload(kind));
    const update = await request(h.app).put(`/api/config/${kind}/${ids[kind]}`).set('x-inactive-organization', 'true').send({ name: 'Changed' });
    const deactivate = await request(h.app).delete(`/api/config/${kind}/${ids[kind]}`).set('x-inactive-organization', 'true');
    assert.equal(create.status, 409, `${kind} create`);
    assert.equal(update.status, 409, `${kind} update`);
    assert.equal(deactivate.status, 409, `${kind} deactivate`);
  }
  assert.equal(h.effects.lifecycleChecks, 12);
  assert.deepEqual(h.effects.creates, []);
  assert.deepEqual(h.effects.updates, []);
  assert.equal(h.effects.reads, 0);
});

test('active organizations retain valid create, update, and deactivate behavior', async () => {
  for (const kind of kinds) {
    const createHarness = harness();
    const create = await request(createHarness.app).post(`/api/config/${kind}`).send(createPayload(kind));
    assert.equal(create.status, 201, `${kind} create`);
    assert.equal(createHarness.effects.creates.length, 1);

    const updateHarness = harness();
    const update = await request(updateHarness.app).put(`/api/config/${kind}/${ids[kind]}`).send({ name: `Updated ${kind}` });
    assert.equal(update.status, 200, `${kind} update`);
    assert.equal(updateHarness.effects.updates.length, 1);

    const deactivateHarness = harness();
    const deactivate = await request(deactivateHarness.app).delete(`/api/config/${kind}/${ids[kind]}`);
    assert.equal(deactivate.status, 200, `${kind} deactivate`);
    assert.equal(deactivateHarness.effects.updates.length, 1);
    assert.equal(deactivateHarness.effects.updates[0].update.$set.isActive, false);
  }
});

test('cross-tenant writes remain denied before mutation', async () => {
  const h = harness();
  h.rows.programs.schoolId = schoolB;
  const update = await request(h.app).put(`/api/config/programs/${ids.programs}`).send({ name: 'Cross tenant' });
  const deactivate = await request(h.app).delete(`/api/config/programs/${ids.programs}`);
  assert.equal(update.status, 404);
  assert.equal(deactivate.status, 404);
  assert.deepEqual(h.effects.updates, []);
});

test('Super Admin writes require explicit matching organization scope', async () => {
  const h = harness();
  const missing = await request(h.app).put(`/api/config/programs/${ids.programs}`).set('x-role', 'super_admin').send({ name: 'Missing scope' });
  assert.equal(missing.status, 400);
  assert.deepEqual(h.effects.updates, []);

  const wrong = await request(h.app).put(`/api/config/programs/${ids.programs}`).set('x-role', 'super_admin').send({ schoolId: schoolB, name: 'Wrong scope' });
  assert.equal(wrong.status, 404);
  assert.deepEqual(h.effects.updates, []);

  const correct = await request(h.app).put(`/api/config/programs/${ids.programs}`).set('x-role', 'super_admin').send({ schoolId: schoolA, name: 'Correct scope' });
  assert.equal(correct.status, 200);
  assert.equal(h.effects.updates.length, 1);
});

test('historical configuration reads remain available while the organization is inactive', async () => {
  const h = harness();
  const detail = await request(h.app).get(`/api/config/programs/${ids.programs}?schoolId=${schoolA}`).set('x-inactive-organization', 'true');
  const list = await request(h.app).get(`/api/config/programs?schoolId=${schoolA}`).set('x-inactive-organization', 'true');
  assert.equal(detail.status, 200);
  assert.equal(list.status, 200);
  assert.equal(h.effects.lifecycleChecks, 0);
  assert.deepEqual(h.effects.creates, []);
  assert.deepEqual(h.effects.updates, []);
});
