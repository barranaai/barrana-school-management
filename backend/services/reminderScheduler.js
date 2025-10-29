const cron = require('node-cron');
const Event = require('../models/Event');
const User = require('../models/User');
const ParentGroup = require('../models/ParentGroup');
const { logger } = require('../utils/logger');
const { sendEventReminder } = require('./notificationService');
const { cleanupOldPDFs } = require('./pdfService');

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

module.exports = {
  initializeReminderScheduler,
  triggerReminderCheck,
  sendReminders,
  initializePDFCleanup
};

