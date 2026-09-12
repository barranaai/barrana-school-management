const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const publication = require('../utils/reportPublication');
const access = require('../middleware/resourceAuthorization');
process.env.JWT_SECRET = 'isolated-lifecycle-test-secret';
const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const school = id(1), teacher = id(2), parent = id(3), participationId = id(4), sessionId = id(5), progressId = id(6), roadmapId = id(7), plannedId = id(8), programId = id(9), levelId = id(10), parameterId = id(11), requirementId = id(12);
const chain = value => ({ populate() { return this; }, select() { return this; }, sort() { return this; }, lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const logger = { info() {}, error() {}, warn() {}, debug() {} };
function evaluate(file, dependencies) {
  const box = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} }, process, Buffer, setImmediate, __dirname: path.dirname(file), require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error('Unexpected dependency: ' + name);
  } };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), box, { filename: file });
  return box.module.exports;
}
function report(status = 'approved') {
  return { _id: id(20), progressId, schoolId: { _id: school, name: 'School' }, teacherId: { _id: teacher, firstName: 'Teacher', lastName: 'Test' }, studentId: { _id: id(21), firstName: 'Child', lastName: 'Test', parentEmail: 'parent@test.local' },
    status, title: 'mutable title', content: 'INTERNAL', createdAt: new Date(), attachments: [{ url: 'mutable attachment' }],
    aiGenerated: { internal: true }, progressSnapshot: { observations: 'INTERNAL' }, approvals: [{ internal: true }],
    finalizedSnapshot: { finalizedBy: teacher, finalizedAt: new Date(), parentVisibleContent: 'Approved content', reportMetadata: { title: 'Approved title', reportType: 'progress', reportPeriod: {} }, customFieldValues: {}, attachments: [{ url: 'approved attachment', metadata: 'INTERNAL' }], templateSnapshot: { internal: true } },
    async save() {} };
}
function harness(reportRow = report(), reportOverrides = {}) {
  const calls = { email: [], queries: [], progressCreates: [], progressSaves: 0, pdfCreates: [], pdfReads: 0, reportSaves: 0 };
  const actor = { _id: teacher, schoolId: school, role: 'teacher', isActive: true, async save() {} };
  const state = { report: reportRow, actor, roadmap: { _id: roadmapId, programId, levelId }, session: { _id: sessionId, schoolId: school, deliveredBy: teacher, plannedSessionId: plannedId, roadmapId, roadmapVersion: 1, status: 'completed' }, participation: { _id: participationId, schoolId: school, deliveredSessionId: sessionId, status: 'active' } };
  reportRow.save = async () => { if (state.saveFailure) throw Error('database unavailable'); calls.reportSaves++; };
  const row = { _id: progressId, childParticipationId: participationId, async save() { calls.progressSaves++; } };
  const models = {
    User: { findById: () => chain(state.actor), findOne: () => chain(null), find: () => chain([{ _id: id(21) }]) },
    Report: { findById: () => chain(state.report), findOne: q => { calls.queries.push(['Report', q]); return chain(q.schoolId && String(q.schoolId) !== String(school) ? null : state.report); }, find: () => chain([state.report]) },
    Progress: { find: q => { calls.queries.push(['Progress', q]); return chain([row, { _id: id(30), childParticipationId: id(31) }]); }, findOne: q => { calls.queries.push(['Progress', q]); return chain(String(q.schoolId) === String(school) ? row : null); } },
    ChildParticipation: { find: q => { calls.queries.push(['ChildParticipation', q]); return chain([{ _id: participationId }]); }, findOne: q => { calls.queries.push(['ChildParticipation', q]); return chain(state.participation); } },
    DeliveredSession: { find: q => { calls.queries.push(['DeliveredSession', q]); return chain([{ _id: sessionId }]); }, findOne: () => chain(state.session) },
    PlannedSession: { findOne: () => chain({ _id: plannedId, roadmapId, roadmapVersion: 1, objectives: [] }) },
    Roadmap: { findOne: q => { calls.queries.push(['Roadmap', q]); return chain(state.roadmap); } },
    Parameter: { find: q => { calls.queries.push(['Parameter', q]); return chain([{ _id: parameterId, requirementId, name: 'Percent', type: 'percentage' }]); } },
    Requirement: { find: q => { calls.queries.push(['Requirement', q]); return chain([{ _id: requirementId, name: 'Float' }]); } },
    School: {}, Class: {}, Event: {}, ReportTemplate: {}
  };
  Object.assign(models.Report, reportOverrides);
  models.Progress.create = async payload => { calls.progressCreates.push(payload); return { _id: progressId, ...payload }; };
  const auth = evaluate(path.join(__dirname, '../middleware/auth.js'), { jsonwebtoken: jwt, '../models/User': models.User, '../utils/logger': { logger } });
  const routers = {};
  const multer = () => ({ array: () => () => {}, single: () => () => {}, fields: () => () => {} }); multer.diskStorage = () => ({});
  function load(name) {
    const routes = [], middleware = [];
    const router = { use: (...handlers) => middleware.push(...handlers) };
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) router[method] = (url, ...handlers) => routes.push({ method, url, handlers: [...middleware, ...handlers] });
    const dependencies = { express: { Router: () => router }, mongoose, '../middleware/auth': auth, '../middleware/resourceAuthorization': access, '../utils/reportPublication': publication, '../utils/logger': { logger }, '../utils/dateUtils': {}, '../utils/gradeUtils': {}, '../middleware/environment': { developmentOnly() {} }, multer, path, fs: { promises: {}, existsSync() { throw Error('Filesystem access forbidden in route test'); } }, 'moment-timezone': () => { throw Error('Unexpected date helper'); }, '../services/reportPdf': { async createReportPdf(report, data) { calls.pdfCreates.push(data); return { artifact: { key: 'test.pdf' }, bytes: Buffer.from('%PDF-test') }; }, async readReportPdf(report) { calls.pdfReads++; if (!report.pdfArtifact || state.missingPdf) throw Error('unavailable'); return Buffer.from('%PDF-test'); } }, '../services/firebaseService': {}, '../services/emailService': { async sendReportEmail(data) { if (state.emailError) throw Object.assign(Error('failure'), { code: state.emailError }); if (state.simulated) return { simulated: true }; calls.email.push(data); const pdf = await data.preparePdf(); return { success: true, transportAccepted: true, acceptedAt: new Date(), messageId: 'accepted', pdfArtifact: pdf.artifact }; } } };
    for (const [key, value] of Object.entries(models)) dependencies['../models/' + key] = value;
    evaluate(path.join(__dirname, '../routes/' + name + '.js'), dependencies);
    routers[name] = routes;
  }
  async function request(name, method, url, { body = {}, query = {}, anonymous = false, role } = {}) {
    if (!routers[name]) load(name);
    if (role) state.actor.role = role;
    const route = routers[name].find(r => r.method === method && r.url === url); assert.ok(route, url);
    const req = { headers: anonymous ? {} : { authorization: 'Bearer ' + jwt.sign({ id: String(state.actor._id) }, process.env.JWT_SECRET) }, params: { id: String(progressId) }, body, query };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; }, setHeader() {}, end(bytes) { this.bytes = bytes; } };
    for (const handler of route.handlers) { let next = false; await handler(req, res, () => { next = true; }); if (!next) break; }
    return res;
  }
  return { request, calls, state };
}

test('Super Admin Progress POST requires valid body scope even when query scope is valid', async () => {
  for (const schoolId of [undefined, '', 'invalid-school']) {
    const h = harness();
    const r = await h.request('progress', 'post', '/', { role: 'super_admin', query: { schoolId: String(school) }, body: { childParticipationId: String(participationId), ...(schoolId === undefined ? {} : { schoolId }) } });
    assert.equal(r.statusCode, 400);
    assert.equal(r.body.message, 'Valid schoolId and childParticipationId are required');
    assert.equal(h.calls.progressCreates.length, 0);
    assert.equal(h.calls.queries.length, 0);
  }
});

test('Progress POST accepts explicit Super Admin scope and preserves Teacher/Admin tenant authority', async () => {
  for (const role of ['super_admin', 'teacher', 'school_admin']) {
    const h = harness();
    if (role === 'super_admin') h.state.actor.schoolId = id(90);
    const r = await h.request('progress', 'post', '/', { role, query: { schoolId: String(id(90)) }, body: { schoolId: String(school), childParticipationId: String(participationId) } });
    assert.equal(r.statusCode, 201);
    assert.equal(h.calls.progressCreates.length, 1);
    assert.equal(String(h.calls.progressCreates[0].schoolId), String(school));
    assert.equal(String(h.calls.progressCreates[0].childParticipationId), String(participationId));
    assert.equal(String(h.calls.queries.find(([model]) => model === 'ChildParticipation')[1].schoolId), String(school));
  }
  for (const role of ['teacher', 'school_admin']) {
    for (const supplied of [undefined, String(id(90))]) {
      const h = harness();
      const r = await h.request('progress', 'post', '/', { role, body: { schoolId: supplied, childParticipationId: String(participationId) } });
      assert.equal(r.statusCode, 201);
      assert.equal(String(h.calls.progressCreates[0].schoolId), String(school));
    }
  }
});

test('Progress-backed drafts and incomplete snapshots cannot be emailed', async () => {
  for (const status of ['draft', 'review', 'archived']) { const h = harness(report(status)); const r = await h.request('reports', 'post', '/:id/send-email', { body: { parentEmail: 'parent@test.local' } }); assert.equal(r.statusCode, 409); assert.equal(h.calls.email.length, 0); }
  const h = harness(); h.state.report.finalizedSnapshot = null; assert.equal((await h.request('reports', 'post', '/:id/send-email', { body: { parentEmail: 'parent@test.local' } })).statusCode, 409);
});
test('authorized finalized delivery uses only snapshot content and attachments', async () => {
  for (const status of ['approved']) { const h = harness(report(status)); const r = await h.request('reports', 'post', '/:id/send-email', { body: { parentEmail: 'parent@test.local' } }); assert.equal(r.statusCode, 200); assert.equal(h.calls.email.length, 1); const data = h.calls.email[0]; assert.equal(data.reportContent, 'Approved content'); assert.equal(data.reportTitle, 'Approved title'); assert.equal(data.attachments[0].url, 'approved attachment'); assert.ok(!JSON.stringify(data).includes('INTERNAL')); }
});
test('legacy email compatibility is preserved', async () => { const h = harness(report('draft')); delete h.state.report.progressId; assert.equal((await h.request('reports', 'post', '/:id/send-email', { body: { parentEmail: 'parent@test.local' } })).statusCode, 200); });
test('wrong tenant, teacher or recipient cannot send', async () => {
  for (const kind of ['tenant', 'teacher', 'recipient']) { const h = harness(); if (kind === 'tenant') h.state.actor.schoolId = id(90); if (kind === 'teacher') h.state.actor._id = id(91); const r = await h.request('reports', 'post', '/:id/send-email', { body: { parentEmail: kind === 'recipient' ? 'other@test.local' : 'parent@test.local' } }); assert.ok([403,404].includes(r.statusCode)); assert.equal(h.calls.email.length, 0); }
});
test('parent detail, list and PDF reject unfinalized Progress-backed reports', async () => {
  const h = harness(report('draft')); h.state.actor.email = 'parent@test.local';
  for (const url of ['/me/reports/:id', '/me/reports/:id/pdf']) assert.equal((await h.request('parents', 'get', url, { role: 'parent' })).statusCode, 404);
  const list = await h.request('parents', 'get', '/me/reports', { role: 'parent' }); assert.equal(list.body.data.length, 0);
});
test('parent receives finalized whitelist without fallback to internal data', async () => {
  const h = harness(); h.state.actor.email = 'parent@test.local'; h.state.report.finalizedSnapshot.parentVisibleContent = '';
  const r = await h.request('parents', 'get', '/me/reports/:id', { role: 'parent' }); assert.equal(r.statusCode, 200); assert.equal(r.body.data.content, ''); assert.equal(r.body.data.title, 'Approved title'); assert.ok(!JSON.stringify(r.body.data).includes('INTERNAL'));
  for (const key of ['progressSnapshot','finalizedSnapshot','aiGenerated','approvals','templateSnapshot','observations']) assert.equal(Object.hasOwn(r.body.data,key),false);
  h.state.actor.schoolId=id(90); assert.equal((await h.request('parents','get','/me/reports/:id',{role:'parent'})).statusCode,404);
});
test('teacher Progress listing follows participation IDs, keeps tenant and query filters', async () => {
  const h = harness(); const r = await h.request('progress','get','/',{query:{schoolId:String(id(90)),childParticipationId:String(participationId)}}); assert.equal(r.statusCode,200); assert.equal(r.body.data.length,1); assert.equal(String(r.body.data[0]._id),String(progressId));
  const queries=Object.fromEntries(h.calls.queries); assert.equal(String(queries.Progress.schoolId),String(school)); assert.equal(queries.Progress.childParticipationId,String(participationId)); assert.equal(String(queries.DeliveredSession.deliveredBy),String(teacher)); assert.equal(String(queries.ChildParticipation.schoolId),String(school)); assert.equal(String(queries.ChildParticipation.deliveredSessionId.$in[0]),String(sessionId));
});
test('Progress edit supplies roadmap context and preserves parameter validation', async () => {
  const h=harness(); const body={parameterResults:[{parameterId:String(parameterId),value:65}]};const r=await h.request('progress','put','/:id',{body});assert.equal(r.statusCode,200);assert.equal(h.calls.progressSaves,1);
  const reqQuery=h.calls.queries.find(([name])=>name==='Requirement')[1];assert.equal(String(reqQuery.programId),String(programId));assert.equal(String(reqQuery.levelId),String(levelId));
  body.parameterResults[0].value=101;assert.equal((await h.request('progress','put','/:id',{body})).statusCode,400);assert.equal(h.calls.progressSaves,1);
  h.state.roadmap=null;assert.equal((await h.request('progress','put','/:id',{body})).statusCode,409);assert.equal(h.calls.progressSaves,1);
});
test('Progress edit rejects other tenant and teacher',async()=>{for(const field of ['schoolId','_id']){const h=harness();h.state.actor[field]=id(90);const r=await h.request('progress','put','/:id');assert.ok([403,404].includes(r.statusCode));assert.equal(h.calls.progressSaves,0);}});
test('approval and sending require authentication and a permitted human role',async()=>{
 for(const url of ['/:id/approve','/:id/send','/:id/send-email','/:id/regenerate-pdf']){const method=(url.endsWith('send-email') || url.endsWith('regenerate-pdf'))?'post':'patch';const h=harness();assert.equal((await h.request('reports',method,url,{anonymous:true})).statusCode,401);assert.equal((await h.request('reports',method,url,{role:'ai'})).statusCode,403);assert.equal((await h.request('reports',method,url,{role:'parent'})).statusCode,403);assert.equal(h.calls.email.length,0);}
});

for (const [method, url] of [['patch','/:id/send'], ['post','/:id/send-email']]) {
  test(url + ' rejects draft and malformed snapshots without delivery', async () => {
    for (const broken of [report('draft'), { ...report(), finalizedSnapshot: {} }, { ...report(), finalizedSnapshot: { ...report().finalizedSnapshot, finalizedAt: 'bad' } }]) {
      const h=harness(broken); const r=await h.request('reports',method,url,{body:{parentEmails:['parent@test.local']}});
      assert.equal(r.statusCode,409);assert.equal(h.calls.email.length,0);assert.equal(h.calls.reportSaves,0);
    }
  });
  test(url + ' accepts once and persists canonical communication and artifact', async () => {
    const h=harness();const snapshot=JSON.stringify(h.state.report.finalizedSnapshot);
    const r=await h.request('reports',method,url,{body:{parentEmails:['parent@test.local','PARENT@test.local']}});
    assert.equal(r.body.outcome,'sent');assert.equal(h.calls.email.length,1);assert.equal(h.calls.pdfCreates[0].reportContent,'Approved content');
    assert.equal(h.state.report.status,'sent');assert.equal(h.state.report.parentCommunication.isSent,true);
    assert.equal(h.state.report.parentCommunication.sentTo.length,1);assert.ok(h.state.report.parentCommunication.sentAt);assert.ok(h.state.report.pdfArtifact);
    const again=await h.request('reports',method,url,{body:{parentEmail:'parent@test.local'}});
    assert.equal(again.body.outcome,'already_sent');assert.equal(h.calls.email.length,1);assert.equal(JSON.stringify(h.state.report.finalizedSnapshot),snapshot);
  });
}
test('publication failures and simulation do not persist sent state',async()=>{
  for(const outcome of ['delivery_failure','pdf_failure','configuration_failure','simulated']) {
    const h=harness();if(outcome==='simulated')h.state.simulated=true;else h.state.emailError=outcome;
    const r=await h.request('reports','post','/:id/send-email',{body:{parentEmail:'parent@test.local'}});
    assert.equal(r.body.success,false);assert.equal(r.body.outcome,outcome);assert.equal(h.state.report.status,'approved');assert.equal(h.calls.reportSaves,0);
  }
});
test('accepted transport plus persistence failure is explicit and never automatically resent',async()=>{
  const h=harness();h.state.saveFailure=true;
  const r=await h.request('reports','post','/:id/send-email',{body:{parentEmail:'parent@test.local'}});
  assert.equal(r.body.outcome,'persistence_failure');assert.equal(r.body.data.transportAccepted,true);assert.equal(h.calls.reportSaves,0);
  const retry=await h.request('reports','post','/:id/send-email',{body:{parentEmail:'parent@test.local'}});
  assert.equal(retry.body.outcome,'publication_blocked');assert.equal(h.calls.email.length,1);
});
test('parent PDF uses verified bytes and denies another parent or missing artifact',async()=>{
  const h=harness();h.state.report.pdfArtifact={key:'test.pdf'};h.state.actor.email='parent@test.local';
  const r=await h.request('parents','get','/me/reports/:id/pdf',{role:'parent'});assert.equal(r.statusCode,200);assert.ok(r.bytes);assert.equal(h.calls.pdfReads,1);
  h.state.actor.email='other@test.local';assert.equal((await h.request('parents','get','/me/reports/:id/pdf')).statusCode,403);assert.equal(h.calls.pdfReads,1);
  h.state.actor.email='parent@test.local';h.state.missingPdf=true;assert.equal((await h.request('parents','get','/me/reports/:id/pdf')).body.code,'PDF_UNAVAILABLE');
});
test('regeneration is authorized, uses finalized data, and leaves lifecycle unchanged',async()=>{
  const h=harness();h.state.report.status='sent';const snapshot=JSON.stringify(h.state.report.finalizedSnapshot);
  const r=await h.request('reports','post','/:id/regenerate-pdf');assert.equal(r.statusCode,200);assert.equal(h.calls.pdfCreates[0].reportContent,'Approved content');assert.equal(h.calls.email.length,0);assert.equal(h.state.report.status,'sent');assert.equal(JSON.stringify(h.state.report.finalizedSnapshot),snapshot);
  h.state.actor.schoolId=id(90);assert.equal((await h.request('reports','post','/:id/regenerate-pdf')).statusCode,404);
});

// Controlled interleavings over an in-memory atomic-update substitute.
// These assert route predicates and outcomes, not MongoDB's concurrency implementation.
function revisionHarness(legacy = false) {
  let stored = { ...report('draft'), schoolId: String(school), teacherId: String(teacher),
    __v: 0, finalizedSnapshot: null, templateSnapshot: { name: 'Template' }, approvals: [] };
  if (legacy) delete stored.progressId;
  const copy = value => JSON.parse(JSON.stringify(value));
  const pending = []; const calls = { legacyEdits: 0, legacyApprovals: 0 };
  const snapshot = () => {
    const doc = copy(stored);
    doc.approve = async () => { calls.legacyApprovals++; stored.status = 'approved'; };
    return doc;
  };
  const h = harness(stored, {
    findById: () => chain(snapshot()),
    findByIdAndUpdate: (_, changes) => { calls.legacyEdits++; Object.assign(stored, copy(changes)); return chain(snapshot()); },
    findOneAndUpdate: (filter, update, options) => ({
      populate() { return this; },
      then(resolve, reject) {
        pending.push(() => {
          try {
            for (const field of ['_id','schoolId','teacherId','progressId','status','finalizedSnapshot','__v']) assert.ok(Object.hasOwn(filter,field),field);
            assert.equal(update.$inc.__v,1);assert.equal(options.runValidators,true);assert.equal(options.new,true);
            const matches=Object.entries(filter).every(([field,expected])=>{
              const actual=stored[field];
              if(expected && expected.$in)return expected.$in.includes(actual);
              if(expected && Object.hasOwn(expected,'$exists'))return (actual!==undefined)===expected.$exists;
              if(expected===null)return actual==null;
              return String(actual)===String(expected);
            });
            if(!matches)return resolve(null);
            Object.assign(stored,copy(update.$set));stored.__v=(stored.__v||0)+1;
            if(update.$push?.approvals)stored.approvals.push(copy(update.$push.approvals));
            resolve(snapshot());
          } catch(e) { reject(e); }
        });
      }
    })
  });
  async function waitFor(count) {
    for(let i=0;i<100 && pending.length<count;i++)await new Promise(setImmediate);
    assert.equal(pending.length,count,'expected requests to reach atomic write');
  }
  return {h,pending,waitFor,calls,get stored(){return stored;}};
}
test('two competing approvals finalize exactly once and preserve the winning snapshot',async()=>{
  const x=revisionHarness();const a=x.h.request('reports','patch','/:id/approve');const b=x.h.request('reports','patch','/:id/approve');
  await x.waitFor(2);x.pending[0]();assert.equal((await a).statusCode,200);
  const winner=JSON.stringify(x.stored.finalizedSnapshot);x.pending[1]();const loser=await b;
  assert.equal(loser.statusCode,409);assert.equal(loser.body.code,'REPORT_REVISION_CONFLICT');assert.equal(x.stored.approvals.length,1);assert.equal(x.stored.__v,1);assert.equal(JSON.stringify(x.stored.finalizedSnapshot),winner);
});
test('approval winning against an in-flight draft edit rejects the stale edit',async()=>{
  const x=revisionHarness();const edit=x.h.request('reports','put','/:id',{body:{content:'Stale edit'}});const approve=x.h.request('reports','patch','/:id/approve');
  await x.waitFor(2);x.pending[1]();assert.equal((await approve).statusCode,200);x.pending[0]();assert.equal((await edit).statusCode,409);
  assert.equal(x.stored.content,'INTERNAL');assert.equal(x.stored.finalizedSnapshot.parentVisibleContent,x.stored.content);
});
test('draft edit winning rejects approval of the old revision; fresh approval captures the edit',async()=>{
  const x=revisionHarness();const edit=x.h.request('reports','put','/:id',{body:{content:'Reviewed edit'}});const approve=x.h.request('reports','patch','/:id/approve');
  await x.waitFor(2);x.pending[0]();assert.equal((await edit).statusCode,200);x.pending[1]();assert.equal((await approve).statusCode,409);
  assert.equal(x.stored.status,'draft');assert.equal(x.stored.finalizedSnapshot,null);
  const fresh=x.h.request('reports','patch','/:id/approve');await x.waitFor(3);x.pending[2]();assert.equal((await fresh).statusCode,200);assert.equal(x.stored.finalizedSnapshot.parentVisibleContent,'Reviewed edit');assert.equal(x.stored.__v,2);
});
test('delayed approval cannot replace a snapshot after the winner is published',async()=>{
  const x=revisionHarness();const first=x.h.request('reports','patch','/:id/approve');const delayed=x.h.request('reports','patch','/:id/approve');
  await x.waitFor(2);x.pending[0]();await first;const winner=JSON.stringify(x.stored.finalizedSnapshot);
  x.stored.status='sent';x.pending[1]();assert.equal((await delayed).statusCode,409);assert.equal(x.stored.status,'sent');assert.equal(JSON.stringify(x.stored.finalizedSnapshot),winner);
});
test('missing __v initializes atomically, while an existing snapshot fails closed',async()=>{
  const x=revisionHarness();delete x.stored.__v;const first=x.h.request('reports','patch','/:id/approve');await x.waitFor(1);x.pending[0]();assert.equal((await first).statusCode,200);assert.equal(x.stored.__v,1);
  const y=revisionHarness();y.stored.finalizedSnapshot={parentVisibleContent:'Existing'};const request=y.h.request('reports','patch','/:id/approve');await y.waitFor(1);y.pending[0]();assert.equal((await request).statusCode,409);assert.equal(y.stored.finalizedSnapshot.parentVisibleContent,'Existing');
});
test('legacy approval and editing continue through their original write mechanisms',async()=>{
  const x=revisionHarness(true);const edit=await x.h.request('reports','put','/:id',{body:{content:'Legacy edit'}});assert.equal(edit.statusCode,200);assert.equal(x.calls.legacyEdits,1);assert.equal(x.stored.__v,0);
  const approval=await x.h.request('reports','patch','/:id/approve');assert.equal(approval.statusCode,200);assert.equal(x.calls.legacyApprovals,1);assert.equal(x.stored.finalizedSnapshot,null);assert.equal(x.pending.length,0);
});
