const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

function loadRoutes(file) {
  const routes = [];
  const shared = [];
  const effects = { lifecycleChecks: 0, modelCalls: 0 };
  const router = { use: (...handlers) => shared.push(...handlers) };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    router[method] = (url, ...handlers) => routes.push({ method, url, handlers: [...shared, ...handlers] });
  }
  const pass = (_req, _res, next) => next();
  const lifecycle = (_req, res) => {
    effects.lifecycleChecks += 1;
    return res.status(409).json({ success: false, message: 'Organization is deactivated' });
  };
  const callable = () => {
    effects.modelCalls += 1;
    return generic;
  };
  const generic = new Proxy(callable, { get: () => generic, apply: callable });
  const stubs = {
    express: { Router: () => router },
    '../middleware/auth': { protect: pass, authorize: () => pass },
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: lifecycle },
    '../middleware/resourceAuthorization': { scopeSchoolId: user => user.schoolId },
    '../services/deliveryGroupCompatibility': { supportsProgramAndLevel: () => true },
    '../services/individualSessionAuthorization': {
      canDeliverIndividualSession: () => true,
      isIndividualSessionTargetValid: () => true
    },
    '../utils/operationalParticipationAuthorization': { canCreateOperationalParticipation: () => true }
  };
  const resolved = require.resolve(file);
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function load(name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name.startsWith('../models/')) return generic;
    return original.call(this, name, parent, isMain);
  };
  try { require(resolved); } finally { Module._load = original; }
  return { routes, effects };
}

async function expectInactiveRejection(file, method, url) {
  const { routes, effects } = loadRoutes(file);
  const route = routes.find(item => item.method === method && item.url === url);
  assert.ok(route, `${method.toUpperCase()} ${url} is registered`);
  const req = {
    user: { _id: '111111111111111111111111', schoolId: '222222222222222222222222', role: 'teacher' },
    body: { schoolId: '222222222222222222222222' },
    query: {},
    params: { id: '333333333333333333333333' }
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  for (const handler of route.handlers) {
    let next = false;
    await handler(req, res, () => { next = true; });
    if (!next) break;
  }
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, 'Organization is deactivated');
  assert.equal(effects.lifecycleChecks, 1);
  assert.equal(effects.modelCalls, 0, 'inactive organization must be rejected before model access or writes');
}

test('inactive organization cannot create, update or transition Delivered Sessions', async () => {
  const file = path.join(__dirname, '../routes/deliveredSessions.js');
  await expectInactiveRejection(file, 'post', '/');
  await expectInactiveRejection(file, 'put', '/:id');
  await expectInactiveRejection(file, 'patch', '/:id/status');
});

test('inactive organization cannot create, update or cancel Child Participation', async () => {
  const file = path.join(__dirname, '../routes/childParticipations.js');
  await expectInactiveRejection(file, 'post', '/');
  await expectInactiveRejection(file, 'put', '/:id');
  await expectInactiveRejection(file, 'delete', '/:id');
});
