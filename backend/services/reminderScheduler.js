const cron = require('node-cron');
const Event = require('../models/Event');
const User = require('../models/User');
const ParentGroup = require('../models/ParentGroup');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Report = require('../models/Report');
const ReportTemplate = require('../models/ReportTemplate');
const School = require('../models/School');
const { logger } = require('../utils/logger');
const { sendEventReminder } = require('./notificationService');
const { cleanupOldPDFs } = require('./pdfService');
const { getCurrentDateInTimezone, isReportDue, calculateDueDate, getStartOfFrequencyPeriod } = require('../utils/dateUtils');
const firebaseService = require('./firebaseService');

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
        }).select('parentEmail parentPhone parentName');
        
        // Get unique parent emails
        const parentEmailsForGrade = [...new Set(studentsInGrade
          .filter(s => s.parentEmail)
          .map(s => s.parentEmail))];
        
        // Fetch parent user accounts to get preferences
        const parentUsersForGrade = await User.find({
          role: 'parent',
          email: { $in: parentEmailsForGrade },
          schoolId: event.schoolId,
          isActive: true
        }).select('firstName lastName email phone phoneNumber preferences');
        
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
        }).select('parentEmail parentPhone parentName');
        
        // Get unique parent emails
        const parentEmailsForClass = [...new Set(studentsInClass
          .filter(s => s.parentEmail)
          .map(s => s.parentEmail))];
        
        // Fetch parent user accounts to get preferences
        const parentUsersForClass = await User.find({
          role: 'parent',
          email: { $in: parentEmailsForClass },
          schoolId: event.schoolId,
          isActive: true
        }).select('firstName lastName email phone phoneNumber preferences');
        
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
    logger.error('Error getting event recipients:', error);
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
        logger.info(`Sending ${reminderType} reminders for event: ${event.title}`);

        // Get recipients
        const recipients = await getEventRecipients(event);
        
        if (recipients.length === 0) {
          logger.warn(`No recipients found for event ${event._id}`);
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

        logger.info(`Sent ${successCount}/${recipients.length} ${reminderType} reminders for event: ${event.title}`);
      }
    }

    logger.info(`Completed ${reminderType} reminder check`);
  } catch (error) {
    logger.error(`Error in ${reminderType} reminder scheduler:`, error);
  }
}

/**
 * Initialize the reminder scheduler
 */
function initializeReminderScheduler() {
  // Run every hour to check for pending reminders
  // Format: "minute hour day month dayOfWeek"
  cron.schedule('0 * * * *', async () => {
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
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Starting scheduled PDF cleanup');
      const result = await cleanupOldPDFs(7); // Delete PDFs older than 7 days
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
async function processScheduledMessages() {
  try {
    const now = new Date();
    
    // Find all scheduled messages that are due (scheduledDateTime <= now and not yet sent)
    const scheduledMessages = await Message.find({
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
        // Mark message as sent
        message.sentAt = new Date();
        message.isScheduled = false;
        await message.save();
        
        // Update conversation
        const conversation = message.conversationId;
        if (conversation) {
          await conversation.updateLastMessage(message);
          await conversation.incrementUnread(message.recipientRole);
        }
        
        // Get recipient user for notifications
        const recipientUser = await User.findById(message.recipientId._id || message.recipientId);
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
          
          logger.info(`Created notification for scheduled message recipient ${message.recipientId._id || message.recipientId}`);
          
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
            
            await firebaseService.sendNotificationToUser(recipientUser, pushNotification, pushData);
            logger.info(`Push notification sent for scheduled message to recipient ${message.recipientId._id || message.recipientId}`);
          } catch (pushError) {
            logger.error('Error sending push notification for scheduled message:', pushError);
          }
        }
        
        // Emit socket event if socket service is available
        try {
          const socketService = require('./socketService');
          if (socketService.getIO()) {
            socketService.getIO().to(`conversation:${conversation._id}`).emit('new_message', {
              ...message.toObject(),
              sentAt: message.sentAt
            });
          }
        } catch (socketError) {
          logger.error('Error emitting socket event for scheduled message:', socketError);
        }
        
        logger.info(`Scheduled message ${message._id} processed and sent successfully`);
      } catch (messageError) {
        logger.error(`Error processing scheduled message ${message._id}:`, messageError);
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
    }).select('_id schoolId firstName lastName fcmToken notifications');

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
                  logger.info(`⏭️  Skipping notification: Report already exists for ${studentName} - ${template.name} (created by another teacher)`);
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

                // Send FCM push notification if available
                if (teacher.fcmToken && firebaseService.isInitialized()) {
                  try {
                    await firebaseService.sendNotificationToUser(teacher, {
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
                    logger.info(`📲 Push notification sent to teacher ${teacher.firstName} ${teacher.lastName}`);
                  } catch (pushError) {
                    logger.error('Error sending push notification:', pushError);
                  }
                }

                logger.info(`✅ Created due report notification: ${template.name} for ${studentName} (Teacher: ${teacher.firstName} ${teacher.lastName})`);
              }
            } catch (err) {
              logger.error(`Error checking due status for student ${student._id} template ${template._id}:`, err);
              continue;
            }
          }
        }
      } catch (teacherError) {
        logger.error(`Error processing teacher ${teacher._id}:`, teacherError);
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
  cron.schedule('0 * * * *', async () => {
    logger.info('Running scheduled due report check...');
    try {
      await checkDueReports();
    } catch (error) {
      logger.error('Error in scheduled due report check:', error);
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
  cron.schedule('* * * * *', async () => {
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
  checkDueReports
};

