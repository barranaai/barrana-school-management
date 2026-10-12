const Class = require('../models/Class');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const Enrollment = require('../models/Enrollment');

const sameId = (left, right) => left != null && right != null && String(left._id || left) === String(right._id || right);

const assignmentCovers = (assignment, teacherId, at) => {
  if (!sameId(assignment?.staffId, teacherId) || assignment.status !== 'active') return false;
  const start = new Date(assignment.effectiveFrom).getTime();
  const end = assignment.effectiveTo == null ? Infinity : new Date(assignment.effectiveTo).getTime();
  return Number.isFinite(start) && start <= at && end >= at;
};

async function canTeacherAccessParticipantReporting(teacher, participant, now = new Date()) {
  if (!teacher || teacher.role !== 'teacher' || teacher.isActive === false || !participant || participant.role !== 'student') return false;
  if (!sameId(teacher.schoolId, participant.schoolId)) return false;
  const at = new Date(now).getTime();
  if (!Number.isFinite(at)) return false;

  const enrollments = await Enrollment.find({
    schoolId: teacher.schoolId,
    childId: participant._id,
    status: 'active',
    startDate: { $lte: new Date(at) },
    $or: [{ endDate: null }, { endDate: { $exists: false } }, { endDate: { $gte: new Date(at) } }]
  }).select('currentClassId staffAssignments').lean();

  if (enrollments.some(enrollment =>
    (enrollment.staffAssignments || []).some(assignment => assignmentCovers(assignment, teacher._id, at)))) return true;

  const classIds = enrollments.map(enrollment => enrollment.currentClassId).filter(Boolean);
  if (classIds.length && await Class.exists({
    _id: { $in: classIds },
    schoolId: teacher.schoolId,
    status: 'active',
    isActive: true,
    'assignedTeachers.teacherId': teacher._id
  })) return true;

  const participations = await ChildParticipation.find({
    schoolId: teacher.schoolId,
    childId: participant._id,
    status: { $ne: 'cancelled' }
  }).select('deliveredSessionId').lean();
  const sessionIds = participations.map(row => row.deliveredSessionId).filter(Boolean);
  return Boolean(sessionIds.length && await DeliveredSession.exists({
    _id: { $in: sessionIds },
    schoolId: teacher.schoolId,
    deliveredBy: teacher._id
  }));
}

module.exports = { canTeacherAccessParticipantReporting };
