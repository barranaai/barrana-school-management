const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const publication = require('../utils/reportPublication');
const log = { info() {}, warn() {}, error() {} };
function load(relative, dependencies, env = {}) {
  const file = path.resolve(__dirname, relative);
  const box = { module: { exports: {} }, Buffer, Date, console, __dirname: path.dirname(file), process: { env }, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), box, { filename: file });
  return box.module.exports;
}
const bytes = Buffer.from('%PDF-1.7\nverified document\n%%EOF\n');
function emailHarness(env, mode = 'accepted') {
  const calls = { transport: [], logs: [] };
  const api = load('../services/emailService.js', {
    nodemailer: { createTransport: () => ({ async sendMail(data) { calls.transport.push(data); if (mode === 'throw') throw Error('transport unavailable'); return { accepted: mode === 'rejected' ? [] : ['parent@test.local'], messageId: 'provider-1' }; } }) },
    path, fs: { existsSync: () => false }, '../utils/logger': { logger: log },
    './logoService': {}, './notificationLogger': { async logEmail(data) { calls.logs.push(data); } },
    './whatsappService': {}
  }, env);
  const data = { parentEmail: 'parent@test.local', reportTitle: 'Approved title', reportContent: 'Approved content', studentName: 'Child', teacherName: 'Teacher', attachments: [],
    preparePdf: async () => ({ filename: 'report.pdf', bytes, artifact: { key: 'private.pdf' } }) };
  return { api, calls, data };
}
test('development simulation and production configuration failure never call transport or PDF', async () => {
  for (const env of ['development', 'production']) {
    const h = emailHarness({ NODE_ENV: env }); h.data.preparePdf = () => { throw Error('must not generate'); };
    if (env === 'production') await assert.rejects(h.api.sendReportEmail(h.data), { code: 'configuration_failure' });
    else { const result = await h.api.sendReportEmail(h.data); assert.equal(result.simulated, true); assert.equal(result.success, false); }
    assert.equal(h.calls.transport.length, 0); assert.equal(h.calls.logs.length, 0);
  }
});
const configured = { NODE_ENV: 'test', EMAIL_USER: 'test', EMAIL_PASSWORD: 'test-only' };
test('PDF failure occurs before transport; rejection is not acceptance', async () => {
  const h = emailHarness(configured); h.data.preparePdf = async () => { throw Error('renderer failed'); };
  await assert.rejects(h.api.sendReportEmail(h.data), { code: 'pdf_failure' }); assert.equal(h.calls.transport.length, 0);
  for (const mode of ['rejected', 'throw']) { const bad = emailHarness(configured, mode); await assert.rejects(bad.api.sendReportEmail(bad.data)); assert.equal(bad.calls.logs.length, 0); }
});
test('accepted transport sends verified bytes and returns consistent timestamps and evidence', async () => {
  const h = emailHarness(configured); const result = await h.api.sendReportEmail(h.data);
  assert.equal(result.transportAccepted, true); assert.equal(result.messageId, 'provider-1');
  assert.equal(h.calls.transport.length, 1); assert.deepEqual(h.calls.transport[0].attachments[0].content, bytes);
  assert.equal(result.acceptedAt, h.calls.logs[0].sentAt); assert.equal(h.calls.logs[0].status, 'sent'); assert.ok(result.pdfArtifact);
});
function artifactHarness() {
  const root = path.resolve(__dirname, '../uploads/pdfs/reports');
  const files = new Map(); const calls = [];
  const fakeFs = { realpath: async p => p, lstat: async () => ({ isFile: () => true, isSymbolicLink: () => false }), readFile: async p => { if (!files.has(p)) throw Error('missing'); return files.get(p); } };
  const api = load('../services/reportPdf.js', { fs: { promises: fakeFs }, path, crypto, '../utils/reportPublication': publication,
    './pdfService': { async generateReportPDF(data) { calls.push(data); files.set(path.join(root, data.filename), bytes); } } });
  const report = { _id: '000000000000000000000001', schoolId: '000000000000000000000002', progressId: '000000000000000000000004', status: 'approved', title: 'Mutable title', content: 'SECRET',
    finalizedSnapshot: { finalizedBy: '000000000000000000000003', finalizedAt: new Date('2026-01-01'), parentVisibleContent: 'Approved content', reportMetadata: { title: 'Approved title' } } };
  return { api, report, files, root, calls, fakeFs };
}
test('artifact generation overrides mutable input and verifies finalized provenance and bytes', async () => {
  const h = artifactHarness(); const result = await h.api.createReportPdf(h.report, { reportContent: 'SECRET', reportTitle: 'Mutable' });
  h.report.pdfArtifact = result.artifact;
  assert.equal(h.calls[0].reportContent, 'Approved content'); assert.equal(h.calls[0].reportTitle, 'Approved title');
  assert.deepEqual(await h.api.readReportPdf(h.report), bytes);
  h.report.content = 'different mutable content'; assert.deepEqual(await h.api.readReportPdf(h.report), bytes);
  h.report.finalizedSnapshot.parentVisibleContent = 'changed approval'; await assert.rejects(h.api.readReportPdf(h.report), { code: 'PDF_UNAVAILABLE' });
});
test('traversal, missing, corrupt, replaced and symlinked PDF artifacts fail closed', async () => {
  for (const mode of ['traversal', 'absolute', 'missing', 'corrupt', 'replaced', 'symlink']) {
    const h = artifactHarness(); const result = await h.api.createReportPdf(h.report, {}); h.report.pdfArtifact = result.artifact;
    const file = path.join(h.root, result.artifact.key);
    if (mode === 'traversal') h.report.pdfArtifact.key = '../secret.pdf';
    if (mode === 'absolute') h.report.pdfArtifact.key = 'C:\\secret.pdf';
    if (mode === 'missing') h.files.delete(file);
    if (mode === 'corrupt') h.files.set(file, Buffer.from('not a pdf'));
    if (mode === 'replaced') h.files.set(file, Buffer.from('%PDF-1.7\nother content\n%%EOF'));
    if (mode === 'symlink') h.fakeFs.lstat = async () => ({ isFile: () => true, isSymbolicLink: () => true });
    await assert.rejects(h.api.readReportPdf(h.report), { code: 'PDF_UNAVAILABLE' });
  }
});
test('canonical artifact survives Mongoose BSON serialization and hydration without a database', async () => {
  const Report = require('../models/Report'); const { BSON } = require('mongodb');
  const h = artifactHarness(); h.report.pdfArtifact = (await h.api.createReportPdf(h.report, {})).artifact;
  const doc = new Report(h.report);
  const reloaded = Report.hydrate(BSON.deserialize(BSON.serialize(doc.toObject({ virtuals: false }))));
  assert.deepEqual(reloaded.pdfArtifact.toObject(), doc.pdfArtifact.toObject());
  assert.deepEqual(await h.api.readReportPdf(reloaded), bytes);
  assert.equal(Report.schema.path('pdfArtifact').schema.path('key').isRequired, true);
});
test('temporary cleanup keeps retained PDF directory while cleaning old temporary files', async () => {
  const deleted = [];
  const api = load('../services/pdfService.js', { puppeteer: {}, path, '../utils/logger': { logger: log }, fs: {
    existsSync: () => true, readdirSync: () => ['old.pdf', 'new.pdf', 'historical.pdf', 'reports'],
    statSync: file => ({ isFile: () => !file.endsWith('reports'), mtimeMs: file.endsWith('new.pdf') ? Date.now() : 0 }),
    unlinkSync: file => deleted.push(path.basename(file))
  } });
  await api.cleanupOldPDFs(7, ['historical.pdf']); assert.deepEqual(deleted, ['old.pdf']);
});

test('scheduler protects historical references and skips cleanup if reference lookup fails', async () => {
  for (const fails of [false, true]) {
    let scheduled; const cleaned = []; const deps = {
      'node-cron': { schedule: (_, fn) => { scheduled = fn; } }, path,
      '../utils/logger': { logger: log }, './notificationService': {}, './pdfService': { async cleanupOldPDFs(days, retained) { cleaned.push({ days, retained }); return { deleted: 0 }; } },
      '../utils/dateUtils': {}, './firebaseService': {}, './socketService': {}
    };
    for (const name of ['Event','User','ParentGroup','Message','Conversation','ReportTemplate','School']) deps['../models/' + name] = {};
    deps['../models/Report'] = { find: () => ({ select: () => ({ lean: async () => { if (fails) throw Error('no database'); return [{ pdfUrl: '/uploads/pdfs/historical.pdf' }]; } }) }) };
    const api=load('../services/reminderScheduler.js',deps);api.initializePDFCleanup();await scheduled();
    assert.equal(cleaned.length,fails?0:1);if(!fails)assert.equal(cleaned[0].retained[0],'historical.pdf');
  }
});
test('Mongoose save and findById retain the artifact using an isolated in-memory collection', async () => {
  const Report=require('../models/Report');const {BSON}=require('mongodb');const h=artifactHarness();
  const doc=new Report({...h.report,studentId:h.report._id,teacherId:h.report._id,templateId:h.report._id,reportPeriod:{startDate:new Date(),endDate:new Date()}});
  doc.pdfArtifact=(await h.api.createReportPdf(doc,{})).artifact;
  const insert=Report.collection.insertOne,find=Report.collection.findOne;let stored;
  Report.collection.insertOne=async data=>{stored=BSON.deserialize(BSON.serialize(data));return {acknowledged:true,insertedId:data._id};};
  Report.collection.findOne=async()=>stored;
  try {await doc.save();const reloaded=await Report.findById(doc._id);assert.equal(reloaded.pdfArtifact.key,doc.pdfArtifact.key);assert.deepEqual(await h.api.readReportPdf(reloaded),bytes);}
  finally {Report.collection.insertOne=insert;Report.collection.findOne=find;}
});
test('frontend publication parsing preserves simulation, acceptance and failure distinctions without retries', async () => {
  const ts=require('../../node_modules/typescript');
  const source=fs.readFileSync(path.resolve(__dirname,'../../src/services/reportPublicationService.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  for(const outcome of ['sent','simulated','delivery_failure','pdf_failure','persistence_failure','configuration_failure']) {
    const exports={};let count=0;const accepted=outcome==='sent'||outcome==='persistence_failure';
    const box={exports,fetch:async()=>{count++;return {ok:['sent','simulated'].includes(outcome),json:async()=>({success:outcome==='sent',outcome,message:outcome,data:{transportAccepted:accepted}})};}};
    vm.runInNewContext(code,box);const result=await exports.requestReportPublication('/test',{},{});
    assert.equal(result.outcome,outcome);assert.equal(result.success,outcome==='sent');assert.equal(result.data.transportAccepted,accepted);assert.equal(count,1);
  }
});
