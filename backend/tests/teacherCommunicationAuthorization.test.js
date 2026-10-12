const test = require('node:test');
const assert = require('node:assert/strict');
const {
  teacherCanCommunicateWithParticipant,
  getTeacherCommunicationRecipients
} = require('../services/teacherCommunicationAuthorization');
const { userCanUseConversation } = require('../services/guardianCommunicationService');

const teacher = { _id: 'teacher-a', role: 'teacher', schoolId: 'school-a', isActive: true };
const participant = { _id: 'child-a', role: 'student', schoolId: 'school-a', isActive: true };
const enrollment = overrides => ({ childId: 'child-a', schoolId: 'school-a', status: 'active', currentClassId: 'class-a', staffAssignments: [], ...overrides });

test('teacher can communicate through an active assigned delivery group', async () => {
  const allowed = await teacherCanCommunicateWithParticipant(teacher, 'child-a', {
    findParticipant: async () => participant,
    findEnrollments: async () => [enrollment()],
    findClass: async query => query.schoolId === 'school-a' && query['assignedTeachers.teacherId'] === 'teacher-a' ? { _id: 'class-a' } : null
  });
  assert.equal(allowed, true);
});

test('date-valid individual assignment permits access but ended assignment does not', async () => {
  const base = {
    findParticipant: async () => participant,
    findClass: async () => null,
    at: new Date('2026-10-11T12:00:00Z')
  };
  assert.equal(await teacherCanCommunicateWithParticipant(teacher, 'child-a', {
    ...base,
    findEnrollments: async () => [enrollment({ currentClassId: null, staffAssignments: [{ staffId: 'teacher-a', status: 'active', effectiveFrom: new Date('2026-10-01'), effectiveTo: new Date('2026-10-20') }] })]
  }), true);
  assert.equal(await teacherCanCommunicateWithParticipant(teacher, 'child-a', {
    ...base,
    findEnrollments: async () => [enrollment({ currentClassId: null, staffAssignments: [{ staffId: 'teacher-a', status: 'ended', effectiveFrom: new Date('2026-10-01') }] })]
  }), false);
});

test('inactive, unrelated, and cross-tenant participants are denied', async () => {
  for (const found of [null, { ...participant, schoolId: 'school-b' }]) {
    assert.equal(await teacherCanCommunicateWithParticipant(teacher, 'child-a', {
      findParticipant: async query => found && found.schoolId === query.schoolId ? found : null,
      findEnrollments: async () => [enrollment()], findClass: async () => ({ _id: 'class-a' })
    }), false);
  }
  assert.equal(await teacherCanCommunicateWithParticipant({ ...teacher, isActive: false }, 'child-a'), false);
});

test('recipient list includes only guardians with communication permission for authorized children', async () => {
  const result = await getTeacherCommunicationRecipients(teacher, {
    findEnrollments: async () => [enrollment(), enrollment({ childId: 'child-b', currentClassId: 'class-b' })],
    findClasses: async () => [{ _id: 'class-a' }],
    findParticipants: async () => [participant],
    eligibleGuardians: async () => [{ _id: 'guardian-a', firstName: 'Gina', lastName: 'Guardian' }]
  });
  assert.deepEqual(result, [{ guardianId: 'guardian-a', guardianName: 'Gina Guardian', participantId: 'child-a', participantName: '' }]);
});

test('teacher conversation access requires same tenant and current participant authorization', async () => {
  const conversation = { schoolId: 'school-a', metadata: { studentId: 'child-a' } };
  assert.equal(await userCanUseConversation(teacher, conversation, { teacherCanCommunicateWithParticipant: async () => true }), true);
  assert.equal(await userCanUseConversation(teacher, conversation, { teacherCanCommunicateWithParticipant: async () => false }), false);
  assert.equal(await userCanUseConversation(teacher, { ...conversation, schoolId: 'school-b' }, { teacherCanCommunicateWithParticipant: async () => true }), false);
});
