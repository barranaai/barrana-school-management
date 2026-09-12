/* Offline preparation only. No database imports, connections, writes or execution path.
 * Companion to verticalDemoFixtures.js; deliberately not wired into the additive runner.
 * Supplied IDs are assertions to verify later, not evidence of live record matches.
 */
const { DEMO_SCHOOL_SLUGS } = require('./verticalDemoFixtures');
const definitions = [
  {
    slug: 'barrana-swimming-demo', schoolId: '6a9fb530525e5a986c2bd7be',
    programId: '6a9fb537525e5a986c2bd7ea', programName: 'Learn-to-Swim',
    levelId: '6a9fb537525e5a986c2bd7ed', levelName: 'Water Confidence',
    classId: '6a9fb537525e5a986c2bd811', className: 'Water Confidence - Saturday',
    childId: '6a9fb535525e5a986c2bd7e1', childName: 'Maya', studentId: 'SWIM-DEMO-001',
    enrollmentId: '6a9fb537525e5a986c2bd81d', teacherId: '6a9fb533525e5a986c2bd7db',
    adminId: '6a9fb530525e5a986c2bd7d8', parentId: '6a9fb534525e5a986c2bd7de',
    reportTemplateId: '6a9fb538525e5a986c2bd832',
    title: 'Safe entry and supported floating', scheduledAt: '2026-09-19T09:00:00Z',
    methodology: 'Instructor demonstration, supported practice, direct observation.',
    objectives: [
      { sequence: 1, title: 'Safe pool entry with instructor guidance', requirementId: '6a9fb537525e5a986c2bd7f9', parameterId: '6a9fb537525e5a986c2bd7fc' },
      { sequence: 2, title: 'Front/back floating with support', requirementId: '6aa3bfd8116271f383e5a787', parameterId: '6aa3bfd8116271f383e5a797' }
    ]
  },
  {
    slug: 'barrana-montessori-demo', schoolId: '6a9fc65cf22d7d8c01394a3e',
    programId: '6a9fc65ef22d7d8c01394a6c', programName: 'Casa Early Development',
    levelId: '6a9fc65ef22d7d8c01394a72', levelName: 'Emerging Independence',
    classId: '6a9fc65ef22d7d8c01394a97', className: 'Emerging Independence - Morning',
    childId: '6a9fc65ef22d7d8c01394a66', childName: 'Owen', studentId: 'MONT-DEMO-002',
    enrollmentId: '6a9fc65ef22d7d8c01394aa6', teacherId: '6a9fc65df22d7d8c01394a5d',
    adminId: '6a9fc65df22d7d8c01394a59', parentId: '6a9fc65df22d7d8c01394a60',
    reportTemplateId: '6a9fc65ef22d7d8c01394ab4',
    title: 'Choosing materials and sustaining concentration', scheduledAt: '2026-09-21T09:00:00Z',
    methodology: 'Prepared environment, guide demonstration, child-led exploration, observation.',
    objectives: [
      { sequence: 1, title: 'Sustain attention during chosen activity', requirementId: '6a9fc65ef22d7d8c01394a81', parameterId: '6a9fc65ef22d7d8c01394a84' },
      { sequence: 2, title: 'Choose sensorial materials with guidance', requirementId: '6aa3c1164e3c33cfeef770ad', parameterId: '6aa3c1164e3c33cfeef770b5' }
    ]
  }
];
const plans = definitions.map(d => {
  if (!DEMO_SCHOOL_SLUGS.includes(d.slug)) throw Error('Unapproved school');
  if (!/^(SWIM|MONT)-DEMO-\d{3}$/.test(d.studentId)) throw Error('Invalid student identity');
  for (const [key, value] of Object.entries(d)) if (key !== 'studentId' && key.endsWith('Id') && !/^[a-f0-9]{24}$/.test(value)) throw Error('Invalid reference: ' + key);
  for (const o of d.objectives) for (const key of ['requirementId', 'parameterId']) if (!/^[a-f0-9]{24}$/.test(o[key])) throw Error('Invalid objective reference');
  return {
    ...d, dryRun: true, liveValidated: false, executionEnabled: false,
    prerequisiteAction: 'reuse only after tenant/identity/relationship validation; never update',
    records: [
      { entity: 'Roadmap', key: d.slug + ':operational-intro', identity: ['schoolId', 'programId', 'levelId', 'name'],
        name: d.levelName + ' - Operational Demo', statusOnCreate: 'draft',
        version: 'route resolves latest hierarchy version + 1; unknown offline',
        createRoute: 'POST /api/roadmaps', actorId: d.adminId,
        activation: 'PATCH /api/roadmaps/:id/activate with returned __v and expectedPredecessor:null; only newly created draft; block if another active version exists' },
      { entity: 'PlannedSession', key: d.slug + ':session-1', identity: ['schoolId', 'roadmapId', 'sequence'], sequence: 1,
        roadmapId: '$resolvedRoadmap._id', roadmapVersion: '$resolvedRoadmap.version', title: d.title,
        objectives: d.objectives, methodology: d.methodology, expectedOutcomes: [], statusOnCreate: 'draft',
        createRoute: 'POST /api/roadmaps/:roadmapId/sessions', actorId: d.adminId,
        activation: 'PATCH /api/planned-sessions/:id/activate; only newly created session' },
      { entity: 'DeliveredSession', key: d.slug + ':delivery-1', identity: ['schoolId', 'plannedSessionId', 'classId', 'scheduledAt'],
        plannedSessionId: '$resolvedPlannedSession._id', classId: d.classId, scheduledAt: d.scheduledAt, status: 'scheduled',
        createRoute: 'POST /api/delivered-sessions', actorId: d.teacherId,
        snapshot: 'Server copies authoritative planned objectives, objectiveId, labels, roadmap/version and methodology; no client snapshot' },
      { entity: 'ChildParticipation', key: d.slug + ':participation-1', identity: ['schoolId', 'deliveredSessionId', 'childId'],
        deliveredSessionId: '$resolvedDeliveredSession._id', childId: d.childId, enrollmentId: d.enrollmentId, status: 'active',
        createRoute: 'POST /api/child-participations', actorId: d.teacherId }
    ],
    preflightRequired: [
      'Authorized target with these existing prerequisites AND verified transaction-capable topology; test replica set does not contain demo prerequisites',
      'Every supplied ID exists exactly once in the expected tenant, with expected identity, role and active state',
      'Child matched by schoolId + studentId must have the supplied childId; never email identity',
      'Requirement belongs to program/level; parameter belongs to that requirement/program; all active',
      'Enrollment belongs to child/program and correct level; class assignment covers scheduledAt; approved class binding verified',
      'Teacher assigned to class AND canAccessStudent succeeds for the child; route caller must be the named teacher',
      'Report template belongs to school; parent-child relationship verified, but no report action',
      'Each operational identity is tenant scoped; duplicate or differing matches block; compatible existing records preserved',
      'Existing draft/archived dependencies requiring modification block; never activate a pre-existing record or archive an existing active roadmap',
      'Fresh route/schema validation and revision rechecks before each authorized future operation; dates must still be future'
    ]
  };
});
module.exports = { plans };
