// Only inside kidsible-mongodb-demo. Never accepts an arbitrary target or reconfigures.
if (process.env.HOSTNAME !== 'kidsible-mongodb-demo') throw Error('Unexpected demo container hostname');
const admin = new Mongo('mongodb://127.0.0.1:27019/barrana_ai?directConnection=true&appName=kidsible-demo-infrastructure').getDB('admin');
const options = admin.runCommand({ getCmdLineOpts: 1 });
if (options.ok !== 1 || options.parsed?.replication?.replSet !== 'kidsible-demo-rs' || options.parsed?.net?.port !== 27019) throw Error('Unexpected demo process configuration');
if (admin.runCommand({ buildInfo: 1 }).version !== '8.0.29') throw Error('Unexpected MongoDB version');
let config;
try { config = admin.runCommand({ replSetGetConfig: 1 }); }
catch (error) { if (error.code !== 94) throw error; config = { ok: 0, code: 94 }; }
if (config.ok === 1) {
  if (config.config._id !== 'kidsible-demo-rs' || config.config.members.length !== 1 || config.config.members[0].host !== 'localhost:27019') throw Error('Unexpected existing replica configuration');
} else if (config.code === 94) {
  const result = admin.runCommand({ replSetInitiate: { _id: 'kidsible-demo-rs', members: [{ _id: 0, host: 'localhost:27019' }] } });
  if (result.ok !== 1) throw Error('Demo initialization failed');
} else throw Error('Cannot verify replica configuration');
let ready = false;
for (let i = 0; i < 45; i++) {
  const h = admin.runCommand({ hello: 1 });
  if (h.setName === 'kidsible-demo-rs' && h.isWritablePrimary === true && h.primary === 'localhost:27019' && h.hosts.length === 1 && h.hosts[0] === 'localhost:27019') { ready = true; break; }
  sleep(1000);
}
if (!ready) throw Error('Demo PRIMARY timeout');
print('kidsible-demo-rs PRIMARY verified');
