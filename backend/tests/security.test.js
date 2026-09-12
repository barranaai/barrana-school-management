const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAllowedOrigins, createCorsOptions } = require('../config/security');
const { canAccessReport, scopeSchoolId } = require('../middleware/resourceAuthorization');
const id = value => ({ toString: () => value });

test('production has no implicit CORS origins', () => assert.deepEqual(parseAllowedOrigins('', 'production'), []));
test('development permits current localhost origins', () => assert.deepEqual(parseAllowedOrigins('', 'development'), ['http://localhost:3000', 'http://127.0.0.1:3000']));
test('CORS rejects an unconfigured origin', async () => {
  const options = createCorsOptions({ NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://kidsible.com' });
  await new Promise(done => options.origin('https://evil.example', error => { assert.equal(error.statusCode, 403); done(); }));
});
test('ordinary user cannot override tenant scope', () => assert.equal(scopeSchoolId({ role: 'school_admin', schoolId: id('a') }, 'b'), 'a'));
test('report access enforces tenant and teacher ownership', () => {
  const user = { _id: id('teacher'), role: 'teacher', schoolId: id('a') };
  assert.equal(canAccessReport(user, { teacherId: id('teacher'), schoolId: id('a') }), true);
  assert.equal(canAccessReport(user, { teacherId: id('teacher'), schoolId: id('b') }), false);
  assert.equal(canAccessReport(user, { teacherId: id('other'), schoolId: id('a') }), false);
});
