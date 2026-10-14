const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

function loadRoutes(file, active) {
  const routes = [];
  const shared = [];
  const effects = { uploads: 0, lifecycleChecks: 0, downstreamCalls: 0 };
  const router = { use: (...handlers) => shared.push(...handlers) };
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    router[method] = (url, ...handlers) => routes.push({ method, url, handlers: [...shared, ...handlers].flat(Infinity) });
  }
  const pass = (_req, _res, next) => next();
  let validatorMiddleware;
  validatorMiddleware = new Proxy(pass, {
    get: () => validatorMiddleware,
    apply(target, thisArg, args) {
      if (args.length >= 3 && typeof args[2] === 'function') return Reflect.apply(target, thisArg, args);
      return validatorMiddleware;
    }
  });
  const validator = () => validatorMiddleware;
  const validationResult = () => ({ isEmpty: () => true, array: () => [] });
  const upload = () => ({
    single: () => (_req, _res, next) => { effects.uploads += 1; next(); },
    array: () => (_req, _res, next) => { effects.uploads += 1; next(); },
    fields: () => (_req, _res, next) => { effects.uploads += 1; next(); }
  });
  upload.diskStorage = () => ({});
  const callable = () => callable;
  const generic = new Proxy(callable, {
    get: () => generic,
    apply: () => { effects.downstreamCalls += 1; return generic; }
  });
  const lifecycle = (req, res, next) => {
    effects.lifecycleChecks += 1;
    if (active) return next();
    return res.status(409).json({ success: false, message: 'Organization is deactivated' });
  };
  const stubs = {
    express: { Router: () => router },
    multer: upload,
    'express-validator': { body: validator, validationResult },
    '../middleware/auth': { protect: pass, authorize: () => pass },
    '../middleware/environment': { developmentOnly: pass },
    '../middleware/lifecycleAuthorization': { requireActiveOrganization: lifecycle },
    '../utils/logger': { logger: { info() {}, warn() {}, error() {}, debug() {} } },
    '../domain/workspaceProfile': { resolveWorkspaceProfile: () => ({ capabilities: {} }) }
  };
  const resolved = require.resolve(file);
  delete require.cache[resolved];
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name.startsWith('../models/') || name.startsWith('../services/') || name.startsWith('../utils/') || name.startsWith('../middleware/')) return generic;
    return original.call(this, name, parent, isMain);
  };
  try { require(resolved); } finally { Module._load = original; }
  return { routes, effects };
}

async function rejectedBeforeMutation(file, method, url) {
  const { routes, effects } = loadRoutes(file, false);
  // Ignore any dependency factories invoked while the route module was registered.
  effects.downstreamCalls = 0;
  const route = routes.find(item => item.method === method && item.url === url);
  assert.ok(route, `${method.toUpperCase()} ${url} is registered`);
  const req = {
    user: { _id: '111111111111111111111111', schoolId: '222222222222222222222222', role: 'school_admin' },
    body: { schoolId: '222222222222222222222222' }, query: {}, params: { id: '333333333333333333333333', reportId: '333333333333333333333333', mediaId: '444444444444444444444444', roadmapId: '555555555555555555555555' }
  };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  let completed = true;
  for (const handler of route.handlers) {
    let next = false;
    await handler(req, res, () => { next = true; });
    if (!next) { completed = false; break; }
  }
  assert.equal(completed, false);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.message, 'Organization is deactivated');
  assert.equal(effects.lifecycleChecks, 1);
  assert.equal(effects.uploads, 0, 'uploads must not run before lifecycle rejection');
  assert.equal(effects.downstreamCalls, 0, 'models and services must not run before lifecycle rejection');
}

const routeCases = {
  reports: [
    ['post', '/temp-media'],
    ['put', '/:id'], ['patch', '/:id/approve'], ['patch', '/:id/send'], ['post', '/:id/send-email'],
    ['post', '/:id/regenerate-pdf'], ['post', '/:reportId/media'], ['delete', '/:reportId/media/:mediaId']
  ],
  childParticipations: [['delete', '/:id']],
  roadmaps: [['post', '/'], ['put', '/:id'], ['post', '/:id/versions'], ['patch', '/:id/activate'], ['patch', '/:id/deactivate']],
  plannedSessions: [['post', '/:roadmapId/sessions'], ['patch', '/:id/activate'], ['put', '/:id'], ['delete', '/:id']],
  reportTemplates: [['post', '/'], ['put', '/:id'], ['delete', '/:id'], ['patch', '/:id/toggle']],
  events: [['post', '/upload-attachment'], ['post', '/'], ['put', '/:id'], ['delete', '/:id']],
  meetings: [['post', '/'], ['post', '/:id/cancel'], ['post', '/:id/reschedule'], ['post', '/:id/complete'], ['post', '/:id/no-show']],
  incidents: [
    ['post', '/'], ['put', '/:id'], ['post', '/:id/notify-parents'], ['post', '/:id/acknowledge'],
    ['post', '/:id/resolve'], ['post', '/:id/review'], ['post', '/:id/lock'], ['post', '/:id/media'], ['delete', '/:id']
  ],
  guardianRelationships: [
    ['post', '/'], ['post', '/guardians'], ['patch', '/:id'], ['post', '/:id/activate'], ['post', '/:id/revoke']
  ],
  availability: [['post', '/'], ['delete', '/:id']],
  enrollments: [
    ['post', '/:id/staff-assignments'], ['put', '/:id/staff-assignments/:assignmentId/end'],
    ['post', '/'], ['put', '/:id/class-assignment'], ['put', '/:id'], ['delete', '/:id']
  ],
  progress: [['post', '/'], ['put', '/:id']],
  students: [['post', '/'], ['put', '/:id'], ['delete', '/:id'], ['post', '/assign-teacher']]
};

for (const [name, cases] of Object.entries(routeCases)) {
  test(`${name} operational writes reject an inactive organization before mutation`, async () => {
    const file = path.join(__dirname, `../routes/${name}.js`);
    for (const [method, url] of cases) await rejectedBeforeMutation(file, method, url);
  });
}

test('active organization middleware continues to the existing report handler', async () => {
  const { routes, effects } = loadRoutes(path.join(__dirname, '../routes/reports.js'), true);
  const route = routes.find(item => item.method === 'put' && item.url === '/:id');
  const lifecycleIndex = route.handlers.findIndex(handler => handler.name === 'lifecycle');
  assert.ok(lifecycleIndex >= 0);
  let next = false;
  await route.handlers[lifecycleIndex]({}, {}, () => { next = true; });
  assert.equal(next, true);
  assert.equal(effects.lifecycleChecks, 1);
});

for (const [name, method, url] of [
  ['enrollments', 'post', '/'],
  ['progress', 'post', '/'],
  ['students', 'post', '/']
]) {
  test(`active organization middleware continues to the existing ${name} handler`, async () => {
    const { routes, effects } = loadRoutes(path.join(__dirname, `../routes/${name}.js`), true);
    const route = routes.find(item => item.method === method && item.url === url);
    assert.ok(route, `${method.toUpperCase()} ${url} is registered`);
    const lifecycleIndex = route.handlers.findIndex(handler => handler.name === 'lifecycle');
    assert.ok(lifecycleIndex >= 0);
    let next = false;
    await route.handlers[lifecycleIndex]({}, {}, () => { next = true; });
    assert.equal(next, true);
    assert.equal(effects.lifecycleChecks, 1);
  });
}
