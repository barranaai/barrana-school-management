const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { integrationUri } = require('../config/integrationDatabase');
const { openIntegrationHarness } = require('./helpers/integrationHarness');

const scheduledAt = '2026-09-20T09:00:00.000Z';
const assignmentAt = '2026-09-10T00:00:00.000Z';

test('real Enrollment to Progress integration (isolated replica set)', { timeout: 120000 }, async t => {
  const target = new URL(integrationUri());
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '27018');
  process.env.JWT_SECRET = randomUUID();
  process.env.ENABLE_SCHEDULERS = 'false';
  process.env.ENABLE_DEBUG_ROUTES = 'false';

  const h = await openIntegrationHarness();
  const owned = new Map();
  const cleanupOrder = [
    'Progress', 'ChildParticipation', 'DeliveredSession', 'PlannedSession', 'Roadmap',
    'Enrollment', 'Class', 'Parameter', 'Requirement', 'Level', 'Program', 'User'
  ];
  const requiredIndexes = ['Enrollment', 'Roadmap', 'PlannedSession', 'ChildParticipation', 'Progress'];
  const { School, User, Program, Level, Requirement, Parameter, Class, Enrollment, Roadmap,
    PlannedSession, DeliveredSession, ChildParticipation, Progress } = h.models;

  const auth = token => ({ Authorization: 'Bearer ' + token });
  const ok = (response, status = 200) => {
    assert.equal(response.status, status, JSON.stringify(response.body));
    assert.equal(response.body.success, true, JSON.stringify(response.body));
    return response.body.data;
  };
  const call = (method, url, token, body) => {
    const req = request(h.app)[method](url).set(auth(token));
    return body === undefined ? req : req.send(body);
  };

  try {
    await h.verify();
    for (const name of ['School', ...cleanupOrder]) {
      const model = h.models[name];
      assert.equal(model.db, h.connection, name + ' escaped isolated connection');
      await model.createCollection();
    }
    for (const name of requiredIndexes) await h.models[name].createIndexes();

    const key = randomUUID();
    const school = await School.create({
      name: 'Workflow Integration ' + key,
      slug: 'workflow-integration-' + key,
      schoolType: 'montessori_school',
      estimatedStudents: 1,
      address: { street: '1 Test Street', city: 'Test', state: 'ON', zipCode: 'A1A 1A1', country: 'Canada' },
      contactPerson: { name: 'Integration Admin', email: key + '@example.invalid' }
    });
    owned.set(String(school._id), school.slug);

    const admin = await User.create({
      firstName: 'Integration', lastName: 'Admin', email: 'admin-' + key + '@example.invalid',
      password: randomUUID(), role: 'school_admin', schoolId: school._id, isEmailVerified: true
    });
    const teacher = await User.create({
      firstName: 'Integration', lastName: 'Teacher', email: 'teacher-' + key + '@example.invalid',
      password: randomUUID(), role: 'teacher', grade: 'Skills', schoolId: school._id, isEmailVerified: true
    });
    const child = await User.create({
      firstName: 'Integration', lastName: 'Child', password: randomUUID(), role: 'student',
      studentId: 'WF-' + key, studentGrade: 'Foundation', schoolId: school._id, isEmailVerified: true
    });
    const adminToken = admin.generateAuthToken();
    const teacherToken = teacher.generateAuthToken();

    const program = await Program.create({ schoolId: school._id, name: 'Integration Swimming' });
    const level = await Level.create({ schoolId: school._id, programId: program._id, name: 'Water Confidence', sequence: 1 });
    const requirement = await Requirement.create({
      schoolId: school._id, programId: program._id, levelId: level._id,
      name: 'Safe pool entry', sequence: 1
    });
    const parameter = await Parameter.create({
      schoolId: school._id, programId: program._id, requirementId: requirement._id,
      name: 'Confidence rating', type: 'rating', sequence: 1
    });
    const oldClass = await Class.create({
      name: 'Old Saturday Group', schoolId: school._id, grade: 'Water Confidence',
      assignedTeachers: [{ teacherId: teacher._id, role: 'primary' }],
      schedule: { academicYear: '2026', startDate: '2026-09-01' }, createdBy: admin._id
    });
    const newClass = await Class.create({
      name: 'New Thursday Group', schoolId: school._id, grade: 'Water Confidence',
      assignedTeachers: [{ teacherId: teacher._id, role: 'primary' }],
      schedule: { academicYear: '2026', startDate: '2026-09-01' }, createdBy: admin._id
    });

    const foreignKey = randomUUID();
    const foreignSchool = await School.create({
      name: 'Foreign Integration ' + foreignKey,
      slug: 'workflow-foreign-' + foreignKey,
      schoolType: 'montessori_school',
      estimatedStudents: 1,
      address: { street: '2 Test Street', city: 'Test', state: 'ON', zipCode: 'A1A 1A1', country: 'Canada' },
      contactPerson: { name: 'Foreign Admin', email: foreignKey + '@example.invalid' }
    });
    owned.set(String(foreignSchool._id), foreignSchool.slug);
    const foreignAdmin = await User.create({
      firstName: 'Foreign', lastName: 'Admin', email: 'foreign-' + foreignKey + '@example.invalid',
      password: randomUUID(), role: 'school_admin', schoolId: foreignSchool._id, isEmailVerified: true
    });
    const foreignClass = await Class.create({
      name: 'Foreign Class', schoolId: foreignSchool._id, grade: 'Foundation',
      schedule: { academicYear: '2026', startDate: '2026-09-01' }, createdBy: foreignAdmin._id
    });

    const enrollment = ok(await call('post', '/api/enrollments', adminToken, {
      schoolId: school._id, childId: child._id, programId: program._id,
      currentLevelId: level._id, currentClassId: oldClass._id,
      startDate: '2026-09-01T00:00:00.000Z', status: 'active'
    }), 201);

    const crossTenant = await call('put', '/api/enrollments/' + enrollment._id + '/class-assignment', adminToken, {
      schoolId: school._id, classId: foreignClass._id, effectiveDate: assignmentAt
    });
    assert.equal(crossTenant.status, 400);
    assert.match(crossTenant.body.message, /not found|unavailable/i);

    const reassigned = ok(await call('put', '/api/enrollments/' + enrollment._id + '/class-assignment', adminToken, {
      schoolId: school._id, classId: newClass._id, effectiveDate: assignmentAt, reason: 'Integration reassignment'
    }));
    assert.equal(String(reassigned.currentClassId), String(newClass._id));
    assert.equal(reassigned.classAssignments.length, 2);
    assert.equal(reassigned.classAssignments[0].status, 'ended');
    assert.equal(new Date(reassigned.classAssignments[0].effectiveTo).toISOString(), assignmentAt);
    assert.equal(reassigned.classAssignments[1].status, 'active');
    assert.equal(new Date(reassigned.classAssignments[1].effectiveFrom).toISOString(), assignmentAt);

    const roadmapDraft = ok(await call('post', '/api/roadmaps', adminToken, {
      schoolId: school._id, programId: program._id, levelId: level._id,
      name: 'Safe Entry Roadmap', methodology: 'Demonstration and supported practice'
    }), 201);
    const roadmap = ok(await call('patch', '/api/roadmaps/' + roadmapDraft._id + '/activate', adminToken, {
      schoolId: school._id, __v: roadmapDraft.__v, expectedPredecessor: null,
      effectiveFrom: '2026-09-01T00:00:00.000Z'
    }));
    assert.equal(roadmap.status, 'active');

    const plannedDraft = ok(await call('post', '/api/roadmaps/' + roadmap._id + '/sessions', adminToken, {
      schoolId: school._id, sequence: 1, title: 'Safe Entry and Supported Floating',
      description: 'Practice safe entry and supported floating.',
      methodology: 'Instructor demonstration, supported practice, direct observation.',
      expectedOutcomes: ['Enter safely with guidance'],
      objectives: [{
        sequence: 1, title: 'Safe pool entry', description: 'Enter safely with instructor guidance.',
        expectedOutcome: 'Safe controlled entry', requirementId: requirement._id, parameterId: parameter._id
      }]
    }), 201);
    const planned = ok(await call('patch', '/api/planned-sessions/' + plannedDraft._id + '/activate', adminToken, {
      schoolId: school._id
    }));
    assert.equal(planned.status, 'active');

    const oldSession = ok(await call('post', '/api/delivered-sessions', teacherToken, {
      schoolId: school._id, plannedSessionId: planned._id, classId: oldClass._id, scheduledAt
    }), 201);
    const newSession = ok(await call('post', '/api/delivered-sessions', teacherToken, {
      schoolId: school._id, plannedSessionId: planned._id, classId: newClass._id, scheduledAt
    }), 201);
    assert.equal(newSession.plannedSessionSnapshot.objectives.length, 1);
    assert.ok(newSession.plannedSessionSnapshot.objectives[0].objectiveId);
    assert.equal(newSession.plannedSessionSnapshot.objectives[0].title, 'Safe pool entry');

    const oldEligibility = ok(await request(h.app).get('/api/child-participations/eligible')
      .set(auth(teacherToken)).query({ schoolId: String(school._id), deliveredSessionId: String(oldSession._id) }));
    assert.equal(oldEligibility.eligible.some(row => String(row.enrollmentId) === String(enrollment._id)), false);

    const newEligibility = ok(await request(h.app).get('/api/child-participations/eligible')
      .set(auth(teacherToken)).query({ schoolId: String(school._id), deliveredSessionId: String(newSession._id) }));
    assert.equal(newEligibility.eligible.length, 1);
    assert.equal(String(newEligibility.eligible[0].childId), String(child._id));
    assert.equal(String(newEligibility.eligible[0].enrollmentId), String(enrollment._id));

    const participation = ok(await call('post', '/api/child-participations', teacherToken, {
      schoolId: school._id, deliveredSessionId: newSession._id,
      childId: child._id, enrollmentId: enrollment._id
    }), 201);
    for (const [field, value] of [
      ['schoolId', school._id], ['childId', child._id], ['enrollmentId', enrollment._id],
      ['deliveredSessionId', newSession._id], ['programId', program._id],
      ['levelId', level._id], ['classId', newClass._id]
    ]) assert.equal(String(participation[field]), String(value), field);

    const duplicateParticipation = await call('post', '/api/child-participations', teacherToken, {
      schoolId: school._id, deliveredSessionId: newSession._id,
      childId: child._id, enrollmentId: enrollment._id
    });
    assert.equal(duplicateParticipation.status, 400);
    assert.match(duplicateParticipation.body.message, /already has participation/);

    ok(await call('patch', '/api/delivered-sessions/' + newSession._id + '/status', teacherToken, {
      schoolId: school._id, status: 'in_progress'
    }));

    const objectiveId = newSession.plannedSessionSnapshot.objectives[0].objectiveId;
    const progressPayload = {
      schoolId: school._id, childParticipationId: participation._id,
      objectiveResults: [{ objectiveId, status: 'achieved', instructorNote: 'Entered safely with guidance.' }],
      parameterResults: [{ parameterId: parameter._id, value: 4, note: 'Confident with support.' }],
      observations: 'Leo followed the entry sequence safely.',
      recommendations: 'Continue supported floating practice.',
      overallStatus: 'partially_achieved'
    };
    const progress = ok(await call('post', '/api/progress', teacherToken, progressPayload), 201);
    const stored = ok(await request(h.app).get('/api/progress/' + progress._id)
      .set(auth(teacherToken)).query({ schoolId: String(school._id) }));
    assert.equal(String(stored.schoolId), String(school._id));
    assert.equal(String(stored.childParticipationId), String(participation._id));
    assert.equal(stored.objectiveResults[0].title, 'Safe pool entry');
    assert.equal(stored.parameterResults[0].requirementLabel, 'Safe pool entry');
    assert.equal(stored.observations, progressPayload.observations);

    const duplicateProgress = await call('post', '/api/progress', teacherToken, progressPayload);
    assert.equal(duplicateProgress.status, 400);
    assert.match(duplicateProgress.body.message, /already exists/);

    const updated = ok(await call('put', '/api/progress/' + progress._id, teacherToken, {
      ...progressPayload,
      observations: 'Leo followed the entry sequence safely and needed less prompting.',
      recommendations: 'Repeat floating practice with reduced support.'
    }));
    assert.equal(updated.observations, 'Leo followed the entry sequence safely and needed less prompting.');
    const reread = ok(await request(h.app).get('/api/progress/' + progress._id)
      .set(auth(teacherToken)).query({ schoolId: String(school._id) }));
    assert.equal(reread.observations, updated.observations);
    assert.equal(reread.recommendations, updated.recommendations);
    assert.equal(await ChildParticipation.countDocuments({ schoolId: school._id, deliveredSessionId: newSession._id, childId: child._id }), 1);
    assert.equal(await Progress.countDocuments({ schoolId: school._id, childParticipationId: participation._id }), 1);

    const foreignRead = await request(h.app).get('/api/progress/' + progress._id)
      .set(auth(foreignAdmin.generateAuthToken())).query({ schoolId: String(foreignSchool._id) });
    assert.equal(foreignRead.status, 404);
  } finally {
    try {
      await t.test('cleanup removes only owned synthetic tenants and verifies absence', async () => {
        await h.verify();
        for (const [schoolId, slug] of owned) {
          assert.match(slug, /^(workflow|foreign)-integration-[0-9a-f-]{36}$/);
          const owner = await School.findOne({ _id: schoolId, slug }).lean();
          assert.ok(owner, 'Synthetic tenant ownership must still match');
          for (const name of cleanupOrder) {
            await h.models[name].deleteMany({ schoolId });
            assert.equal(await h.models[name].countDocuments({ schoolId }), 0, name + ' residue');
          }
          await School.deleteOne({ _id: schoolId, slug });
          assert.equal(await School.countDocuments({ _id: schoolId }), 0);
        }
      });
    } finally {
      await h.close();
    }
  }
});
