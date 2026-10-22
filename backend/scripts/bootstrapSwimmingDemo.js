// Manual bootstrap wrapper. Syntax-check only during diagnostic development.
// Does not load application configuration or provide a database fallback.
const mongoose = require('mongoose');
const URI = 'mongodb://127.0.0.1:27019/barrana_ai?replicaSet=kidsible-demo-rs&directConnection=true';
const SLUG = 'barrana-swimming-demo';
const diagnosticOnly = process.argv.slice(2).includes('--diagnostic');
let stage = 'START';

function targetChecks(uri) {
  let target;
  try { target = new URL(uri); }
  catch (_) { return { validUrl: false }; }
  return {
    validUrl: true,
    protocolMatches: target.protocol === 'mongodb:',
    hostMatches: target.hostname === '127.0.0.1',
    portMatches: target.port === '27019',
    databaseMatches: target.pathname === '/barrana_ai',
    replicaSetMatches: target.searchParams.get('replicaSet') === 'kidsible-demo-rs',
    directConnectionMatches: target.searchParams.get('directConnection') === 'true'
  };
}

function topologyChecks(databaseName, hello = {}) {
  return {
    databaseMatches: databaseName === 'barrana_ai',
    replicaSetMatches: hello.setName === 'kidsible-demo-rs',
    isPrimary: hello.isWritablePrimary === true,
    primaryAddressMatches: hello.primary === 'localhost:27019',
    singleMember: Array.isArray(hello.hosts) && hello.hosts.length === 1,
    memberAddressMatches: hello.hosts?.[0] === 'localhost:27019'
  };
}

function nonSystemCollectionNames(collections = []) {
  return collections.filter(c => !c.name.startsWith('system.')).map(c => c.name).sort();
}

function check(identifier, passed, expected, observed) {
  if (passed) {
    if (diagnosticOnly) console.log(JSON.stringify({ stage, check: identifier, expected, observed, outcome: 'PASS' }));
    return;
  }
  console.error(JSON.stringify({ stage, check: identifier, expected, observed }));
  const error = new Error();
  error.diagnosticGuard = true;
  throw error;
}

function reportChecks(report, prefix, action) {
  // Preserve the original compound assertion's short-circuit order.
  check(prefix + '_PASSED', report.preflightPassed === true, true,
    typeof report.preflightPassed === 'boolean' ? report.preflightPassed : 'MISSING_OR_INVALID');
  check(prefix + '_CONFLICTS', !report.conflicts.length, 0, report.conflicts.length);
  check(prefix + '_VALIDATION_FAILURES', !report.validationFailures.length, 0, report.validationFailures.length);
  check(prefix + '_RESULT_COUNT', report.results.length === 31, 31, report.results.length);
  const unexpectedActions = report.results.filter(r => r.action !== action).length;
  check(prefix + '_ACTIONS', unexpectedActions === 0, { all: action }, { unexpectedActionCount: unexpectedActions });
}

async function main() {
  check('ARGUMENTS', process.argv.slice(2).every(arg => arg === '--diagnostic'),
    'NO_ARGUMENTS_OR_DIAGNOSTIC', process.argv.slice(2).every(arg => arg === '--diagnostic')
      ? (diagnosticOnly ? 'DIAGNOSTIC' : 'NO_ARGUMENTS') : 'UNSUPPORTED_ARGUMENT');
  stage = 'PASSWORD_CHECK';
  const password = process.env.KIDSIBLE_DEMO_PASSWORD;
  const passwordAvailable = typeof password === 'string' && Boolean(password.trim());
  check('PASSWORD_AVAILABLE', passwordAvailable,
    'AVAILABLE', passwordAvailable ? 'AVAILABLE' : 'MISSING_OR_BLANK');

  stage = 'TARGET_CHECK';
  const target = targetChecks(URI);
  check('TARGET_URI', Object.values(target).every(Boolean), 'ALL_MATCH', target);

  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  stage = 'CONNECT';
  try {
    await mongoose.connect(URI, {
      autoIndex: false, autoCreate: false, bufferCommands: false,
      serverSelectionTimeoutMS: 5000
    });
  } catch (_) { check('CONNECTION', false, 'CONNECTED', 'FAILED'); }
  check('CONNECTION', true, 'CONNECTED', 'CONNECTED');
  const db = mongoose.connection.db;

  async function verifyTarget() {
    const hello = await db.admin().command({ hello: 1 });
    const topology = topologyChecks(db.databaseName, hello);
    check('REPLICA_SET', Object.values(topology).every(Boolean), 'ALL_MATCH', topology);
  }

  async function requireEmptyDatabase() {
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = nonSystemCollectionNames(collections);
    check('DATABASE_EMPTY', names.length === 0, { count: 0, names: [] }, { count: names.length, names });
  }

  stage = 'INITIAL_TOPOLOGY';
  await verifyTarget();
  stage = 'INITIAL_EMPTY_CHECK';
  await requireEmptyDatabase();

  stage = 'LOAD_RUNNER';
  const { runVerticalDemo } = require('./runVerticalDemoFixtures');
  stage = 'PREFLIGHT';
  const plan = await runVerticalDemo({ slug: SLUG, dryRun: true });
  check('PREFLIGHT', true, 'DRY_RUN_RETURNED', 'DRY_RUN_RETURNED');
  reportChecks(plan, 'PREFLIGHT', 'missing');
  console.log(JSON.stringify({ stage, outcome: 'PASS', recordCount: plan.results.length }));

  stage = 'PREWRITE_TOPOLOGY';
  await verifyTarget();
  stage = 'PREWRITE_EMPTY_CHECK';
  await requireEmptyDatabase();

  // Diagnostic mode ends here, before the only real fixture execution call.
  if (diagnosticOnly) {
    console.log(JSON.stringify({ stage: 'DIAGNOSTIC_COMPLETE', outcome: 'PASS', writesAttempted: false }));
    return;
  }

  stage = 'EXECUTION';
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      stage = 'TRANSACTION_EMPTY_CHECK';
      await requireEmptyDatabase();
      stage = 'EXECUTION';
      result = await runVerticalDemo({ slug: SLUG, dryRun: false, session });
      // Throwing here aborts every fixture insert if any record failed.
      reportChecks(result, 'EXECUTION', 'created');
    });
  } finally {
    await session.endSession();
  }
  console.log(JSON.stringify({ stage, outcome: 'PASS', recordCount: result.results.length }));
}

function unexpected(error) {
  // Only known error-name labels; never arbitrary message/stack/property values.
  const names = ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'MongoServerSelectionError',
    'MongoServerError', 'MongoNetworkError', 'MongooseError', 'ValidationError', 'CastError'];
  console.error(JSON.stringify({ stage,
    errorName: names.includes(error?.name) ? error.name : 'OtherError',
    code: 'BOOTSTRAP_UNEXPECTED_ERROR' }));
}

if (require.main === module) {
  main().catch(error => {
    if (!error?.diagnosticGuard) unexpected(error);
    process.exitCode = 1;
  }).finally(async () => {
    stage = 'DISCONNECT';
    try { await mongoose.disconnect(); }
    catch (error) { unexpected(error); process.exitCode = 1; }
  });
}

module.exports = { main, targetChecks, topologyChecks, nonSystemCollectionNames };
