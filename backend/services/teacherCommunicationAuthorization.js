const Enrollment = require('../models/Enrollment');
const Class = require('../models/Class');
const User = require('../models/User');
const { eligibleGuardians } = require('./guardianAccessService');

const sid = value => String(value?._id || value || '');

function assignmentCovers(assignment, teacherId, at) {
  if (sid(assignment?.staffId) !== sid(teacherId) || assignment.status !== 'active') return false;
  const from = assignment.effectiveFrom ? new Date(assignment.effectiveFrom) : null;
  const to = assignment.effectiveTo ? new Date(assignment.effectiveTo) : null;
  return (!from || from <= at) && (!to || to >= at);
}

async function getAuthorizedTeacherEnrollment(teacher, participantId, dependencies = {}) {
  if (!teacher || teacher.role !== 'teacher' || teacher.isActive === false || !teacher.schoolId) return null;
  const findParticipant = dependencies.findParticipant || (query => User.findOne(query));
  const participant = await findParticipant({
    _id: participantId,
    schoolId: teacher.schoolId,
    role: 'student',
    isActive: true
  });
  if (!participant) return null;

  const findEnrollments = dependencies.findEnrollments || (query => Enrollment.find(query).lean());
  const enrollments = await findEnrollments({
    schoolId: teacher.schoolId,
    childId: participantId,
    status: 'active'
  });
  const at = dependencies.at || new Date();
  for (const enrollment of enrollments) {
    if ((enrollment.staffAssignments || []).some(item => assignmentCovers(item, teacher._id, at))) {
      return { participant, enrollment };
    }
    if (!enrollment.currentClassId) continue;
    const findClass = dependencies.findClass || (query => Class.findOne(query).lean());
    const deliveryGroup = await findClass({
      _id: enrollment.currentClassId,
      schoolId: teacher.schoolId,
      isActive: true,
      status: 'active',
      'assignedTeachers.teacherId': teacher._id
    });
    if (deliveryGroup) return { participant, enrollment };
  }
  return null;
}

async function teacherCanCommunicateWithParticipant(teacher, participantId, dependencies = {}) {
  return Boolean(await getAuthorizedTeacherEnrollment(teacher, participantId, dependencies));
}

async function getTeacherCommunicationRecipients(teacher, dependencies = {}) {
  if (!teacher || teacher.role !== 'teacher' || teacher.isActive === false || !teacher.schoolId) return [];
  const findEnrollments = dependencies.findEnrollments || (query => Enrollment.find(query).lean());
  const findClasses = dependencies.findClasses || (query => Class.find(query).lean());
  const findParticipants = dependencies.findParticipants || (query => User.find(query).select('firstName lastName').lean());
  const enrollments = await findEnrollments({ schoolId: teacher.schoolId, status: 'active' });
  const classIds = [...new Set(enrollments.map(item => sid(item.currentClassId)).filter(Boolean))];
  const classes = classIds.length ? await findClasses({
    _id: { $in: classIds }, schoolId: teacher.schoolId, isActive: true, status: 'active',
    'assignedTeachers.teacherId': teacher._id
  }) : [];
  const assignedClassIds = new Set(classes.map(item => sid(item._id)));
  const at = dependencies.at || new Date();
  const authorized = enrollments.filter(item =>
    assignedClassIds.has(sid(item.currentClassId)) ||
    (item.staffAssignments || []).some(assignment => assignmentCovers(assignment, teacher._id, at))
  );
  const childIds = [...new Set(authorized.map(item => sid(item.childId)).filter(Boolean))];
  const participants = childIds.length ? await findParticipants({
    _id: { $in: childIds }, schoolId: teacher.schoolId, role: 'student', isActive: true
  }) : [];
  const guardiansFor = dependencies.eligibleGuardians || eligibleGuardians;
  const recipients = [];
  for (const participant of participants) {
    const guardians = await guardiansFor(participant._id, 'communication');
    for (const guardian of guardians) recipients.push({
      guardianId: sid(guardian._id),
      guardianName: `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim(),
      participantId: sid(participant._id),
      participantName: `${participant.firstName || ''} ${participant.lastName || ''}`.trim()
    });
  }
  return recipients;
}

module.exports = {
  assignmentCovers,
  getAuthorizedTeacherEnrollment,
  teacherCanCommunicateWithParticipant,
  getTeacherCommunicationRecipients
};
