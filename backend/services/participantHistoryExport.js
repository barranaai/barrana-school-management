const Enrollment = require('../models/Enrollment');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const Progress = require('../models/Progress');
const Report = require('../models/Report');

const id = value => value ? String(value._id || value) : null;
const iso = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
const named = value => value ? { id: id(value), name: value.name || null } : null;
const person = value => value ? { id: id(value), name: [value.firstName, value.lastName].filter(Boolean).join(' ') || null } : null;
const objective = value => ({ objectiveId: id(value.objectiveId), title: value.title || null, expectedOutcome: value.expectedOutcome || null, status: value.status });
const parameter = value => ({ parameterId: id(value.parameterId), requirement: value.requirementLabel || null, parameter: value.parameterLabel || null, type: value.type, value: value.value });

async function buildParticipantHistoryExport(child, schoolId, organization) {
  const enrollments = await Enrollment.find({ schoolId, childId: child._id })
    .populate('programId', 'name').populate('currentLevelId', 'name').populate('currentClassId', 'name')
    .populate('levelHistory.levelId', 'name').populate('classAssignments.classId', 'name')
    .populate('statusHistory.changedBy', 'firstName lastName').populate('levelHistory.changedBy', 'firstName lastName')
    .populate('classAssignments.assignedBy', 'firstName lastName').populate('staffAssignments.staffId', 'firstName lastName')
    .sort({ startDate: 1, createdAt: 1 });
  const participations = await ChildParticipation.find({ schoolId, childId: child._id }).sort({ createdAt: 1 });
  const sessions = await DeliveredSession.find({ schoolId, _id: { $in: participations.map(row => row.deliveredSessionId) } })
    .populate('programId', 'name').populate('levelId', 'name').populate('classId', 'name')
    .populate('deliveredBy', 'firstName lastName').sort({ scheduledAt: 1 });
  const participationById = new Map(participations.map(row => [id(row), row]));
  const sessionById = new Map(sessions.map(row => [id(row), row]));
  const progressRows = await Progress.find({ schoolId, childParticipationId: { $in: participations.map(row => row._id) } })
    .populate('createdBy', 'firstName lastName').populate('updatedBy', 'firstName lastName')
    .populate('revisions.originallySavedBy', 'firstName lastName').populate('revisions.supersededBy', 'firstName lastName')
    .sort({ createdAt: 1 });
  const reports = await Report.find({ schoolId, studentId: child._id, status: { $in: ['approved', 'sent', 'archived'] }, finalizedSnapshot: { $ne: null } })
    .populate('teacherId', 'firstName lastName').sort({ 'finalizedSnapshot.finalizedAt': 1, createdAt: 1 });
  const historyEvents = [
    ...enrollments.map(row => ({ type: 'enrollment', date: iso(row.startDate || row.createdAt), label: named(row.programId)?.name || 'Enrollment', program: named(row.programId), level: named(row.currentLevelId) })),
    ...enrollments.flatMap(row => (row.levelHistory || []).map(change => ({ type: 'level', date: iso(change.effectiveFrom), label: named(change.levelId)?.name || 'Level change', program: named(row.programId), level: named(change.levelId) }))),
    ...participations.map(row => { const session = sessionById.get(id(row.deliveredSessionId)); return ({ type: 'session', date: iso(session?.deliveredAt || session?.scheduledAt || row.createdAt), label: session?.title || 'Session record unavailable', attendanceStatus: row.status, program: named(session?.programId), level: named(session?.levelId) }); }),
    ...progressRows.map(row => { const participation = participationById.get(id(row.childParticipationId)); const session = participation && sessionById.get(id(participation.deliveredSessionId)); return ({ type: 'progress', date: iso(session?.deliveredAt || session?.scheduledAt || row.createdAt), label: session?.title || 'Progress', overallStatus: row.overallStatus || null, program: named(session?.programId), level: named(session?.levelId) }); }),
    ...reports.map(row => ({ type: 'report', date: iso(row.finalizedSnapshot?.finalizedAt), label: row.finalizedSnapshot?.reportMetadata?.title || row.title, status: row.status }))
  ].sort((left, right) => new Date(left.date || 0) - new Date(right.date || 0));

  return {
    schema: 'kidsible.participant-history.v1',
    exportedAt: new Date().toISOString(),
    organization: { id: id(organization), name: organization?.name || null },
    participant: {
      id: id(child), participantId: child.studentId || null, firstName: child.firstName,
      lastName: child.lastName, dateOfBirth: iso(child.dateOfBirth), enrollmentDate: iso(child.enrollmentDate),
      activeAtExport: child.isActive !== false
    },
    enrollments: enrollments.map(row => ({
      enrollmentId: id(row), program: named(row.programId), currentLevel: named(row.currentLevelId),
      currentGroup: named(row.currentClassId), status: row.status, startDate: iso(row.startDate), endDate: iso(row.endDate),
      statusHistory: (row.statusHistory || []).map(change => ({ status: change.status, changedAt: iso(change.changedAt), changedBy: person(change.changedBy) })),
      levelHistory: (row.levelHistory || []).map(change => ({ level: named(change.levelId), effectiveFrom: iso(change.effectiveFrom), effectiveTo: iso(change.effectiveTo), changedBy: person(change.changedBy) })),
      groupHistory: (row.classAssignments || []).map(change => ({ group: named(change.classId), effectiveFrom: iso(change.effectiveFrom), effectiveTo: iso(change.effectiveTo), status: change.status, assignedBy: person(change.assignedBy) })),
      staffHistory: (row.staffAssignments || []).map(change => ({ staff: person(change.staffId), role: change.role, effectiveFrom: iso(change.effectiveFrom), effectiveTo: iso(change.effectiveTo), status: change.status, primary: change.primary === true }))
    })),
    sessions: participations.map(participation => {
      const session = sessionById.get(id(participation.deliveredSessionId));
      return { participationId: id(participation), attendanceStatus: participation.status,
        session: session ? { id: id(session), title: session.title, scheduledAt: iso(session.scheduledAt), deliveredAt: iso(session.deliveredAt), status: session.status,
          program: named(session.programId), level: named(session.levelId), group: named(session.classId), deliveredBy: person(session.deliveredBy) } : null };
    }),
    progress: progressRows.map(row => {
      const participation = participationById.get(id(row.childParticipationId));
      const session = participation && sessionById.get(id(participation.deliveredSessionId));
      return { progressId: id(row), participationId: id(participation), sessionId: id(session),
        program: named(session?.programId), level: named(session?.levelId), sessionDate: iso(session?.deliveredAt || session?.scheduledAt),
        overallStatus: row.overallStatus || null, objectiveResults: (row.objectiveResults || []).map(objective), parameterResults: (row.parameterResults || []).map(parameter),
        revisionNumber: row.revisionNumber || 1, recordedBy: person(row.createdBy), lastUpdatedBy: person(row.updatedBy), recordedAt: iso(row.createdAt), updatedAt: iso(row.updatedAt),
        revisions: (row.revisions || []).map(revision => ({ revisionNumber: revision.revisionNumber, objectiveResults: (revision.objectiveResults || []).map(objective), parameterResults: (revision.parameterResults || []).map(parameter),
          originallySavedBy: person(revision.originallySavedBy), originallySavedAt: iso(revision.originallySavedAt), supersededBy: person(revision.supersededBy), supersededAt: iso(revision.supersededAt) })) };
    }),
    finalizedReports: reports.map(report => ({
      reportId: id(report), title: report.finalizedSnapshot?.reportMetadata?.title || report.title,
      reportType: report.finalizedSnapshot?.reportMetadata?.reportType || report.reportType,
      reportPeriod: { startDate: iso(report.finalizedSnapshot?.reportMetadata?.reportPeriod?.startDate || report.reportPeriod?.startDate), endDate: iso(report.finalizedSnapshot?.reportMetadata?.reportPeriod?.endDate || report.reportPeriod?.endDate) },
      status: report.status, finalizedAt: iso(report.finalizedSnapshot?.finalizedAt), instructor: person(report.teacherId),
      deliveredSessionId: id(report.deliveredSessionId), program: named(sessionById.get(id(report.deliveredSessionId))?.programId), level: named(sessionById.get(id(report.deliveredSessionId))?.levelId),
      parentVisibleContent: report.finalizedSnapshot?.parentVisibleContent ?? report.finalizedSnapshot?.reportContent ?? null,
      customFieldValues: report.finalizedSnapshot?.customFieldValues || {}
    })),
    history: { events: historyEvents }
  };
}

module.exports = { buildParticipantHistoryExport };
