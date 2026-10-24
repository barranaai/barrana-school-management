/**
 * meetingReminderScheduler
 *
 * Sends two reminder notifications for every confirmed meeting:
 *   - 24 hours before startsAt
 *   - 1 hour before startsAt
 *
 * Each kind is recorded in `Meeting.reminderHistory` so we never send a
 * duplicate. The cron runs every 5 minutes; the resolution loss vs
 * exact-time scheduling is acceptable for a parent-teacher meeting and
 * keeps the implementation crash-safe (idempotent on restart).
 */

const cron = require('node-cron');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const firebaseService = require('../services/firebaseService');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;
const { safeError } = loggerUtils;
const { scheduleNonOverlapping } = require('../utils/schedulerExecutionGuard');

const REMINDER_WINDOW_24H_MS = { startsBefore: 25 * 60 * 60 * 1000, endsBefore: 23 * 60 * 60 * 1000 };
const REMINDER_WINDOW_1H_MS = { startsBefore: 75 * 60 * 1000, endsBefore: 45 * 60 * 1000 };

const logMeetingReminderFailure = (message, error, code, operationLogger = logger) => {
  operationLogger.warn(message, safeError(error, code));
};

async function dispatchInApp(user, payload) {
  try {
    user.notifications = user.notifications || [];
    user.notifications.push({
      id: `meeting_reminder_${payload.data.meetingId}_${Date.now()}`,
      type: 'general',
      title: payload.title,
      message: payload.message,
      data: payload.data,
      isRead: false,
      createdAt: new Date(),
    });
    await user.save();
  } catch (err) {
    logMeetingReminderFailure('Meeting reminder in-app save failed', err, 'MEETING_REMINDER_SAVE_FAILED');
  }

  if (firebaseService.isFirebaseInitialized?.() && user.fcmTokens?.length) {
    try {
      await firebaseService.sendNotificationToUser(
        user,
        { title: payload.title, body: payload.message, type: 'general', priority: 'high' },
        Object.fromEntries(
          Object.entries(payload.data).map(([k, v]) => [k, v == null ? '' : String(v)])
        )
      );
    } catch (err) {
      logMeetingReminderFailure('Meeting reminder push failed', err, 'MEETING_REMINDER_PUSH_FAILED');
    }
  }
}

async function findDueMeetings(kind) {
  const now = Date.now();
  const w = kind === '24h' ? REMINDER_WINDOW_24H_MS : REMINDER_WINDOW_1H_MS;
  const startMin = new Date(now + w.endsBefore);
  const startMax = new Date(now + w.startsBefore);
  return Meeting.find({
    status: 'confirmed',
    startsAt: { $gte: startMin, $lte: startMax },
    'reminderHistory.type': { $ne: kind },
  })
    .populate('teacherId', 'firstName lastName email fcmTokens notifications')
    .populate('parentId', 'firstName lastName email fcmTokens notifications')
    .populate('studentId', 'firstName lastName');
}

async function processReminderKind(kind) {
  const meetings = await findDueMeetings(kind);
  if (meetings.length === 0) return 0;

  const titlePrefix = kind === '24h' ? 'Tomorrow' : 'In 1 hour';

  let processed = 0;
  for (const meeting of meetings) {
    try {
      const studentName = meeting.studentId
        ? `${meeting.studentId.firstName} ${meeting.studentId.lastName}`
        : 'your child';
      const when = new Date(meeting.startsAt).toLocaleString();
      const teacher = meeting.teacherId;
      const parent = meeting.parentId;

      // Re-fetch as full Mongoose docs so .save() works on notifications
      const teacherDoc = teacher ? await User.findById(teacher._id) : null;
      const parentDoc = parent ? await User.findById(parent._id) : null;

      const payloadFor = (recipient, otherName) => ({
        title: `📅 ${titlePrefix}: meeting with ${otherName}`,
        message: `Meeting about ${studentName} at ${when}.`,
        data: {
          meetingId: meeting._id.toString(),
          meetingNumber: meeting.meetingNumber,
        },
      });

      if (teacherDoc && parent) {
        await dispatchInApp(
          teacherDoc,
          payloadFor(teacherDoc, `${parent.firstName} ${parent.lastName}`)
        );
      }
      if (parentDoc && teacher) {
        await dispatchInApp(
          parentDoc,
          payloadFor(parentDoc, `${teacher.firstName} ${teacher.lastName}`)
        );
      }

      meeting.reminderHistory.push({ type: kind, sentAt: new Date(), deliveryStatus: 'sent' });
      await meeting.save();
      processed += 1;
    } catch (err) {
      logMeetingReminderFailure('Meeting reminder processing failed', err, 'MEETING_REMINDER_PROCESSING_FAILED');
    }
  }
  return processed;
}

function initializeMeetingReminderScheduler() {
  // Run every 5 minutes — reminder windows are wider than 5 minutes,
  // The process-local scheduler guard prevents overlapping runs in this
  // worker. Database-level idempotency remains responsible for restart safety.
  scheduleNonOverlapping(cron, '*/5 * * * *', 'meeting-reminders', async () => {
    try {
      const t1 = await processReminderKind('24h');
      const t2 = await processReminderKind('1h');
      if (t1 + t2 > 0) {
        logger.info(`Meeting reminders: 24h=${t1}, 1h=${t2}`);
      }
    } catch (err) {
      logger.error('Meeting reminder cron failed', safeError(err, 'MEETING_REMINDER_SCHEDULE_FAILED'));
    }
  });
  logger.info('Meeting reminder scheduler initialized (every 5 minutes)');
}

module.exports = {
  initializeMeetingReminderScheduler,
  processReminderKind,
  logMeetingReminderFailure,
};
