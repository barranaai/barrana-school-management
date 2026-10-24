const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const request = require('supertest');

test('liveness stays live while readiness follows database state', async () => {
  let ready = false;
  const app = require('../app').createApp({ routes: [], isDatabaseReady: () => ready });

  const live = await request(app).get('/api/health/live');
  assert.equal(live.status, 200);
  assert.equal(live.body.status, 'live');

  const unavailable = await request(app).get('/api/health/ready');
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body.checks, { database: 'unavailable' });

  const legacyUnavailable = await request(app).get('/api/health');
  assert.equal(legacyUnavailable.status, 503);

  ready = true;
  const available = await request(app).get('/api/health/ready');
  assert.equal(available.status, 200);
  assert.equal(available.body.status, 'ready');
  assert.deepEqual(available.body.checks, { database: 'ready' });
});

test('database startup failure is generic and logs no connection details', async () => {
  const logs = [];
  const secretUri = 'mongodb+srv://private-user:private-password@example.invalid/customer-data';
  const mongoose = {
    connection: { readyState: 0, on() {} },
    connect: async value => {
      assert.equal(value, secretUri);
      throw new Error(`Authentication failed for ${secretUri}`);
    }
  };
  const deps = {
    mongoose,
    '../utils/logger': {
      logger: { info(...args) { logs.push(args); }, warn(...args) { logs.push(args); }, error(...args) { logs.push(args); } },
      safeError: require('../utils/logger').safeError
    }
  };
  const box = {
    module: { exports: {} },
    process: { env: { MONGODB_URI: secretUri }, on() {} },
    require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../config/database.js'), 'utf8'), box);

  await assert.rejects(box.module.exports(), error => {
    assert.equal(error.code, 'DATABASE_CONNECTION_FAILED');
    assert.equal(error.message, 'Database connection failed');
    return true;
  });
  const output = JSON.stringify(logs);
  assert.doesNotMatch(output, /private-user|private-password|example\.invalid|customer-data/);
  assert.match(output, /DATABASE_CONNECTION_FAILED/);
});

test('Render assigns schedules to one worker and keeps web instances scheduler-free', () => {
  const blueprint = fs.readFileSync(path.join(__dirname, '../../render.yaml'), 'utf8');
  assert.match(blueprint, /CORS_ALLOWED_ORIGINS/);
  assert.doesNotMatch(blueprint, /\n\s*- key: CORS_ORIGIN\s*$/m);
  assert.match(blueprint, /type: web[\s\S]*?healthCheckPath: \/api\/health\/ready[\s\S]*?RUNTIME_ROLE[\s\S]*?value: web[\s\S]*?ENABLE_SCHEDULERS[\s\S]*?value: "false"/);
  assert.match(blueprint, /type: worker[\s\S]*?name: barrana-scheduler[\s\S]*?numInstances: 1[\s\S]*?RUNTIME_ROLE[\s\S]*?value: scheduler[\s\S]*?ENABLE_SCHEDULERS[\s\S]*?value: "true"[\s\S]*?FIREBASE_SERVICE_ACCOUNT_PATH[\s\S]*?\/etc\/secrets\/firebase-service-account\.json/);
});


test('production global errors disclose no arbitrary error fields and expose only explicitly safe 4xx messages', () => {
  const logs = [];
  const { createGlobalErrorHandler } = require('../app');
  const handler = createGlobalErrorHandler({
    logger: { error(...args) { logs.push(args); } },
    nodeEnv: 'production'
  });
  const response = () => ({
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  const privateError = Object.assign(new Error('PRIVATE_MESSAGE'), {
    name: 'PRIVATE_NAME',
    code: 'PRIVATE_CODE',
    statusCode: 400,
    stack: 'PRIVATE_STACK'
  });

  const hidden = response();
  handler(privateError, {}, hidden, () => {});
  assert.equal(hidden.statusCode, 400);
  assert.deepEqual(hidden.body, { success: false, message: 'Request failed' });
  const output = JSON.stringify(logs);
  assert.match(output, /UNHANDLED_REQUEST_ERROR/);
  assert.doesNotMatch(output, /PRIVATE_(?:MESSAGE|NAME|CODE|STACK)/);

  const publicError = Object.assign(new Error('Safe validation message'), { statusCode: 422, expose: true });
  const exposed = response();
  handler(publicError, {}, exposed, () => {});
  assert.deepEqual(exposed.body, { success: false, message: 'Safe validation message' });
});

test('process-local scheduler guard skips overlap and permits the next run after completion', async () => {
  const warnings = [];
  let release;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const { createNonOverlappingTask } = require('../utils/schedulerExecutionGuard');
  const guarded = createNonOverlappingTask('test-job', async () => {
    calls += 1;
    if (calls === 1) await gate;
    return calls;
  }, { logger: { warn(message, metadata) { warnings.push([message, metadata]); } } });

  const first = guarded();
  await new Promise(resolve => setImmediate(resolve));
  const overlap = await guarded();
  assert.deepEqual(overlap, { skipped: true, reason: 'already_running' });
  assert.equal(calls, 1);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].code, 'SCHEDULER_JOB_OVERLAP_SKIPPED');

  release();
  assert.equal(await first, 1);
  assert.equal(await guarded(), 2);

  let failed = false;
  const recovers = createNonOverlappingTask('failure-reset', async () => {
    if (!failed) { failed = true; throw new Error('expected failure'); }
    return 'recovered';
  }, { logger: { warn() {} } });
  await assert.rejects(recovers(), /expected failure/);
  assert.equal(await recovers(), 'recovered');
});

test('all five scheduled jobs use the process-local no-overlap wrapper', () => {
  const reminders = fs.readFileSync(path.join(__dirname, '../services/reminderScheduler.js'), 'utf8');
  const meetings = fs.readFileSync(path.join(__dirname, '../services/meetingReminderScheduler.js'), 'utf8');
  for (const job of ['event-reminders', 'pdf-cleanup', 'due-report-check', 'scheduled-message-processor']) {
    assert.match(reminders, new RegExp(`scheduleNonOverlapping\\(cron, [^\n]+ '${job}'`));
  }
  assert.match(meetings, /scheduleNonOverlapping\(cron, [^\n]+ 'meeting-reminders'/);
});
