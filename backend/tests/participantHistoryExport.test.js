const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const chain = value => { const result = { populate() { return result; }, sort() { return result; }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } }; return result; };
const id = value => String(value).padStart(24, '0');

function loadService() {
  const child = { _id: id(1), firstName: 'Maya', lastName: 'Demo', studentId: 'P-1', dateOfBirth: new Date('2018-01-01'), enrollmentDate: new Date('2026-01-01'), isActive: true, password: 'secret', emailVerificationToken: 'secret' };
  const programA = { _id: id(2), name: 'Swimming' }, programB = { _id: id(3), name: 'Piano' };
  const levelA = { _id: id(4), name: 'Water Confidence' }, levelB = { _id: id(5), name: 'Foundation' };
  const enrollment = { _id: id(6), programId: programA, currentLevelId: levelA, status: 'active', startDate: new Date('2026-01-01'),
    statusHistory: [], levelHistory: [{ levelId: levelA, effectiveFrom: new Date('2026-01-01') }, { levelId: levelB, effectiveFrom: new Date('2026-06-01') }], classAssignments: [], staffAssignments: [] };
  const secondEnrollment = { ...enrollment, _id: id(17), programId: programB, currentLevelId: levelB, startDate: new Date('2026-06-01'), levelHistory: [{ levelId: levelB, effectiveFrom: new Date('2026-06-01') }] };
  const participationA = { _id: id(7), deliveredSessionId: id(8), status: 'active' }, participationB = { _id: id(9), deliveredSessionId: id(10), status: 'active' }, legacyParticipation = { _id: id(15), deliveredSessionId: id(16), status: 'active' };
  const staff = { _id: id(11), firstName: 'Morgan', lastName: 'Coach', email: 'private@example.com' };
  const sessions = [
    { _id: id(8), title: 'Floating', programId: programA, levelId: levelA, scheduledAt: new Date('2026-02-01'), status: 'completed', deliveredBy: staff },
    { _id: id(10), title: 'Posture', programId: programB, levelId: levelB, scheduledAt: new Date('2026-07-01'), status: 'completed', deliveredBy: staff }
  ];
  const progress = { _id: id(12), childParticipationId: participationA._id, overallStatus: 'partially_achieved', revisionNumber: 2,
    objectiveResults: [{ objectiveId: id(13), title: 'Float', status: 'achieved', instructorNote: 'private', evidence: 'private' }], parameterResults: [], createdBy: staff, updatedBy: staff,
    createdAt: new Date('2026-02-01'), updatedAt: new Date('2026-02-02'), observations: 'private', recommendations: 'private', metadata: { secret: true },
    revisions: [{ revisionNumber: 1, objectiveResults: [{ objectiveId: id(13), title: 'Float', status: 'not_observed', instructorNote: 'private' }], parameterResults: [], originallySavedBy: staff, originallySavedAt: new Date('2026-02-01'), supersededBy: staff, supersededAt: new Date('2026-02-02'), observations: 'private' }] };
  const report = { _id: id(14), title: 'Draft title', reportType: 'progress', status: 'approved', teacherId: staff, deliveredSessionId: id(8), reportPeriod: {}, content: 'draft/private', internalNotes: 'private', aiGenerated: { generationPrompt: 'private' },
    finalizedSnapshot: { finalizedAt: new Date('2026-02-03'), parentVisibleContent: 'Parent-visible progress', customFieldValues: { confidence: 3 }, reportMetadata: { title: 'Final report', reportType: 'progress', reportPeriod: {} }, progressSnapshot: { observations: 'private' } } };
  const models = {
    '../models/Enrollment': { find: () => chain([enrollment, secondEnrollment]) }, '../models/ChildParticipation': { find: () => chain([participationA, participationB, legacyParticipation]) },
    '../models/DeliveredSession': { find: () => chain(sessions) }, '../models/Progress': { find: () => chain([progress]) }, '../models/Report': { find: () => chain([report]) }
  };
  const resolved = require.resolve('../services/participantHistoryExport'); delete require.cache[resolved]; const original = Module._load;
  Module._load = function(name, parent, isMain) { if (Object.hasOwn(models, name)) return models[name]; return original.call(this, name, parent, isMain); };
  try { return { service: require(resolved), child }; } finally { Module._load = original; }
}

test('curated export preserves structured history and omits private/security fields', async () => {
  const { service, child } = loadService();
  const result = await service.buildParticipantHistoryExport(child, id(20), { _id: id(20), name: 'Kidsible Academy' });
  assert.equal(result.schema, 'kidsible.participant-history.v1');
  assert.equal(result.enrollments.length, 2);
  assert.equal(result.enrollments[0].levelHistory.length, 2);
  assert.deepEqual(result.sessions.filter(row => row.session).map(row => row.session.program.name), ['Swimming', 'Piano']);
  assert.equal(result.progress.length, 1);
  assert.equal(result.progress[0].revisions.length, 1);
  assert.equal(result.finalizedReports[0].parentVisibleContent, 'Parent-visible progress');
  assert.equal(result.finalizedReports[0].program.name, 'Swimming');
  assert.equal(result.finalizedReports[0].level.name, 'Water Confidence');
  const serialized = JSON.stringify(result);
  for (const forbidden of ['password', 'emailVerificationToken', 'generationPrompt', 'internalNotes', 'observations', 'recommendations', 'instructorNote', 'evidence', 'private@example.com', 'draft/private']) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test('legacy or missing session context is represented as null rather than invented', async () => {
  const { service, child } = loadService();
  const result = await service.buildParticipantHistoryExport(child, id(20), { _id: id(20), name: 'Kidsible Academy' });
  assert.equal(result.sessions.some(row => row.session === null), true);
  assert.equal(result.progress[0].group, undefined);
});
