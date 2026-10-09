const ongoingStatuses = ['pending', 'active', 'paused'];
const terminalStatuses = ['completed', 'withdrawn', 'cancelled'];

const transitions = {
  pending: ['active', 'cancelled', 'withdrawn'],
  active: ['paused', 'completed', 'withdrawn'],
  paused: ['active', 'cancelled', 'withdrawn'],
  completed: [],
  withdrawn: [],
  cancelled: []
};

function canTransition(from, to) {
  return from === to || Boolean(transitions[from]?.includes(to));
}

function closeOpenHistory(enrollment, endedAt) {
  for (const item of enrollment.levelHistory || []) {
    if (!item.effectiveTo) item.effectiveTo = endedAt;
  }
  for (const item of enrollment.classAssignments || []) {
    if (!item.effectiveTo) item.effectiveTo = endedAt;
    if (item.status === 'active') item.status = 'ended';
  }
  for (const item of enrollment.staffAssignments || []) {
    if (!item.effectiveTo) item.effectiveTo = endedAt;
    if (item.status === 'active') item.status = 'ended';
  }
  enrollment.currentLevelId = null;
  enrollment.currentClassId = null;
}

async function findConflictingEnrollment(Enrollment, { schoolId, childId, programId, excludeId }) {
  const query = { schoolId, childId, programId, status: { $in: ongoingStatuses } };
  if (excludeId) query._id = { $ne: excludeId };
  return Enrollment.findOne(query);
}

module.exports = {
  ongoingStatuses,
  terminalStatuses,
  canTransition,
  closeOpenHistory,
  findConflictingEnrollment
};
