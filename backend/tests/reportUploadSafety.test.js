const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kidsible-report-upload-'));
process.env.REPORT_MEDIA_UPLOAD_DIR = uploadDir;
const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const teacherA = '333333333333333333333333';
const teacherB = '444444444444444444444444';
const reportId = '555555555555555555555555';
const mediaId = '666666666666666666666666';

const paths = {
  auth: require.resolve('../middleware/auth'),
  lifecycle: require.resolve('../middleware/lifecycleAuthorization'),
  routes: require.resolve('../routes/reports')
};
const cached = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, require.cache[value]]));
const Report = require('../models/Report');
const originalFindOne = Report.findOne;
let report;
let saves = 0;

const files = () => fs.readdirSync(uploadDir);
const clearFiles = () => { for (const name of files()) fs.unlinkSync(path.join(uploadDir, name)); };
const reportRow = (changes = {}) => ({
  _id: reportId, schoolId: schoolA, teacherId: teacherA, status: 'draft', progressId: null, attachments: [],
  async save() { saves += 1; }, ...changes
});
const attach = call => call.attach('media', Buffer.from('test image bytes'), { filename: 'evidence.png', contentType: 'image/png' });

require.cache[paths.auth] = { id: paths.auth, filename: paths.auth, loaded: true, exports: {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'school_admin';
    req.user = { _id: req.get('x-user') || teacherA, role, schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA) };
    next();
  },
  authorize(...roles) { return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ success: false }); }
} };
require.cache[paths.lifecycle] = { id: paths.lifecycle, filename: paths.lifecycle, loaded: true, exports: { requireActiveOrganization: (_req, _res, next) => next() } };
Report.findOne = async query => report && String(query._id) === reportId && String(query.schoolId) === String(report.schoolId) ? report : null;
delete require.cache[paths.routes];
const app = express(); app.use(express.json()); app.use('/api/reports', require('../routes/reports'));

test.beforeEach(() => { clearFiles(); saves = 0; report = reportRow(); });
test.after(() => {
  Report.findOne = originalFindOne;
  for (const [key, modulePath] of Object.entries(paths)) {
    if (cached[key]) require.cache[modulePath] = cached[key]; else delete require.cache[modulePath];
  }
  fs.rmSync(uploadDir, { recursive: true, force: true });
  delete process.env.REPORT_MEDIA_UPLOAD_DIR;
});

test('unauthorized and cross-tenant report uploads write no files', async () => {
  report = reportRow({ schoolId: schoolB });
  const crossTenant = await attach(request(app).post(`/api/reports/${reportId}/media`));
  assert.equal(crossTenant.status, 404); assert.deepEqual(files(), []); assert.equal(saves, 0);

  report = reportRow({ teacherId: teacherB });
  const unrelatedTeacher = await attach(request(app).post(`/api/reports/${reportId}/media`).set('x-role', 'teacher').set('x-user', teacherA));
  assert.equal(unrelatedTeacher.status, 404); assert.deepEqual(files(), []); assert.equal(saves, 0);
});

test('finalized report is rejected before Multer writes a file', async () => {
  report = reportRow({ progressId: '666666666666666666666666', status: 'approved' });
  const response = await attach(request(app).post(`/api/reports/${reportId}/media`));
  assert.equal(response.status, 409); assert.deepEqual(files(), []); assert.equal(saves, 0);
});

test('parents cannot create temporary report media files', async () => {
  const response = await attach(request(app).post('/api/reports/temp-media').set('x-role', 'parent'));
  assert.equal(response.status, 403); assert.deepEqual(files(), []);
});

test('report upload logging excludes request headers, filenames, and filesystem paths', () => {
  const source = fs.readFileSync(paths.routes, 'utf8');
  const cleanupHelper = source.slice(source.indexOf('async function cleanupRequestUploads'), source.indexOf('async function authorizeReportMediaUpload'));
  const tempRoute = source.slice(source.indexOf("router.post('/temp-media'"), source.indexOf('// @desc    Get all reports'));
  const reportRoute = source.slice(source.indexOf("router.post('/:reportId/media'"), source.indexOf('// @desc    Get media files for a report'));
  assert.doesNotMatch(source, /Request headers:/);
  assert.doesNotMatch(source, /console\.error\('Multer error:|console\.error\('Other upload error:/);
  assert.doesNotMatch(cleanupHelper, /path:\s*file\.path|filename|originalname/);
  assert.doesNotMatch(tempRoute, /console\.(?:log|error|warn)/);
  assert.doesNotMatch(reportRoute, /console\.(?:log|error|warn)/);
});

test('authorized report upload persists its file and attachment metadata', async () => {
  const response = await attach(request(app).post(`/api/reports/${reportId}/media`));
  assert.equal(response.status, 201); assert.equal(files().length, 1); assert.equal(report.attachments.length, 1); assert.equal(saves, 1);
});

test('attachment-limit rejection removes files created by the request', async () => {
  report.attachments = Array.from({ length: 10 }, (_, index) => ({ id: `existing-${index}` }));
  const response = await attach(request(app).post(`/api/reports/${reportId}/media`));
  assert.equal(response.status, 400); assert.deepEqual(files(), []); assert.equal(saves, 0); assert.equal(report.attachments.length, 10);
});

test('invalid media type leaves no retained file', async () => {
  const response = await request(app).post(`/api/reports/${reportId}/media`)
    .attach('media', Buffer.from('not media'), { filename: 'evidence.txt', contentType: 'text/plain' });
  assert.equal(response.status, 500); assert.deepEqual(files(), []); assert.equal(saves, 0);
});

test('handler failure removes only current request files', async () => {
  const sentinel = path.join(uploadDir, 'pre-existing.png');
  fs.writeFileSync(sentinel, 'existing');
  report.save = async () => { throw new Error('forced persistence failure'); };
  const response = await attach(request(app).post(`/api/reports/${reportId}/media`));
  assert.equal(response.status, 500); assert.deepEqual(files(), ['pre-existing.png']); assert.equal(fs.readFileSync(sentinel, 'utf8'), 'existing');
});

test('super admin report upload requires explicit matching organization scope', async () => {
  const missing = await attach(request(app).post(`/api/reports/${reportId}/media`).set('x-role', 'super_admin'));
  assert.equal(missing.status, 400); assert.deepEqual(files(), []);
  const wrong = await attach(request(app).post(`/api/reports/${reportId}/media?schoolId=${schoolB}`).set('x-role', 'super_admin'));
  assert.equal(wrong.status, 404); assert.deepEqual(files(), []);
  const correct = await attach(request(app).post(`/api/reports/${reportId}/media?schoolId=${schoolA}`).set('x-role', 'super_admin'));
  assert.equal(correct.status, 201); assert.equal(files().length, 1);
});

test('super admin report-media deletion requires explicit matching organization scope', async () => {
  report = reportRow({ attachments: [{ _id: mediaId, url: '/uploads/media/nonexistent-test-file.png' }] });
  const missing = await request(app).delete(`/api/reports/${reportId}/media/${mediaId}`).set('x-role', 'super_admin');
  assert.equal(missing.status, 400); assert.equal(saves, 0); assert.equal(report.attachments.length, 1);

  const wrong = await request(app).delete(`/api/reports/${reportId}/media/${mediaId}?schoolId=${schoolB}`).set('x-role', 'super_admin');
  assert.equal(wrong.status, 404); assert.equal(saves, 0); assert.equal(report.attachments.length, 1);

  const correct = await request(app).delete(`/api/reports/${reportId}/media/${mediaId}?schoolId=${schoolA}`).set('x-role', 'super_admin');
  assert.equal(correct.status, 200); assert.equal(saves, 1); assert.equal(report.attachments.length, 0);
});
