const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const Module = require('node:module');

const packageId = '111111111111111111111111';
const validDefinition = () => ({
  programs: [{
    key: 'music', name: 'Music', levels: [{
      key: 'beginner', name: 'Beginner', requirements: [{
        key: 'posture', name: 'Posture', parameters: [{ key: 'rating', name: 'Rating', type: 'rating' }]
      }]
    }],
    roadmaps: [{
      key: 'beginner-roadmap', levelKey: 'beginner', name: 'Beginner Roadmap',
      plannedSessions: [{ sequence: 1, title: 'Introduction', objectives: [{ title: 'Good posture', requirementKey: 'posture', parameterKey: 'rating' }] }]
    }]
  }]
});

function loadRoute({ role = 'super_admin', currentStatus = 'draft', createError } = {}) {
  const calls = { findQueries: [], creates: [] };
  const document = {
    _id: packageId, slug: 'music-foundation', name: 'Music Foundation', version: 1,
    organizationTypes: ['arts_studio'], definition: validDefinition(), status: currentStatus,
    async save() { return this; }
  };
  const model = {
    find(query) {
      calls.findQueries.push(query);
      return { sort() { return this; }, select: async () => [document] };
    },
    async findOne() { return document; },
    async findById() { return document; },
    async create(value) { if (createError) throw createError; calls.creates.push(value); return { _id: packageId, ...value }; }
  };
  const auth = {
    protect: (req, _res, next) => { req.user = { _id: '222222222222222222222222', role }; next(); },
    protectReadOnly: (req, _res, next) => { req.user = { _id: '222222222222222222222222', role }; next(); },
    authorize: (...roles) => (req, res, next) => roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ success: false, message: 'Forbidden' })
  };

  const resolved = require.resolve('../routes/standardPackages');
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function(name, parent, isMain) {
    if (name === '../middleware/auth') return auth;
    if (name === '../models/StandardPackage') return model;
    return original.call(this, name, parent, isMain);
  };
  let router;
  try { router = require(resolved); } finally { Module._load = original; }
  const app = express();
  app.use(express.json());
  app.use('/api/standard-packages', router);
  return { app, calls, document };
}

test('super admin catalog includes draft, published and retired package summaries', async () => {
  const h = loadRoute();
  const response = await request(h.app).get('/api/standard-packages?includeDrafts=true');
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls.findQueries[0], {});
});

test('organization admins cannot create or publish global packages', async () => {
  const h = loadRoute({ role: 'school_admin' });
  const create = await request(h.app).post('/api/standard-packages').send({});
  const publish = await request(h.app).patch(`/api/standard-packages/${packageId}/publish`).send({});
  assert.equal(create.status, 403);
  assert.equal(publish.status, 403);
});

test('creates only an allowlisted draft with authoritative organization types', async () => {
  const h = loadRoute();
  const response = await request(h.app).post('/api/standard-packages').send({
    slug: 'music-foundation', name: 'Music Foundation', description: 'A safe starting point',
    version: 1, organizationTypes: ['arts_studio'], definition: validDefinition()
  });
  assert.equal(response.status, 201);
  assert.equal(h.calls.creates.length, 1);
  assert.equal(h.calls.creates[0].status, 'draft');
  assert.equal(h.calls.creates[0].schoolId, undefined);
  assert.equal(h.calls.creates[0].role, undefined);

  const invalidType = await request(h.app).post('/api/standard-packages').send({
    slug: 'invalid-type', name: 'Invalid', version: 1,
    organizationTypes: ['swimming'], definition: validDefinition()
  });
  assert.equal(invalidType.status, 400);
  assert.equal(h.calls.creates.length, 1);
});

test('rejects top-level privilege fields and sensitive definition fields', async () => {
  const h = loadRoute();
  const topLevel = await request(h.app).post('/api/standard-packages').send({
    slug: 'music-foundation', name: 'Music Foundation', version: 1,
    organizationTypes: [], definition: validDefinition(), schoolId: packageId
  });
  assert.equal(topLevel.status, 400);

  const definition = validDefinition();
  definition.programs[0].metadata = { tenantId: packageId };
  const nested = await request(h.app).post('/api/standard-packages').send({
    slug: 'music-foundation', name: 'Music Foundation', version: 1,
    organizationTypes: [], definition
  });
  assert.equal(nested.status, 400);
  assert.equal(h.calls.creates.length, 0);
});

test('drafts can be edited while published and retired packages are immutable', async () => {
  const draft = loadRoute();
  const updated = await request(draft.app).put(`/api/standard-packages/${packageId}`).send({
    name: 'Updated Music', organizationTypes: ['arts_studio'], definition: validDefinition()
  });
  assert.equal(updated.status, 200);
  assert.equal(draft.document.name, 'Updated Music');

  for (const status of ['published', 'retired']) {
    const immutable = loadRoute({ currentStatus: status });
    const response = await request(immutable.app).put(`/api/standard-packages/${packageId}`).send({ name: 'Changed' });
    assert.equal(response.status, 409, status);
    assert.equal(immutable.document.name, 'Music Foundation', status);
  }
});

test('publishing requires an empty request and revalidates the stored definition', async () => {
  const h = loadRoute();
  const unsupported = await request(h.app).patch(`/api/standard-packages/${packageId}/publish`).send({ status: 'published' });
  assert.equal(unsupported.status, 400);
  assert.equal(h.document.status, 'draft');

  const response = await request(h.app).patch(`/api/standard-packages/${packageId}/publish`).send({});
  assert.equal(response.status, 200);
  assert.equal(h.document.status, 'published');
  assert.ok(h.document.publishedAt instanceof Date);
});


test('unexpected catalog failures never expose internal error details', async () => {
  const h = loadRoute({ createError: new Error('PRIVATE_DATABASE_CONNECTION_DETAIL') });
  const response = await request(h.app).post('/api/standard-packages').send({
    slug: 'music-foundation', name: 'Music Foundation', version: 1,
    organizationTypes: [], definition: validDefinition()
  });
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'Standard Package operation failed');
  assert.equal(JSON.stringify(response.body).includes('PRIVATE_DATABASE_CONNECTION_DETAIL'), false);
});
