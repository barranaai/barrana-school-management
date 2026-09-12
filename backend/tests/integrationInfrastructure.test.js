const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { integrationUri, assertTopology } = require('../config/integrationDatabase');
const uri = 'mongodb://127.0.0.1:27018/kidsible_integration?replicaSet=kidsible-test-rs&directConnection=true&appName=kidsible-integration';
const env = { NODE_ENV: 'test', KIDSIBLE_INTEGRATION_TESTS: '1', INTEGRATION_MONGODB_URI: uri };
const hello = { setName: 'kidsible-test-rs', isWritablePrimary: true, primary: 'localhost:27018', me: 'localhost:27018', hosts: ['localhost:27018'] };
test('explicit isolated integration URI is accepted', () => assert.equal(integrationUri(env), uri));
for (const [name, patch] of Object.entries({
  missing: { INTEGRATION_MONGODB_URI: undefined, MONGODB_URI: uri, MONGODB_URI_PROD: uri },
  mode: { KIDSIBLE_INTEGRATION_TESTS: undefined }, production: { NODE_ENV: 'production' },
  database: { INTEGRATION_MONGODB_URI: uri.replace('kidsible_integration?', 'other?') },
  port: { INTEGRATION_MONGODB_URI: uri.replace(':27018', ':27017') },
  replicaMissing: { INTEGRATION_MONGODB_URI: uri.replace('replicaSet=kidsible-test-rs&', '') },
  replicaWrong: { INTEGRATION_MONGODB_URI: uri.replace('kidsible-test-rs', 'other') },
  unmarked: { INTEGRATION_MONGODB_URI: uri.replace('appName=kidsible-integration', 'appName=other') },
  remote: { INTEGRATION_MONGODB_URI: uri.replace('127.0.0.1', 'example.com') },
  extraOption: { INTEGRATION_MONGODB_URI: uri + '&dbName=other' }
})) test('integration guard rejects ' + name, () => assert.throws(() => integrationUri({ ...env, ...patch })));
test('topology guard accepts only expected PRIMARY and single member', () => {
  assert.doesNotThrow(() => assertTopology(hello));
  for (const patch of [{ setName: undefined }, { setName: 'other' }, { isWritablePrimary: false }, { hosts: ['localhost:27018', 'other:27018'] }, { primary: 'localhost:27017' }]) assert.throws(() => assertTopology({ ...hello, ...patch }));
});
test('app and server imports/construction do not connect, load routes or register process startup', () => {
  const mongoose = require('mongoose');
  const original = mongoose.connect; mongoose.connect = () => { throw Error('Unexpected connection'); };
  const before = process.listenerCount('SIGINT');
  try {
    const { createApp } = require('../app'); const runtime = require('../server');
    const app = createApp(); assert.equal(typeof app, 'function'); assert.equal(typeof runtime.startServer, 'function');
    assert.equal(mongoose.connection.readyState, 0); assert.equal(process.listenerCount('SIGINT'), before);
    assert.equal(require.cache[require.resolve('../routes/roadmaps')], undefined);
    assert.equal(require.cache[require.resolve('../config/database')], undefined);
  } finally { mongoose.connect = original; }
});
test('runtime entry preserves environment, route, socket, connection, listener and scheduler startup', () => {
  const calls = []; const app = { initializeRoutes() { calls.push('routes'); } };
  const server = { listen(port, host, callback) { calls.push(['listen', port, host]); callback(); } };
  const jobs = Object.fromEntries(['initializeReminderScheduler','initializePDFCleanup','initializeScheduledMessageProcessor','initializeDueReportChecker'].map(name => [name, () => calls.push(name)]));
  const deps = { dotenv: { config() { calls.push('env'); } }, './utils/logger': { logger: { info() {} } }, './app': { createApp() { calls.push('app'); return app; } }, http: { createServer(a) { assert.equal(a, app); return server; } }, './services/socketService': { initialize(s) { assert.equal(s, server); calls.push('socket'); } }, './config/database': () => calls.push('database'), './services/reminderScheduler': jobs, './services/meetingReminderScheduler': { initializeMeetingReminderScheduler() { calls.push('meetings'); } } };
  const box = { module: { exports: {} }, process: { env: { PORT: '5050', ENABLE_SCHEDULERS: 'true' }, on(signal) { calls.push(signal); } }, require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8'), box);
  assert.deepEqual(calls, []); box.module.exports.startServer();
  assert.deepEqual(calls.slice(0, 6), ['env','app','routes','socket','database',['listen','5050','0.0.0.0']]);
  assert.ok(calls.includes('initializePDFCleanup')); assert.ok(calls.includes('meetings')); assert.ok(calls.includes('SIGTERM'));
});
test('test harness refuses missing configuration before creating any connection', async () => {
  const saved = { ...process.env }; const mongoose = require('mongoose'); const original = mongoose.createConnection;
  mongoose.createConnection = () => { throw Error('Connection must not be attempted'); };
  process.env.NODE_ENV = 'test'; process.env.KIDSIBLE_INTEGRATION_TESTS = '1'; delete process.env.INTEGRATION_MONGODB_URI;
  try { await assert.rejects(require('./helpers/integrationHarness').openIntegrationHarness(), /INTEGRATION_MONGODB_URI is required/); }
  finally { mongoose.createConnection = original; for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); }
});
test('Roadmap model can bind to an isolated disconnected connection without binding default', async () => {
  const isolated = new (require('mongoose').Mongoose)(); isolated.set('autoIndex', false); isolated.set('autoCreate', false);
  const schema = require('../models/Roadmap').schema;
  const model = isolated.model('RoadmapTestBinding', schema); const connection = isolated.createConnection();
  model.useConnection(connection); assert.equal(model.db, connection); assert.notEqual(model.db, isolated.connection);
  await connection.close();
});
test('Compose definition uses isolated names, loopback port and pinned image', () => {
  const text = fs.readFileSync(path.join(__dirname, '../../compose.integration.yml'), 'utf8');
  assert.match(text, /8\.0\.29-ubi9-slim/); assert.match(text, /127\.0\.0\.1:27018:27018/);
  assert.match(text, /kidsible-integration-data/); assert.doesNotMatch(text, /barrana|27017|external:\s*true/);
});

test('harness rejects wrong topology before route loading, model binding or indexes', async () => {
  const calls = []; const connection = { name: 'kidsible_integration', readyState: 1, asPromise: async () => {}, close: async () => calls.push('close'), db: { admin: () => ({ command: async () => ({ ...hello, setName: 'wrong' }) }) } };
  const deps = { mongoose: { connection: { readyState: 0 }, modelNames: () => [], set() {}, createConnection(_uri, options) { assert.equal(options.autoIndex, false); assert.equal(options.autoCreate, false); return connection; } }, 'node:crypto': require('node:crypto'), '../../config/integrationDatabase': { ...require('../config/integrationDatabase'), integrationUri: () => uri } };
  const box = { module: { exports: {} }, process: { env: {} }, require(name) { assert.ok(Object.hasOwn(deps, name), 'Unexpected import before validation: ' + name); return deps[name]; } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'helpers/integrationHarness.js'), 'utf8'), box);
  await assert.rejects(box.module.exports.openIntegrationHarness(), /PRIMARY/); assert.deepEqual(calls, ['close']);
});

for (const mode of ['new', 'throws-uninitialized', 'throws-unrelated', 'throws-message-only', 'existing', 'wrong']) test('initializer is guarded and idempotent: ' + mode, () => {
  const commands = [];
  const admin = { runCommand(command) {
    const name = Object.keys(command)[0]; commands.push(name);
    if (name === 'getCmdLineOpts') return { ok: 1, parsed: { replication: { replSet: 'kidsible-test-rs' }, net: { port: 27018 } } };
    if (name === 'replSetGetConfig' && mode.startsWith('throws-')) {
      const error = new (require('mongodb').MongoServerError)({ message: 'no replset config has been received', ...(mode === 'throws-message-only' ? {} : { code: mode === 'throws-uninitialized' ? 94 : 13, codeName: mode === 'throws-uninitialized' ? 'NotYetInitialized' : 'Unauthorized' }) });
      throw error;
    }
    if (name === 'replSetGetConfig') return mode === 'new' ? { ok: 0, code: 94 } : { ok: 1, config: { _id: mode === 'wrong' ? 'other' : 'kidsible-test-rs', members: [{ host: 'localhost:27018' }] } };
    if (name === 'replSetInitiate') return { ok: 1 };
    if (name === 'hello') return hello;
    throw Error('Unexpected command');
  } };
  const run = () => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../integration/init-replica-set.js'), 'utf8'), {
    Mongo: function (target) { assert.equal(target, 'mongodb://127.0.0.1:27018/kidsible_integration?directConnection=true&appName=kidsible-integration'); return { getDB: () => admin }; }, sleep() {}, print() {}
  });
  if (mode === 'wrong') assert.throws(run, /Unexpected replica configuration/);
  else if (mode === 'throws-unrelated' || mode === 'throws-message-only') assert.throws(run, /no replset config has been received/);
  else assert.doesNotThrow(run);
  assert.equal(commands.filter(c => c === 'replSetInitiate').length, (mode === 'new' || mode === 'throws-uninitialized') ? 1 : 0);
  assert.ok(commands.every(c => ['getCmdLineOpts', 'replSetGetConfig', 'replSetInitiate', 'hello'].includes(c)));
});

for (const replication of [{}, { replSet: 'other' }, { replSetName: 'kidsible-test-rs' }]) test('initializer rejects unexpected parsed replication ' + JSON.stringify(replication), () => {
  const commands = [];
  assert.throws(() => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../integration/init-replica-set.js'), 'utf8'), {
    Mongo: function(target) {
      assert.equal(target, 'mongodb://127.0.0.1:27018/kidsible_integration?directConnection=true&appName=kidsible-integration');
      return { getDB(name) { assert.equal(name, 'admin'); return { runCommand(command) {
        commands.push(Object.keys(command)[0]);
        return { ok: 1, parsed: { replication, net: { port: 27018 } } };
      } }; } };
    }, sleep() {}, print() {}
  }), /Refusing initialization/);
  assert.deepEqual(commands, ['getCmdLineOpts']);
});

test('Roadmap preparation requests only Roadmap schema indexes after isolation verification', async () => {
  const { prepareRoadmapIndexes } = require('./helpers/roadmapIntegration');
  const connection = {}, calls = [];
  const models = Object.fromEntries(['School', 'User', 'Program', 'Level', 'Roadmap'].map(name => [name, {
    db: connection, async createCollection() { calls.push('collection:' + name); },
    async createIndexes() { assert.equal(name, 'Roadmap', 'Unrelated index synchronization'); calls.push('indexes:' + name); }
  }]));
  await prepareRoadmapIndexes({ connection, models, async verify() { calls.push('verify'); } });
  assert.deepEqual(calls, ['verify', 'collection:School', 'collection:User', 'collection:Program', 'collection:Level', 'collection:Roadmap', 'indexes:Roadmap']);
  calls.length = 0;
  await assert.rejects(prepareRoadmapIndexes({ connection, models, async verify() { throw Error('Wrong topology'); } }), /Wrong topology/);
  assert.deepEqual(calls, []);
});

test('Roadmap suite retains run ownership and filtered cleanup boundaries', () => {
  const source = fs.readFileSync(path.join(__dirname, 'roadmap.integration.test.js'), 'utf8');
  assert.match(source, /createScenario\(s => owned\.set\(String\(s\._id\), s\.slug\)\)/);
  assert.match(source, /School\.findOne\(\{ _id: id, slug \}\)/);
  assert.match(source, /deleteMany\(\{ schoolId: id \}\)/);
  assert.match(source, /School\.deleteOne\(\{ _id: id, slug \}\)/);
  assert.doesNotMatch(source, /deleteMany\(\s*\{\s*\}\s*\)|dropDatabase|\.drop\(/);
});
