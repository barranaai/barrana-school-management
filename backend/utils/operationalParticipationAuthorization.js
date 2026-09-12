const sameId = (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b);
const covers = (from, to, at) => {
  const start = new Date(from).getTime();
  const end = to == null ? Infinity : new Date(to).getTime();
  return from != null && Number.isFinite(start) && start <= at && end >= at;
};

// Creation only: historical access continues to use Delivered Session ownership.
function canCreateOperationalParticipation({ teacher, child, enrollment, session, cls, childId, enrollmentId }) {
  if (!teacher || teacher.role !== 'teacher' || !child || child.role !== 'student' || !enrollment || !session || !cls) return false;
  if (![child, enrollment, session, cls].every(row => sameId(row.schoolId, teacher.schoolId))) return false;
  if (!sameId(child._id, childId) || !sameId(enrollment._id, enrollmentId) || !sameId(enrollment.childId, child._id)) return false;
  if (!sameId(enrollment.programId, session.programId) || !sameId(enrollment.currentLevelId, session.levelId)) return false;
  if (enrollment.status !== 'active' || cls.isActive !== true || !sameId(cls._id, session.classId)) return false;
  if (!sameId(session.deliveredBy, teacher._id)) return false;
  if (!cls.assignedTeachers?.some(a => sameId(a.teacherId, teacher._id))) return false;
  const at = new Date(session.scheduledAt).getTime();
  if (!Number.isFinite(at) || !covers(enrollment.startDate, enrollment.endDate, at)) return false;
  const assignments = (enrollment.classAssignments || []).filter(a =>
    sameId(a.classId, session.classId) && a.status === 'active' && covers(a.effectiveFrom, a.effectiveTo, at));
  // Overlapping matches are ambiguous; currentClassId is never a substitute.
  return assignments.length === 1;
}

module.exports = { canCreateOperationalParticipation };
