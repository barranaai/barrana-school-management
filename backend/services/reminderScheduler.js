const cron = require('node-cron');
const path = require('path');
const Event = require('../models/Event');
const User = require('../models/User');
const { eligibleGuardians } = require('./guardianAccessService');
const { authorizeScheduledMessageDelivery } = require('./guardianCommunicationService');

async function guardiansFor(students) {
  const guardians = (await Promise.all(students.map(student => eligibleGuardians(student._id, 'communication')))).flat();
  return [...new Map(guardians.map(user => [String(user._id), user])).values()];
}
const ParentGroup = require('../models/ParentGroup');
const Message = require('../models/Message');
const Report = require('../models/Report');
const ReportTemplate = require('../models/ReportTemplate');
const School = require('../models/School');
const { logger, safeError } = require('../utils/logger');
const { scheduleNonOverlapping } = require('../utils/schedulerExecutionGuard');
const { sendEventReminder } = require('./notificationService');
const { cleanupOldPDFs } = require('./pdfService');
const { getCurrentDateInTimezone, isReportDue, calculateDueDate, getStartOfFrequencyPeriod } = require('../utils/dateUtils');
const firebaseService = require('./firebaseService');
const { getIO } = require('./socketService');

function pushOutcome(result) {
  if (result?.skipped === true || ['firebase_not_initialized', 'no_tokens'].includes(result?.reason)) return 'skipped';
  const hasBatchCounts = Number.isFinite(result?.successCount) && Number.isFinite(result?.failureCount);
  if (hasBatchCounts) {
    if (result.successCount > 0 && result.failureCount > 0) return 'partial';
    if (result.successCount > 0 && result.failureCount === 0) return 'accepted';
    return 'failed';
  }
  if (result?.success === true) return 'accepted';
  return 'failed';
}

function logPushOutcome(eventName, result, operationLogger = logger) {
  const status = pushOutcome(result);
  const metadata = { channel: 'push', status };
  if (status === 'accepted') operationLogger.info(`${eventName} push notification accepted`, metadata);
  else if (status === 'partial') operationLogger.warn(`${eventName} push notification partially accepted`, { ...metadata, code: 'PUSH_DELIVERY_PARTIAL' });
  else if (status === 'skipped') operationLogger.warn(`${eventName} push notification skipped`, metadata);
  else operationLogger.warn(`${eventName} push notification failed`, { ...metadata, code: 'PUSH_DELIVERY_FAILED' });
  return status;
}

function logEventReminderStart(reminderType, operationLogger = logger) {
  operationLogger.info('Event reminder delivery started', { reminderType });
}

function logDueReportTeacherFailure(error, operationLogger = logger) {
  operationLogger.error('Due-report teacher processing failed', safeError(error, 'DUE_REPORT_TEACHER_PROCESSING_FAILED'));
}

async function sendDueReportPush(teacher, notification, data, dependencies = {}) {
  const firebase = dependencies.firebase || firebaseService;
  const operationLogger = dependencies.logger || logger;
  if (!teacher?.fcmTokens?.length) {
    const result = { success: true, skipped: true, reason: 'no_tokens' };
    return { ...result, status: logPushOutcome('Due-report', result, operationLogger) };
  }
  if (typeof firebase.isFirebaseInitialized !== 'function' || !firebase.isFirebaseInitialized()) {
    const result = { success: false, skipped: true, reason: 'firebase_not_initialized' };
    return { ...result, status: logPushOutcome('Due-report', result, operationLogger) };
  }
  try {
    const result = await firebase.sendNotificationToUser(teacher, notification, data);
    return {
      success: result?.success === true,
      skipped: result?.skipped === true,
      ...(Number.isFinite(result?.successCount) && { successCount: result.successCount }),
      ...(Number.isFinite(result?.failureCount) && { failureCount: result.failureCount }),
      status: logPushOutcome('Due-report', result, operationLogger)
    };
  } catch (_error) {
    const result = { success: false };
    return { ...result, status: logPushOutcome('Due-report', result, operationLogger) };
  }
}

/**
 * Get recipients for an event based on target type
 */
async function getEventRecipients(event) {
  let recipients = [];

  try {
    switch (event.targetType) {
      case 'all':
        recipients = await User.find({
          role: 'parent',
          schoolId: event.schoolId,
          isActive: true
        }).select('firstName lastName email phone phoneNumber preferences');
        
        // Map to standard format
        recipients = recipients.map(user => ({
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phoneNumber || user.phone,
          preferences: user.preferences
        }));
        break;

      case 'grade':
        const studentsInGrade = await User.find({
          role: 'student',
          studentGrade: event.targetGrade,
          schoolId: event.schoolId,
          isActive: true
        }).select('_id');
        const parentUsersForGrade = await guardiansFor(studentsInGrade);
        
        recipients = parentUsersForGrade.map(user => ({
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phoneNumber || user.phone,
          preferences: user.preferences
        }));
        break;

      case 'class':
        const studentsInClass = await User.find({
          role: 'student',
          classId: event.targetClass,
          schoolId: event.schoolId,
          isActive: true
        }).select('_id');
        const parentUsersForClass = await guardiansFor(studentsInClass);
        
        recipients = parentUsersForClass.map(user => ({
          _id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          phone: user.phoneNumber || user.phone,
          preferences: user.preferences
        }));
        break;

      case 'group':
        const group = await ParentGroup.findById(event.targetGroup).populate({
          path: 'members.parentId',
          select: 'firstName lastName email phone phoneNumber preferences'
        });
        if (group) {
          recipients = group.members.map(m => ({
            _id: m.parentId._id,
            name: `${m.parentId.firstName} ${m.parentId.lastName}`,
            email: m.parentId.email,
            phone: m.parentId.phoneNumber || m.parentId.phone,
            preferences: m.parentId.preferences
          }));
        }
        break;
    }

    // Remove duplicates
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.email === recipient.email)
    );

    return uniqueRecipients;
  } catch (error) {
    logger.error('Unable to get event recipients', safeError(error, 'EVENT_RECIPIENT_LOOKUP_FAILED'));
    return [];
  }
}

/**
 * Send reminders for a specific type
 */
async function sendReminders(reminderType) {
  try {
    logger.info(`Checking for ${reminderType} reminders...`);

    // Find all active events
    const events = await Event.find({
      isActive: true,
      isCancelled: false,
      startDate: { $gte: new Date() } // Only future events
    });

    logger.info(`Found ${events.length} active events to check`);

    for (const event of events) {
      // Check if this reminder should be sent
      if (event.shouldSendReminder(reminderType)) {
        logEventReminderStart(reminderType);

        // Get recipients
        const recipients = await getEventRecipients(event);
        
        if (recipients.length === 0) {
          logger.warn('No recipients found for event reminder');
          continue;
        }

        // Send reminders to all recipients
        const reminderPromises = recipients.map(recipient => 
          sendEventReminder(event, recipient, reminderType)
        );

        const results = await Promise.allSettled(reminderPromises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;

        // Update event reminder status
        event.reminders[reminderType].sent = true;
        event.reminders[reminderType].sentAt = new Date();
        event.reminders[reminderType].recipientCount = successCount;
        await event.save();

        logger.info('Event reminder batch completed', { successCount, recipientCount: recipients.length, reminderType });
      }
    }

    logger.info(`Completed ${reminderType} reminder check`);
  } catch (error) {
    logger.error('Event reminder scheduler failed', { reminderType, ...safeError(error, 'REMINDER_SCHEDULER_FAILED') });
  }
}

/**
 * Initialize the reminder scheduler
 */
function initializeReminderScheduler() {
  // Run every hour to check for pending reminders
  // Format: "minute hour day month dayOfWeek"
  scheduleNonOverlapping(cron, '0 * * * *', 'event-reminders', async () => {
    logger.info('Running scheduled reminder check...');
    
    try {
      // Check all reminder types
      await sendReminders('twoDaysBefore');
      await sendReminders('oneDayBefore');
    } catch (error) {
      logger.error('Error in scheduled reminder check:', error);
    }
  });

  logger.info('Reminder scheduler initialized - will run every hour');
}

/**
 * Manual trigger for testing
 */
async function triggerReminderCheck(reminderType = 'all') {
  if (reminderType === 'all') {
    await sendReminders('twoDaysBefore');
    await sendReminders('oneDayBefore');
  } else {
    await sendReminders(reminderType);
  }
}

/**
 * Initialize PDF cleanup scheduler
 * Runs daily at 3 AM to clean up old temporary PDFs
 */
function initializePDFCleanup() {
  // Run daily at 3 AM
  scheduleNonOverlapping(cron, '0 3 * * *', 'pdf-cleanup', async () => {
    try {
      logger.info('Starting scheduled PDF cleanup');
      // Fail closed if retained references cannot be read. Protect historical PDFs too.
      const reports = await Report.find({ status: { $in: ['approved', 'sent', 'archived'] } }).select('pdfUrl pdfPath').lean();
      const retained = reports.flatMap(report => [report.pdfUrl, report.pdfPath]).filter(value => typeof value === 'string').map(value => path.basename(value.replace(/\\/g, '/')));
      const result = await cleanupOldPDFs(7, retained);
      logger.info(`PDF cleanup completed: ${result.deleted} files deleted`);
    } catch (error) {
      logger.error('Error during scheduled PDF cleanup:', error);
    }
  });
  
  logger.info('PDF cleanup scheduler initialized - will run daily at 3 AM');
}

/**
 * Process scheduled messages that are due to be sent
 */
async function processScheduledMessages(dependencies = {}) {
  const operationLogger = dependencies.logger || logger;
  try {
    const now = new Date();
    
    // Find all scheduled messages that are due (scheduledDateTime <= now and not yet sent)
    const scheduledMessages = dependencies.scheduledMessages || await Message.find({
      isScheduled: true,
      scheduledDateTime: { $lte: now },
      sentAt: null // Not yet sent
    }).populate('senderId', 'firstName lastName')
      .populate('recipientId', 'firstName lastName email')
      .populate('conversationId');
    
    if (scheduledMessages.length === 0) {
      return;
    }
    
    logger.info(`Processing ${scheduledMessages.length} scheduled message(s)`);
    
    for (const message of scheduledMessages) {
      try {
        const conversation = message.conversationId;
        const authorizeDelivery = dependencies.authorizeScheduledMessageDelivery || authorizeScheduledMessageDelivery;
        if (!(await authorizeDelivery(message))) {
          logger.warn('Scheduled message blocked because guardian communication access is no longer active');
          continue;
        }
        // Mark message as sent
        message.sentAt = new Date();
        message.isScheduled = false;
        await message.save();
        
        // Update conversation
        if (conversation) {
          await conversation.updateLastMessage(message);
          await conversation.incrementUnread(message.recipientRole);
        }
        
        // Get recipient user for notifications
        const findRecipient = dependencies.findRecipient || (id => User.findById(id));
        const recipientUser = await findRecipient(message.recipientId._id || message.recipientId);
        if (recipientUser) {
          // Create in-app notification
          const notification = {
            type: 'message',
            title: 'New Message',
            message: `You have a new message from ${message.senderName}`,
            data: {
              conversationId: conversation._id.toString(),
              senderId: (message.senderId._id || message.senderId).toString(),
              senderName: message.senderName,
              senderRole: message.senderRole
            },
            isRead: false,
            createdAt: new Date()
          };
          
          recipientUser.notifications.push(notification);
          await recipientUser.save();
          
          logger.info('Scheduled message notification created');
          
          // Send push notification
          try {
            const pushNotification = {
              title: 'New Message',
              body: `You have a new message from ${message.senderName}`,
              icon: 'ic_notification',
              sound: 'default'
            };
            
            const pushData = {
              type: 'message',
              conversationId: conversation._id.toString(),
              senderId: (message.senderId._id || message.senderId).toString(),
              senderName: message.senderName,
              senderRole: message.senderRole
            };
            
            const sendPush = dependencies.sendPush || firebaseService.sendNotificationToUser.bind(firebaseService);
            const pushResult = await sendPush(recipientUser, pushNotification, pushData);
            logPushOutcome('Scheduled message', pushResult, operationLogger);
          } catch (_pushError) {
            logPushOutcome('Scheduled message', { success: false }, operationLogger);
          }
        }
        
        // Emit socket event if socket service is available
        try {
          const socketService = dependencies.socketService || require('./socketService');
          if (socketService.getIO()) {
            socketService.getIO().to(`conversation:${conversation._id}`).emit('new_message', {
              ...message.toObject(),
              sentAt: message.sentAt
            });
          }
        } catch (socketError) {
          logger.error('Error emitting socket event for scheduled message:', socketError);
        }
        
        logger.info('Scheduled message processed successfully');
      } catch (messageError) {
        logger.error('Scheduled message processing failed', safeError(messageError, 'SCHEDULED_MESSAGE_FAILED'));
      }
    }
  } catch (error) {
    logger.error('Error processing scheduled messages:', error);
  }
}

/**
 * Check for due reports and create notifications for teachers
 */
async function checkDueReports() {
  try {
    logger.info('🔔 Checking for due reports...');

    // Get all active teachers
    const teachers = await User.find({ 
      role: 'teacher', 
      isActive: true 
    }).select('_id schoolId firstName lastName fcmTokens notifications');

    if (teachers.length === 0) {
      logger.info('No active teachers found');
      return;
    }

    logger.info(`Found ${teachers.length} active teachers`);
    let totalNotificationsCreated = 0;

    for (const teacher of teachers) {
      try {
        // Get school settings
        const school = await School.findById(teacher.schoolId).select('settings name');
        if (!school) continue;

        const settings = school.settings || {};
        const timezone = settings.timezone || 'UTC';
        const now = getCurrentDateInTimezone(timezone);

        // Find teacher's assigned classes
        const Class = require('../models/Class');
        const teacherClasses = await Class.find({
          'assignedTeachers.teacherId': teacher._id,
          isActive: true
        });

        if (teacherClasses.length === 0) continue;

        // Get students from teacher's classes
        const students = await User.find({
          role: 'student',
          studentClass: { $in: teacherClasses.map(cls => cls.name) },
          schoolId: teacher.schoolId,
          isActive: true
        }).select('firstName lastName studentGrade studentClass');

        if (students.length === 0) continue;

        // Find active templates for this school
        const templates = await ReportTemplate.find({ 
          schoolId: teacher.schoolId, 
          isActive: true 
        }).select('name reportFrequency grade');

        // Check each student x template combination
        for (const student of students) {
          for (const template of templates) {
            try {
              const frequency = template.reportFrequency;
              const studentName = `${student.firstName} ${student.lastName}`;

              // Check if report is due
              const lastReport = await Report.findOne({
                schoolId: teacher.schoolId,
                studentId: student._id,
                templateId: template._id
              }).sort({ createdAt: -1 });

              const lastReportDate = lastReport ? lastReport.createdAt : null;
              const isDue = isReportDue(frequency, settings, lastReportDate, now.toDate());

              if (isDue) {
                // Check if there's already a report for the current period by ANY teacher
                const periodStart = getStartOfFrequencyPeriod(frequency, settings, now.toDate());
                const existingReportInPeriod = await Report.findOne({
                  schoolId: teacher.schoolId,
                  studentId: student._id,
                  templateId: template._id,
                  createdAt: {
                    $gte: periodStart
                  }
                });

                // If a report already exists in this period, skip notification
                if (existingReportInPeriod) {
                  logger.info('Due-report notification skipped because a report already exists');
                  continue;
                }

                // Calculate next due date
                const nextDueResult = calculateDueDate(frequency, settings, now);
                const nextDue = nextDueResult.dueDate;
                const nextDueDayKey = nextDue ? nextDue.clone().startOf('day').toISOString() : now.clone().startOf('day').toISOString();

                // Check for duplicate notification
                const hasDuplicateNotification = (teacher.notifications || []).some(n => {
                  return n.type === 'report' && 
                    n.data && 
                    n.data.studentId === String(student._id) &&
                    n.data.templateId === String(template._id) && 
                    n.data.dueDayKey === nextDueDayKey && 
                    n.isRead === false;
                });

                if (hasDuplicateNotification) continue;

                // Create notification
                const notification = {
                  id: `rep-${student._id}-${template._id}-${Date.now()}`,
                  type: 'report',
                  title: `Report due: ${template.name}`,
                  message: `A ${frequency} report for ${studentName} is due now.`,
                  data: {
                    studentId: String(student._id),
                    studentName,
                    templateId: String(template._id),
                    templateName: template.name,
                    frequency,
                    dueDate: nextDue ? nextDue.toDate() : now.toDate(),
                    dueDateTimezone: timezone,
                    dueDayKey: nextDueDayKey
                  },
                  isRead: false,
                  createdAt: new Date()
                };

                // Add notification to teacher
                await User.updateOne(
                  { _id: teacher._id },
                  { $push: { notifications: notification } }
                );

                totalNotificationsCreated++;

                // Send real-time notification via Socket.io
                try {
                  const io = getIO();
                  if (io) {
                    io.to(`user_${teacher._id}`).emit('notification', notification);
                    logger.info('Due-report real-time notification emitted');
                  }
                } catch (socketError) {
                  logger.error('Error emitting Socket.io notification:', socketError);
                }

                // Send FCM push notification when the worker has credentials and a device token.
                await sendDueReportPush(teacher, {
                  title: `Report due: ${template.name}`,
                  body: `A ${frequency} report for ${studentName} is due now.`,
                  icon: 'ic_notification',
                  sound: 'default'
                }, {
                  type: 'report',
                  studentId: String(student._id),
                  templateId: String(template._id),
                  frequency
                });

                logger.info('Due-report notification created');
              }
            } catch (err) {
              logger.error('Due-report notification check failed', safeError(err, 'DUE_REPORT_NOTIFICATION_CHECK_FAILED'));
              continue;
            }
          }
        }
      } catch (teacherError) {
        logDueReportTeacherFailure(teacherError);
        continue;
      }
    }

    logger.info(`✅ Due reports check completed. Created ${totalNotificationsCreated} new notification(s)`);
  } catch (error) {
    logger.error('Error in checkDueReports:', error);
  }
}

/**
 * Initialize due report checker
 * Runs every hour to check for due reports
 */
function initializeDueReportChecker() {
  // Run every hour at the top of the hour
  scheduleNonOverlapping(cron, '0 * * * *', 'due-report-check', async () => {
    logger.info('Running scheduled due report check...');
    try {
      await checkDueReports();
    } catch (error) {
      logger.error('Scheduled due-report check failed', safeError(error, 'DUE_REPORT_SCHEDULE_FAILED'));
    }
  });

  logger.info('Due report checker initialized - will run every hour');
}

/**
 * Initialize scheduled message processor
 * Runs every minute to check for due scheduled messages
 */
function initializeScheduledMessageProcessor() {
  // Run every minute to check for scheduled messages
  scheduleNonOverlapping(cron, '* * * * *', 'scheduled-message-processor', async () => {
    try {
      await processScheduledMessages();
    } catch (error) {
      logger.error('Error in scheduled message processor:', error);
    }
  });
  
  logger.info('Scheduled message processor initialized - will run every minute');
}

module.exports = {
  initializeReminderScheduler,
  triggerReminderCheck,
  sendReminders,
  initializePDFCleanup,
  initializeScheduledMessageProcessor,
  processScheduledMessages,
  initializeDueReportChecker,
  checkDueReports,
  logPushOutcome,
  sendDueReportPush,
  logEventReminderStart,
  logDueReportTeacherFailure
};

