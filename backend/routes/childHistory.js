const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { canAccessStudent, scopeSchoolId } = require('../middleware/resourceAuthorization');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const Progress = require('../models/Progress');
const Report = require('../models/Report');
const { logger } = require('../utils/logger');
const School = require('../models/School');
const { buildParticipantHistoryExport } = require('../services/participantHistoryExport');

const router = express.Router();
const validId = value => mongoose.Types.ObjectId.isValid(value);
const id = value => value ? String(value._id || value) : null;
const named = value => value ? { id: id(value), name: value.name || null } : null;
const dated = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;

const event = (type, date, title, description, details = {}) => ({
  type,
  date: dated(date),
  title,
  description,
  details
});

router.get('/:childId/export', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = scopeSchoolId(req.user, req.query.schoolId);
    if (!validId(schoolId)) return res.status(400).json({ success: false, message: 'An organization must be selected' });
    if (!validId(req.params.childId)) return res.status(404).json({ success: false, message: 'Participant not found' });
    const [child, organization] = await Promise.all([
      User.findOne({ _id: req.params.childId, schoolId, role: 'student' }).select('_id firstName lastName studentId dateOfBirth enrollmentDate isActive'),
      School.findOne({ _id: schoolId }).select('_id name')
    ]);
    if (!child || !organization) return res.status(404).json({ success: false, message: 'Participant not found' });
    const document = await buildParticipantHistoryExport(child, schoolId, organization);
    const safeName = `${child.firstName || 'participant'}-${child.lastName || 'history'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'participant'}-history.json"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(JSON.stringify(document, null, 2));
  } catch (error) {
    logger.error('Unable to export participant history', { error: error.message, userId: req.user?._id });
    return res.status(500).json({ success: false, message: 'Unable to export participant history' });
  }
});

router.get('/:childId', protect, authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const schoolId = scopeSchoolId(req.user, req.query.schoolId);
    if (!validId(schoolId)) {
      return res.status(400).json({ success: false, message: 'An organization must be selected' });
    }
    if (!validId(req.params.childId)) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    const child = await User.findOne({ _id: req.params.childId, schoolId, role: 'student' })
      .select('_id firstName lastName studentId studentGrade isActive assignedTeacher classId');
    if (!child || !await canAccessStudent(req.user, child)) {
      return res.status(404).json({ success: false, message: 'Participant not found' });
    }

    const enrollments = await Enrollment.find({ schoolId, childId: child._id })
      .populate('programId', 'name')
      .populate('currentLevelId', 'name')
      .populate('currentClassId', 'name')
      .populate('levelHistory.levelId', 'name')
      .populate('classAssignments.classId', 'name')
      .sort({ startDate: -1, createdAt: -1 });

    const participationQuery = { schoolId, childId: child._id };
    let participations = await ChildParticipation.find(participationQuery).sort({ createdAt: -1 });
    const sessionIds = participations.map(row => row.deliveredSessionId);
    const sessionQuery = { _id: { $in: sessionIds }, schoolId };
    if (req.user.role === 'teacher') sessionQuery.deliveredBy = req.user._id;
    const sessions = await DeliveredSession.find(sessionQuery)
      .populate('programId', 'name')
      .populate('levelId', 'name')
      .populate('classId', 'name')
      .populate('deliveredBy', 'firstName lastName')
      .sort({ scheduledAt: -1 });
    const allowedSessionIds = new Set(sessions.map(row => id(row)));
    participations = participations.filter(row => allowedSessionIds.has(id(row.deliveredSessionId)));

    const participationIds = participations.map(row => row._id);
    const progressRows = await Progress.find({ schoolId, childParticipationId: { $in: participationIds } })
      .sort({ createdAt: -1 });
    const reportQuery = { schoolId, studentId: child._id };
    if (req.user.role === 'teacher') reportQuery.teacherId = req.user._id;
    const reports = await Report.find(reportQuery)
      .select('_id title reportType reportPeriod status finalizedSnapshot approvals teacherId templateId createdAt updatedAt')
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name')
      .sort({ createdAt: -1 });

    const events = [];
    for (const enrollment of enrollments) {
      const program = named(enrollment.programId);
      events.push(event('enrollment', enrollment.startDate || enrollment.createdAt,
        'Enrollment started', program?.name || 'Program enrollment', {
          enrollmentId: id(enrollment), program, level: named(enrollment.currentLevelId),
          group: named(enrollment.currentClassId), status: enrollment.status,
          startDate: dated(enrollment.startDate), endDate: dated(enrollment.endDate)
        }));
      for (const change of enrollment.statusHistory || []) {
        events.push(event('enrollment_status', change.changedAt, 'Enrollment status changed',
          `Status: ${String(change.status).replace(/_/g, ' ')}`, {
            enrollmentId: id(enrollment), program, status: change.status, reason: change.reason || null
          }));
      }
      for (const change of enrollment.levelHistory || []) {
        const level = named(change.levelId);
        events.push(event('level', change.effectiveFrom, 'Level assignment', level?.name || 'Level changed', {
          enrollmentId: id(enrollment), program, level, effectiveFrom: dated(change.effectiveFrom),
          effectiveTo: dated(change.effectiveTo), reason: change.reason || null
        }));
      }
      for (const change of enrollment.classAssignments || []) {
        const group = named(change.classId);
        events.push(event('group', change.effectiveFrom, 'Group assignment', group?.name || 'Group changed', {
          enrollmentId: id(enrollment), program, group, status: change.status,
          effectiveFrom: dated(change.effectiveFrom), effectiveTo: dated(change.effectiveTo), reason: change.reason || null
        }));
      }
    }

    const participationBySession = new Map(participations.map(row => [id(row.deliveredSessionId), row]));
    const sessionById = new Map(sessions.map(row => [id(row), row]));
    for (const session of sessions) {
      const participation = participationBySession.get(id(session));
      const instructor = session.deliveredBy ? {
        id: id(session.deliveredBy),
        name: [session.deliveredBy.firstName, session.deliveredBy.lastName].filter(Boolean).join(' ') || null
      } : null;
      events.push(event('session', session.deliveredAt || session.scheduledAt, 'Delivered session', session.title, {
        deliveredSessionId: id(session), participationId: id(participation),
        program: named(session.programId), level: named(session.levelId), group: named(session.classId),
        instructor, sessionStatus: session.status, participationStatus: participation?.status || null,
        scheduledAt: dated(session.scheduledAt), deliveredAt: dated(session.deliveredAt)
      }));
    }

    const participationById = new Map(participations.map(row => [id(row), row]));
    for (const progress of progressRows) {
      const participation = participationById.get(id(progress.childParticipationId));
      const session = participation && sessionById.get(id(participation.deliveredSessionId));
      events.push(event('progress', progress.updatedAt || progress.createdAt, 'Progress recorded',
        session?.title || 'Session progress', {
          progressId: id(progress), participationId: id(participation), deliveredSessionId: id(session),
          overallStatus: progress.overallStatus || null,
          objectiveResults: progress.objectiveResults || [], parameterResults: progress.parameterResults || [],
          observations: progress.observations || null, recommendations: progress.recommendations || null
        }));
    }

    for (const report of reports) {
      const finalizedAt = report.finalizedSnapshot?.finalizedAt;
      const approval = [...(report.approvals || [])].reverse().find(item => item.status === 'approved');
      events.push(event('report', finalizedAt || report.reportPeriod?.endDate || report.updatedAt || report.createdAt,
        'Report', report.title, {
          reportId: id(report), reportType: report.reportType, status: report.status,
          template: named(report.templateId), periodStart: dated(report.reportPeriod?.startDate),
          periodEnd: dated(report.reportPeriod?.endDate), finalizedAt: dated(finalizedAt),
          approvedAt: dated(approval?.approvedAt),
          instructor: report.teacherId ? {
            id: id(report.teacherId),
            name: [report.teacherId.firstName, report.teacherId.lastName].filter(Boolean).join(' ') || null
          } : null
        }));
    }

    events.sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
    const currentEnrollments = enrollments
      .filter(row => ['pending', 'active', 'paused'].includes(row.status))
      .map(row => ({
        enrollmentId: id(row), program: named(row.programId), level: named(row.currentLevelId),
        group: named(row.currentClassId), status: row.status, startDate: dated(row.startDate)
      }));

    return res.json({
      success: true,
      data: {
        child: {
          id: id(child), firstName: child.firstName, lastName: child.lastName,
          participantId: child.studentId || null, legacyGrade: child.studentGrade || null,
          isActive: child.isActive !== false
        },
        currentEnrollments,
        events
      }
    });
  } catch (error) {
    logger.error('Unable to load child history', { error: error.message, userId: req.user?._id });
    return res.status(500).json({ success: false, message: 'Unable to load participant history' });
  }
});

module.exports = router;
