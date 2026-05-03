/**
 * /api/meetings — booked parent-teacher meetings
 *
 * Auto-book workflow:
 *   1. Parent picks an open slot, supplies a studentId (their child)
 *   2. Server atomically transitions slot.status from 'published' → 'booked'
 *   3. Meeting record is created with denormalized time + format + location
 *   4. Email + in-app + FCM push notifications fire to both teacher and parent
 *
 * Cancel/Reschedule:
 *   - Either party may cancel ≥ 1 hour before startsAt
 *   - Cancelling re-publishes the underlying slot
 *   - Rescheduling = cancel + book new slot, with prev/next links for audit
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Meeting = require('../models/Meeting');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const User = require('../models/User');
const firebaseService = require('../services/firebaseService');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeSchoolId(schoolId) {
  if (!schoolId) return null;
  if (typeof schoolId === 'string') return schoolId;
  if (schoolId._id) return schoolId._id.toString();
  return schoolId.toString();
}

const POPULATE = [
  { path: 'teacherId', select: 'firstName lastName email role photo' },
  { path: 'parentId', select: 'firstName lastName email role photo' },
  {
    path: 'studentId',
    select: 'firstName lastName studentGrade studentClass parentEmail photo',
  },
  { path: 'cancelledBy', select: 'firstName lastName role' },
  { path: 'noShowReportedBy', select: 'firstName lastName' },
];

function isAtLeastOneHourBefore(startsAt) {
  const ms = new Date(startsAt).getTime() - Date.now();
  return ms >= 60 * 60 * 1000;
}

/** Minimum lead time for booking. Parents can't book slots starting in <30 min. */
function isAtLeastBookingLeadTime(startsAt) {
  const ms = new Date(startsAt).getTime() - Date.now();
  return ms >= 30 * 60 * 1000;
}

function userLabel(u) {
  if (!u) return '';
  return `${u.firstName || ''} ${u.lastName || ''}`.trim();
}

/**
 * Push an in-app notification onto a user and best-effort FCM. Mirrors
 * the pattern used by /api/incidents and /api/reports.
 */
async function pushNotification(user, { title, message, type = 'general', data = {} }) {
  try {
    user.notifications = user.notifications || [];
    user.notifications.push({
      id: `meeting_${data.meetingId || ''}_${Date.now()}`,
      type,
      title,
      message,
      data,
      isRead: false,
      createdAt: new Date(),
    });
    await user.save();
  } catch (err) {
    logger.warn('In-app notification save failed:', err.message);
  }

  if (firebaseService.isFirebaseInitialized?.() && user.fcmTokens?.length) {
    try {
      await firebaseService.sendNotificationToUser(
        user,
        { title, body: message, type, priority: 'high' },
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v == null ? '' : String(v)])
        )
      );
    } catch (err) {
      logger.warn('FCM notification failed:', err.message);
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────

/**
 * GET /api/meetings
 * Query: ?status, ?from, ?to, ?teacherId, ?parentId, ?upcoming=true
 */
router.get('/', protect, async (req, res) => {
  try {
    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const query = {};

    switch (req.user.role) {
      case 'super_admin':
        if (req.query.schoolId) query.schoolId = req.query.schoolId;
        break;
      case 'school_admin':
        query.schoolId = requesterSchoolId;
        break;
      case 'teacher':
        query.schoolId = requesterSchoolId;
        query.teacherId = req.user._id;
        break;
      case 'parent':
        query.schoolId = requesterSchoolId;
        query.parentId = req.user._id;
        break;
      default:
        return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (req.query.status) query.status = req.query.status;
    if (req.query.teacherId && ['school_admin', 'super_admin'].includes(req.user.role)) {
      query.teacherId = req.query.teacherId;
    }
    if (req.query.parentId && ['school_admin', 'super_admin'].includes(req.user.role)) {
      query.parentId = req.query.parentId;
    }
    if (req.query.upcoming === 'true') {
      query.startsAt = { $gte: new Date() };
      query.status = query.status || 'confirmed';
    }
    if (req.query.from || req.query.to) {
      query.startsAt = query.startsAt || {};
      if (req.query.from) query.startsAt.$gte = new Date(req.query.from);
      if (req.query.to) query.startsAt.$lte = new Date(req.query.to);
    }

    const meetings = await Meeting.find(query)
      .populate(POPULATE)
      .sort({ startsAt: req.query.upcoming === 'true' ? 1 : -1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: meetings });
  } catch (err) {
    logger.error('List meetings error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/meetings/stats
 * Aggregates for the admin meetings dashboard. School-scoped.
 */
router.get(
  '/stats',
  protect,
  authorize('school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const schoolId = normalizeSchoolId(req.user.schoolId);
      const now = new Date();
      const in30 = new Date();
      in30.setDate(in30.getDate() + 30);

      const [total, upcoming, cancelled, completed, noShow] = await Promise.all([
        Meeting.countDocuments({ schoolId }),
        Meeting.countDocuments({ schoolId, status: 'confirmed', startsAt: { $gte: now, $lte: in30 } }),
        Meeting.countDocuments({ schoolId, status: 'cancelled' }),
        Meeting.countDocuments({ schoolId, status: 'completed' }),
        Meeting.countDocuments({ schoolId, status: 'no_show' }),
      ]);

      res.json({
        success: true,
        data: { total, upcoming30Days: upcoming, cancelled, completed, noShow },
      });
    } catch (err) {
      logger.error('Meeting stats error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/meetings/:id
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate(POPULATE);
    if (!meeting) return res.status(404).json({ success: false, error: 'Not found' });

    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const meetingSchoolId = normalizeSchoolId(meeting.schoolId);
    if (req.user.role !== 'super_admin' && requesterSchoolId !== meetingSchoolId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (req.user.role === 'teacher' && meeting.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (req.user.role === 'parent' && meeting.parentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    res.json({ success: true, data: meeting });
  } catch (err) {
    logger.error('Get meeting error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/meetings
 * Body: { slotId, studentId, bookingMessage? }
 * Atomically books the slot. Idempotent within a slot — once booked, future
 * attempts return 409.
 */
router.post('/', protect, authorize('parent'), async (req, res) => {
  try {
    const { slotId, studentId, bookingMessage } = req.body;
    if (!slotId || !studentId) {
      return res.status(400).json({ success: false, error: 'slotId and studentId are required.' });
    }

    // Verify slot is still publishable
    const slot = await AvailabilitySlot.findById(slotId);
    if (!slot) return res.status(404).json({ success: false, error: 'Slot not found' });
    if (slot.status !== 'published') {
      return res.status(409).json({ success: false, error: 'Slot is no longer available.' });
    }
    if (!isAtLeastBookingLeadTime(slot.startsAt)) {
      return res.status(409).json({
        success: false,
        error: 'lead_time',
        message: 'You can only book slots that start in 30 minutes or more.',
      });
    }

    // Verify the student exists, belongs to the parent (parentEmail match)
    // and is in the same school as the slot.
    const student = await User.findById(studentId).select(
      'role parentEmail schoolId firstName lastName'
    );
    if (!student || student.role !== 'student') {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    if ((student.parentEmail || '').toLowerCase() !== (req.user.email || '').toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Student is not yours.' });
    }
    if (normalizeSchoolId(student.schoolId) !== normalizeSchoolId(slot.schoolId)) {
      return res.status(400).json({ success: false, error: 'Student and slot are in different schools.' });
    }

    // Atomic transition: only flip if still 'published'
    const lockedSlot = await AvailabilitySlot.findOneAndUpdate(
      { _id: slotId, status: 'published' },
      { $set: { status: 'booked' } },
      { new: true }
    );
    if (!lockedSlot) {
      return res.status(409).json({ success: false, error: 'Slot just got booked by someone else.' });
    }

    let meeting;
    try {
      meeting = await Meeting.create({
        schoolId: lockedSlot.schoolId,
        teacherId: lockedSlot.teacherId,
        parentId: req.user._id,
        studentId,
        slotId: lockedSlot._id,
        startsAt: lockedSlot.startsAt,
        endsAt: lockedSlot.endsAt,
        location: lockedSlot.location,
        meetingUrl: lockedSlot.meetingUrl,
        format: lockedSlot.format,
        bookingMessage,
      });
      lockedSlot.meetingId = meeting._id;
      await lockedSlot.save();
    } catch (err) {
      // Roll back the slot if Meeting.create fails for any reason
      lockedSlot.status = 'published';
      lockedSlot.meetingId = undefined;
      await lockedSlot.save();
      throw err;
    }

    await meeting.populate(POPULATE);

    // Notifications — fire in the background, don't block the response
    setImmediate(async () => {
      try {
        const teacher = await User.findById(meeting.teacherId._id);
        const parent = await User.findById(meeting.parentId._id);
        const studentName = `${meeting.studentId.firstName} ${meeting.studentId.lastName}`;
        const when = new Date(meeting.startsAt).toLocaleString();
        if (teacher) {
          await pushNotification(teacher, {
            title: '📅 New meeting booked',
            message: `${userLabel(meeting.parentId)} booked a meeting about ${studentName} for ${when}.`,
            type: 'general',
            data: { meetingId: meeting._id, meetingNumber: meeting.meetingNumber },
          });
        }
        if (parent) {
          await pushNotification(parent, {
            title: '✅ Meeting confirmed',
            message: `Your meeting with ${userLabel(meeting.teacherId)} about ${studentName} is set for ${when}.`,
            type: 'general',
            data: { meetingId: meeting._id, meetingNumber: meeting.meetingNumber },
          });
        }
      } catch (err) {
        logger.warn('Booking notify failed:', err.message);
      }
    });

    res.status(201).json({ success: true, data: meeting });
  } catch (err) {
    logger.error('Book meeting error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/meetings/:id/cancel
 * Body: { reason? }
 * Either teacher or parent can cancel ≥ 1 hour before start.
 */
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, error: 'Not found' });

    const requesterId = req.user._id.toString();
    const isTeacher = meeting.teacherId.toString() === requesterId;
    const isParent = meeting.parentId.toString() === requesterId;
    const isAdmin = ['school_admin', 'super_admin'].includes(req.user.role);
    if (!isTeacher && !isParent && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (meeting.status !== 'confirmed') {
      return res.status(409).json({ success: false, error: 'Meeting is not in a cancellable state.' });
    }
    if (!isAdmin && !isAtLeastOneHourBefore(meeting.startsAt)) {
      return res.status(409).json({
        success: false,
        error: 'cancellation_window_closed',
        message: 'Meetings can only be cancelled at least 1 hour before they start.',
      });
    }

    meeting.status = 'cancelled';
    meeting.cancelledBy = req.user._id;
    meeting.cancelledAt = new Date();
    meeting.cancellationReason = req.body.reason;
    await meeting.save();

    // Free the slot (only if it's still pointing at this meeting)
    await AvailabilitySlot.updateOne(
      { _id: meeting.slotId, meetingId: meeting._id },
      { $set: { status: 'published' }, $unset: { meetingId: '' } }
    );

    await meeting.populate(POPULATE);

    setImmediate(async () => {
      try {
        const teacher = await User.findById(meeting.teacherId._id);
        const parent = await User.findById(meeting.parentId._id);
        const cancellerName = userLabel(req.user);
        const studentName = `${meeting.studentId.firstName} ${meeting.studentId.lastName}`;
        const when = new Date(meeting.startsAt).toLocaleString();
        const targets = [teacher, parent].filter(
          (u) => u && u._id.toString() !== requesterId
        );
        for (const t of targets) {
          await pushNotification(t, {
            title: '❌ Meeting cancelled',
            message: `${cancellerName} cancelled the meeting about ${studentName} (${when}).`,
            type: 'alert',
            data: { meetingId: meeting._id, meetingNumber: meeting.meetingNumber },
          });
        }
      } catch (err) {
        logger.warn('Cancel notify failed:', err.message);
      }
    });

    res.json({ success: true, data: meeting });
  } catch (err) {
    logger.error('Cancel meeting error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/meetings/:id/reschedule
 * Body: { newSlotId }
 * Teacher or parent can reschedule ≥ 1 hour before start. Internally:
 *   - cancels the current meeting (frees old slot)
 *   - books the new slot
 *   - links rescheduledFromMeetingId / rescheduledToMeetingId
 */
router.post('/:id/reschedule', protect, async (req, res) => {
  try {
    const { newSlotId } = req.body;
    if (!newSlotId) return res.status(400).json({ success: false, error: 'newSlotId is required.' });

    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, error: 'Not found' });

    const requesterId = req.user._id.toString();
    const isTeacher = meeting.teacherId.toString() === requesterId;
    const isParent = meeting.parentId.toString() === requesterId;
    const isAdmin = ['school_admin', 'super_admin'].includes(req.user.role);
    if (!isTeacher && !isParent && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (meeting.status !== 'confirmed') {
      return res.status(409).json({ success: false, error: 'Meeting is not in a reschedulable state.' });
    }
    if (!isAdmin && !isAtLeastOneHourBefore(meeting.startsAt)) {
      return res.status(409).json({
        success: false,
        error: 'reschedule_window_closed',
        message: 'Meetings can only be rescheduled at least 1 hour before they start.',
      });
    }

    // Atomic flip on new slot
    const lockedSlot = await AvailabilitySlot.findOneAndUpdate(
      { _id: newSlotId, status: 'published' },
      { $set: { status: 'booked' } },
      { new: true }
    );
    if (!lockedSlot) {
      return res.status(409).json({ success: false, error: 'New slot is not available.' });
    }
    if (normalizeSchoolId(lockedSlot.schoolId) !== normalizeSchoolId(meeting.schoolId)) {
      // unwind
      lockedSlot.status = 'published';
      await lockedSlot.save();
      return res.status(400).json({ success: false, error: 'New slot is in a different school.' });
    }

    // Free the old slot
    await AvailabilitySlot.updateOne(
      { _id: meeting.slotId, meetingId: meeting._id },
      { $set: { status: 'published' }, $unset: { meetingId: '' } }
    );

    // Mark the old meeting as rescheduled
    meeting.status = 'rescheduled';
    await meeting.save();

    // Create the new meeting
    const newMeeting = await Meeting.create({
      schoolId: meeting.schoolId,
      teacherId: meeting.teacherId,
      parentId: meeting.parentId,
      studentId: meeting.studentId,
      slotId: lockedSlot._id,
      startsAt: lockedSlot.startsAt,
      endsAt: lockedSlot.endsAt,
      location: lockedSlot.location,
      meetingUrl: lockedSlot.meetingUrl,
      format: lockedSlot.format,
      rescheduledFromMeetingId: meeting._id,
    });

    meeting.rescheduledToMeetingId = newMeeting._id;
    await meeting.save();
    lockedSlot.meetingId = newMeeting._id;
    await lockedSlot.save();
    await newMeeting.populate(POPULATE);

    setImmediate(async () => {
      try {
        const teacher = await User.findById(newMeeting.teacherId._id);
        const parent = await User.findById(newMeeting.parentId._id);
        const reschedulerName = userLabel(req.user);
        const when = new Date(newMeeting.startsAt).toLocaleString();
        const targets = [teacher, parent].filter(
          (u) => u && u._id.toString() !== requesterId
        );
        for (const t of targets) {
          await pushNotification(t, {
            title: '🔄 Meeting rescheduled',
            message: `${reschedulerName} rescheduled the meeting to ${when}.`,
            type: 'general',
            data: { meetingId: newMeeting._id, meetingNumber: newMeeting.meetingNumber },
          });
        }
      } catch (err) {
        logger.warn('Reschedule notify failed:', err.message);
      }
    });

    res.json({ success: true, data: newMeeting });
  } catch (err) {
    logger.error('Reschedule meeting error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/meetings/:id/complete
 * Body: { teacherNotes? }
 */
router.post('/:id/complete', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, error: 'Not found' });
    if (meeting.status !== 'confirmed') {
      return res.status(409).json({ success: false, error: 'Meeting is not in a completable state.' });
    }
    if (req.user.role === 'teacher' && meeting.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    meeting.status = 'completed';
    meeting.completedAt = new Date();
    if (req.body.teacherNotes) meeting.teacherNotes = req.body.teacherNotes;
    await meeting.save();
    await meeting.populate(POPULATE);
    res.json({ success: true, data: meeting });
  } catch (err) {
    logger.error('Complete meeting error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/meetings/:id/no-show
 * Body: { reason? }
 */
router.post('/:id/no-show', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ success: false, error: 'Not found' });
    if (meeting.status !== 'confirmed') {
      return res.status(409).json({ success: false, error: 'Meeting is not in a no-show state.' });
    }
    if (req.user.role === 'teacher' && meeting.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    meeting.status = 'no_show';
    meeting.noShowAt = new Date();
    meeting.noShowReportedBy = req.user._id;
    if (req.body.reason) meeting.cancellationReason = req.body.reason;
    await meeting.save();
    await meeting.populate(POPULATE);
    res.json({ success: true, data: meeting });
  } catch (err) {
    logger.error('No-show meeting error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
