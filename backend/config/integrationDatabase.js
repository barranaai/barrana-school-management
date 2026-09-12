const DATABASE = 'kidsible_integration';
const REPLICA_SET = 'kidsible-test-rs';
const PORT = '27018';
function integrationUri(env = process.env) {
  if (env.NODE_ENV !== 'test' || env.KIDSIBLE_INTEGRATION_TESTS !== '1') throw Error('Explicit integration-test mode is required');
  if (!env.INTEGRATION_MONGODB_URI) throw Error('INTEGRATION_MONGODB_URI is required; no fallback is allowed');
  let uri;
  try { uri = new URL(env.INTEGRATION_MONGODB_URI); } catch (_) { throw Error('Invalid integration URI'); }
  const allowed = new Set(['replicaSet', 'directConnection', 'appName']);
  if (uri.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost'].includes(uri.hostname) || uri.port !== PORT ||
      uri.pathname !== '/' + DATABASE || uri.username || uri.password || uri.hash ||
      [...uri.searchParams.keys()].some(k => !allowed.has(k) || uri.searchParams.getAll(k).length !== 1) ||
      uri.searchParams.get('replicaSet') !== REPLICA_SET || uri.searchParams.get('directConnection') !== 'true' ||
      uri.searchParams.get('appName') !== 'kidsible-integration') throw Error('URI must target the isolated integration database, port, replica set and appName');
  return uri.toString();
}
function assertTopology(hello) {
  if (hello.setName !== REPLICA_SET || hello.isWritablePrimary !== true || hello.msg === 'isdbgrid' ||
      hello.primary !== 'localhost:' + PORT || hello.me !== 'localhost:' + PORT ||
      !Array.isArray(hello.hosts) || hello.hosts.length !== 1 || hello.hosts[0] !== 'localhost:' + PORT) {
    throw Error('Integration server must be the expected single-node replica-set PRIMARY');
  }
}
module.exports = { integrationUri, assertTopology, DATABASE, REPLICA_SET };
