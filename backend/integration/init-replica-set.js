// Run only inside the test container via the documented explicit compose exec command.
// No arbitrary URI, no reconfiguration, and no application-data writes.
const admin = new Mongo('mongodb://127.0.0.1:27018/kidsible_integration?directConnection=true&appName=kidsible-integration').getDB('admin');
const options = admin.runCommand({ getCmdLineOpts: 1 });
if (options.ok !== 1 || options.parsed?.replication?.replSet !== 'kidsible-test-rs' || options.parsed?.net?.port !== 27018) {
  throw Error('Refusing initialization: not the isolated test replica-set process');
}
let config;
try {
  config = admin.runCommand({ replSetGetConfig: 1 });
} catch (error) {
  // mongosh throws for NotYetInitialized instead of returning the command result.
  if (error.code !== 94) throw error;
  config = { ok: 0, code: 94 };
}
if (config.ok === 1) {
  if (config.config._id !== 'kidsible-test-rs' || config.config.members.length !== 1 || config.config.members[0].host !== 'localhost:27018') throw Error('Unexpected replica configuration; refusing to reconfigure');
} else if (config.code === 94) {
  const result = admin.runCommand({ replSetInitiate: { _id: 'kidsible-test-rs', members: [{ _id: 0, host: 'localhost:27018' }] } });
  if (result.ok !== 1) throw Error('Replica-set initialization failed');
} else throw Error('Could not verify replica-set initialization state');
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  const h = admin.runCommand({ hello: 1 });
  if (h.setName === 'kidsible-test-rs' && h.isWritablePrimary === true && h.primary === 'localhost:27018') { ready = true; break; }
  sleep(1000);
}
if (!ready) throw Error('Test replica set did not become PRIMARY');
print('Isolated test replica set is PRIMARY');
