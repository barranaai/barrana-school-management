const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kidsible-ai-audio-'));
const temporaryDir = path.join(root, 'temporary');
const publicDir = path.join(root, 'public');
fs.mkdirSync(temporaryDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
process.env.AI_AUDIO_UPLOAD_DIR = temporaryDir;
process.env.AI_AUDIO_PUBLIC_DIR = publicDir;

const schoolA = '111111111111111111111111';
const schoolB = '222222222222222222222222';
const teacherA = '333333333333333333333333';
const studentA = '444444444444444444444444';
const studentB = '555555555555555555555555';
const reportA = '666666666666666666666666';

const paths = {
  auth: require.resolve('../middleware/auth'),
  lifecycle: require.resolve('../middleware/lifecycleAuthorization'),
  participantAuthorization: require.resolve('../services/reportParticipantAuthorization'),
  openai: require.resolve('openai'),
  routes: require.resolve('../routes/ai')
};
const cached = Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, require.cache[value]]));
const User = require('../models/User');
const Report = require('../models/Report');
const originals = { userFindOne: User.findOne, reportFindOne: Report.findOne };

let teacherAuthorized = true;
let providerMode = 'success';
let transcriptionPrompt = '';

const participant = (id = studentA, schoolId = schoolA) => ({
  _id: id,
  schoolId,
  role: 'student',
  isActive: true,
  firstName: id === studentA ? 'Maya' : 'Noah',
  lastName: 'Participant'
});

const reports = {
  [reportA]: { _id: reportA, schoolId: schoolA, studentId: studentA, teacherId: teacherA }
};

const listFiles = directory => fs.existsSync(directory) ? fs.readdirSync(directory).sort() : [];
const clearFiles = directory => {
  if (!fs.existsSync(directory)) return;
  for (const name of fs.readdirSync(directory)) fs.rmSync(path.join(directory, name), { recursive: true, force: true });
};
const assertNoRequestFiles = () => {
  assert.deepEqual(listFiles(temporaryDir), []);
  assert.deepEqual(listFiles(publicDir), []);
};
const attachAudio = call => call.attach('audio', Buffer.from('synthetic audio'), {
  filename: 'observation.webm',
  contentType: 'video/webm'
});

require.cache[paths.auth] = { id: paths.auth, filename: paths.auth, loaded: true, exports: {
  protect(req, _res, next) {
    const role = req.get('x-role') || 'teacher';
    req.user = {
      _id: req.get('x-user') || teacherA,
      role,
      isActive: true,
      schoolId: role === 'super_admin' ? undefined : (req.get('x-school') || schoolA)
    };
    next();
  },
  authorize(...roles) {
    return (req, res, next) => roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ success: false });
  }
} };
require.cache[paths.lifecycle] = { id: paths.lifecycle, filename: paths.lifecycle, loaded: true, exports: {
  requireActiveOrganization(req, res, next) {
    return req.get('x-inactive-organization') === 'true'
      ? res.status(409).json({ success: false, message: 'Organization is deactivated' })
      : next();
  }
} };
require.cache[paths.participantAuthorization] = {
  id: paths.participantAuthorization,
  filename: paths.participantAuthorization,
  loaded: true,
  exports: { canTeacherAccessParticipantReporting: async () => teacherAuthorized }
};

class FakeOpenAI {
  constructor() {
    this.audio = {
      transcriptions: {
        create: async options => {
          transcriptionPrompt = options.prompt;
          if (providerMode === 'failure') {
            const error = new Error('synthetic provider failure');
            error.code = 'SYNTHETIC_FAILURE';
            throw error;
          }
          return { text: 'Clear observation', language: 'en', segments: [{ avg_logprob: 0.8 }] };
        }
      }
    };
  }
}
require.cache[paths.openai] = { id: paths.openai, filename: paths.openai, loaded: true, exports: FakeOpenAI };

User.findOne = async query => {
  if (String(query.schoolId) !== schoolA || query.role !== 'student') return null;
  if (String(query._id) === studentA) return participant();
  if (String(query._id) === studentB) return participant(studentB);
  return null;
};
Report.findOne = async query => {
  const report = reports[String(query._id)];
  return report && String(report.schoolId) === String(query.schoolId) ? report : null;
};

const buildApp = providerAvailable => {
  if (providerAvailable) process.env.OPENAI_API_KEY = 'synthetic-test-key';
  else delete process.env.OPENAI_API_KEY;
  delete require.cache[paths.routes];
  const app = express();
  app.use(express.json());
  app.use('/api/ai', require('../routes/ai'));
  return app;
};

const app = buildApp(true);
const unavailableApp = buildApp(false);
process.env.OPENAI_API_KEY = 'synthetic-test-key';

test.beforeEach(() => {
  clearFiles(temporaryDir);
  clearFiles(publicDir);
  teacherAuthorized = true;
  providerMode = 'success';
  transcriptionPrompt = '';
});

test.after(() => {
  User.findOne = originals.userFindOne;
  Report.findOne = originals.reportFindOne;
  for (const [key, modulePath] of Object.entries(paths)) {
    if (cached[key]) require.cache[modulePath] = cached[key];
    else delete require.cache[modulePath];
  }
  fs.rmSync(root, { recursive: true, force: true });
  delete process.env.AI_AUDIO_UPLOAD_DIR;
  delete process.env.AI_AUDIO_PUBLIC_DIR;
  delete process.env.OPENAI_API_KEY;
});

test('inactive organization is rejected before an audio file is created', async () => {
  const response = await attachAudio(request(app)
    .post(`/api/ai/process-voice?studentId=${studentA}`)
    .set('x-inactive-organization', 'true'));
  assert.equal(response.status, 409);
  assertNoRequestFiles();
});

test('unavailable provider is rejected before an audio file is created', async () => {
  const response = await attachAudio(request(unavailableApp).post(`/api/ai/process-voice?studentId=${studentA}`));
  assert.equal(response.status, 503);
  assertNoRequestFiles();
});

test('unauthorized and cross-tenant participant or report contexts write no files', async () => {
  teacherAuthorized = false;
  const unauthorized = await attachAudio(request(app).post(`/api/ai/process-voice?studentId=${studentA}`));
  assert.equal(unauthorized.status, 404);
  assertNoRequestFiles();

  const crossTenant = await attachAudio(request(app)
    .post(`/api/ai/upload-audio?studentId=${studentA}`)
    .set('x-school', schoolB));
  assert.equal(crossTenant.status, 404);
  assertNoRequestFiles();

  const crossTenantReport = await attachAudio(request(app)
    .post(`/api/ai/upload-audio?reportId=${reportA}`)
    .set('x-school', schoolB));
  assert.equal(crossTenantReport.status, 404);
  assertNoRequestFiles();
});

test('forged report-to-participant relationship and participant name are rejected', async () => {
  const mismatchedReport = await attachAudio(request(app)
    .post(`/api/ai/upload-audio?reportId=${reportA}&studentId=${studentB}`));
  assert.equal(mismatchedReport.status, 404);
  assertNoRequestFiles();

  const forgedName = await attachAudio(request(app)
    .post(`/api/ai/process-voice?studentId=${studentA}`)
    .field('studentName', 'Another Child'));
  assert.equal(forgedName.status, 400);
  assertNoRequestFiles();
});

test('unsupported audio and upload-limit failures retain no files', async () => {
  const unsupported = await request(app).post(`/api/ai/process-voice?studentId=${studentA}`)
    .attach('audio', Buffer.from('text'), { filename: 'observation.txt', contentType: 'text/plain' });
  assert.equal(unsupported.status, 400);
  assertNoRequestFiles();

  const oversized = await request(app).post(`/api/ai/process-voice?studentId=${studentA}`)
    .attach('audio', Buffer.alloc(25 * 1024 * 1024 + 1), { filename: 'large.webm', contentType: 'video/webm' });
  assert.equal(oversized.status, 400);
  assertNoRequestFiles();

  const tooMany = await request(app).post(`/api/ai/process-voice?studentId=${studentA}`)
    .attach('audio', Buffer.from('one'), { filename: 'one.webm', contentType: 'video/webm' })
    .attach('audio', Buffer.from('two'), { filename: 'two.webm', contentType: 'video/webm' });
  assert.equal(tooMany.status, 400);
  assertNoRequestFiles();
});

test('transcription failure removes only the current request file', async () => {
  const sentinel = path.join(temporaryDir, 'pre-existing.webm');
  fs.writeFileSync(sentinel, 'existing');
  providerMode = 'failure';
  const response = await attachAudio(request(app).post(`/api/ai/process-voice?studentId=${studentA}`));
  assert.equal(response.status, 500);
  assert.deepEqual(listFiles(temporaryDir), ['pre-existing.webm']);
  assert.equal(fs.readFileSync(sentinel, 'utf8'), 'existing');
  assert.deepEqual(listFiles(publicDir), []);
});

test('authorized processing uses the authoritative participant identity and cleans its temporary file', async () => {
  const response = await attachAudio(request(app)
    .post(`/api/ai/process-voice?studentId=${studentA}`)
    .field('studentName', 'Maya Participant'));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.transcription, 'Clear observation');
  assert.match(transcriptionPrompt, /Maya Participant/);
  assertNoRequestFiles();
});

test('authorized upload preserves only the public file and returns server-derived identity', async () => {
  const response = await attachAudio(request(app).post(`/api/ai/upload-audio?reportId=${reportA}`));
  assert.equal(response.status, 200);
  assert.equal(response.body.data.studentId, studentA);
  assert.equal(response.body.data.studentName, 'Maya Participant');
  assert.equal(response.body.data.reportId, reportA);
  assert.deepEqual(listFiles(temporaryDir), []);
  assert.equal(listFiles(publicDir).length, 1);
});

test('Super Admin requires explicit matching organization scope', async () => {
  const missing = await attachAudio(request(app)
    .post(`/api/ai/process-voice?studentId=${studentA}`)
    .set('x-role', 'super_admin'));
  assert.equal(missing.status, 400);
  assertNoRequestFiles();

  const correct = await attachAudio(request(app)
    .post(`/api/ai/process-voice?studentId=${studentA}&schoolId=${schoolA}`)
    .set('x-role', 'super_admin'));
  assert.equal(correct.status, 200);
  assertNoRequestFiles();
});
