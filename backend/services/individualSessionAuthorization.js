const sameId = (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b);

const covers = (from, to, at) => {
  const start = new Date(from).getTime();
  const end = to == null ? Infinity : new Date(to).getTime();
  return from != null && Number.isFinite(start) && start <= at && end >= at;
};

function isIndividualSessionTargetValid({ child, enrollment, session, schoolId }) {
  if (!child || child.role !== 'student' || child.isActive !== true || !enrollment || !session) return false;
  if (session.deliveryMode !== 'individual') return false;
  if (![child, enrollment, session].every(row => sameId(row.schoolId, schoolId))) return false;
  if (!sameId(session.individualEnrollmentId, enrollment._id) || !sameId(session.individualChildId, child._id)) return false;
  if (!sameId(enrollment.childId, child._id)) return false;
  if (enrollment.status !== 'active') return false;
  if (!sameId(enrollment.programId, session.programId) || !sameId(enrollment.currentLevelId, session.levelId)) return false;

  const at = new Date(session.scheduledAt).getTime();
  if (!Number.isFinite(at) || !covers(enrollment.startDate, enrollment.endDate, at)) return false;
  return true;
}

function canDeliverIndividualSession({ teacher, child, enrollment, session }) {
  if (!teacher || teacher.role !== 'teacher' || teacher.isActive !== true) return false;
  if (!isIndividualSessionTargetValid({ child, enrollment, session, schoolId: teacher.schoolId })) return false;
  if (!sameId(session.deliveredBy, teacher._id)) return false;

  const at = new Date(session.scheduledAt).getTime();
  return (enrollment.staffAssignments || []).some(assignment =>
    sameId(assignment.staffId, teacher._id) &&
    assignment.status === 'active' &&
    covers(assignment.effectiveFrom, assignment.effectiveTo, at));
}

module.exports = { canDeliverIndividualSession, isIndividualSessionTargetValid };
