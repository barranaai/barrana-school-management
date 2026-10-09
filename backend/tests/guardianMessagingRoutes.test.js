const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness({ access = true, delivery = true } = {}) {
  const routes = [];
  const router = {};
  for (const method of ['get', 'post', 'patch']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers });
  const multer = () => ({ array: () => (_req, _res, next) => next() });
  multer.diskStorage = () => ({});
  let messageReads = 0, messageWrites = 0;
  const conversation = {
    _id: 'conversation-a', schoolId: 'school-a',
    participants: [{ userId: 'guardian-a', role: 'parent', name: 'Guardian' }, { userId: 'admin-a', role: 'school_admin', name: 'Admin' }],
    metadata: { studentId: 'child-a' }, unreadCount: { parent: 2, admin: 0 },
    async updateLastMessage() {}, async incrementUnread() {}, async resetUnread() {}, async save() {}
  };
  const chain = value => ({ sort() { return this; }, limit() { return this; }, lean: async () => value });
  const dependencies = {
    express: { Router: () => router }, multer, path, fs: { existsSync: () => true },
    '../models/Message': { find: () => { messageReads += 1; return chain([]); }, async create(value) { messageWrites += 1; return value; }, async updateMany() {} },
    '../models/Conversation': { findById: async () => conversation, find: () => Promise.resolve([conversation]) },
    '../models/User': { findById: async () => ({ notifications: [], async save() {} }) },
    '../services/guardianAccessService': { async authorizeGuardianParticipant() { return { allowed: access }; } },
    '../services/guardianCommunicationService': {
      async guardianCanUseConversation() { return access; },
      async conversationCanDeliver() { return delivery; }
    },
    '../middleware/auth': { protect: (_req, _res, next) => next(), authorize: () => (_req, _res, next) => next() },
    '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
    '../services/firebaseService': { async sendNotificationToUser() {} }
  };
  const file = path.resolve(__dirname, '../routes/messages.js');
  const box = { module: { exports: {} }, console, Date, setTimeout, clearTimeout, Buffer, __dirname: path.dirname(file), require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), box, { filename: file });
  async function request(method, url, role = 'parent') {
    const route = routes.find(item => item.method === method && item.url === url);
    assert.ok(route, url);
    const req = { user: { _id: role === 'parent' ? 'guardian-a' : 'admin-a', schoolId: 'school-a', role, firstName: 'Test', lastName: 'User' }, params: { conversationId: 'conversation-a' }, query: {}, body: { conversationId: 'conversation-a', content: 'Hello' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { request, counts: () => ({ messageReads, messageWrites }) };
}

test('revoked guardian cannot read historical child messages or unread counts', async () => {
  const h = harness({ access: false });
  assert.equal((await h.request('get', '/conversation/:conversationId')).statusCode, 404);
  assert.equal(h.counts().messageReads, 0);
  const unread = await h.request('get', '/unread-count');
  assert.equal(unread.body.data.unreadCount, 0);
  assert.equal(unread.body.data.conversationsWithUnread, 0);
});

test('staff cannot send a future child message after guardian permission is removed', async () => {
  const h = harness({ access: true, delivery: false });
  assert.equal((await h.request('post', '/send', 'school_admin')).statusCode, 404);
  assert.equal(h.counts().messageWrites, 0);
});

test('authorized guardian communication still reads and sends normally', async () => {
  const h = harness();
  assert.equal((await h.request('get', '/conversation/:conversationId')).statusCode, 200);
  assert.equal((await h.request('post', '/send')).statusCode, 201);
  assert.deepEqual(h.counts(), { messageReads: 1, messageWrites: 1 });
});
