const NotificationLog = require('../models/NotificationLog');
const { logger } = require('../utils/logger');

/**
 * Centralized Notification Logging Service
 * All notifications (Email, SMS, WhatsApp, Push) log through here
 */
class NotificationLogger {
  /**
   * Create a new notification log entry
   * @param {Object} data - Notification data
   * @returns {Promise<Object>} - Created log document
   */
  async log(data) {
    try {
      const logEntry = await NotificationLog.create({
        // Required fields
        schoolId: data.schoolId,
        channel: data.channel, // 'email', 'sms', 'whatsapp', 'push'
        type: data.type, // 'report', 'event', 'reminder', 'system'
        recipientName: data.recipientName,
        status: data.status || 'pending',
        
        // Optional fields
        subType: data.subType,
        recipientId: data.recipientId,
        recipientEmail: data.recipientEmail,
        recipientPhone: data.recipientPhone,
        studentId: data.studentId,
        studentName: data.studentName,
        classId: data.classId,
        className: data.className,
        gradeLevel: data.gradeLevel,
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        reportId: data.reportId,
        reportTitle: data.reportTitle,
        subject: data.subject,
        messagePreview: data.messagePreview,
        sentAt: data.sentAt,
        deliveredAt: data.deliveredAt,
        error: data.error,
        retryCount: data.retryCount || 0,
        maxRetries: data.maxRetries || 3,
        provider: data.provider,
        providerMessageId: data.providerMessageId,
        providerResponse: data.providerResponse,
        hasAttachments: data.hasAttachments || false,
        attachments: data.attachments || [],
        estimatedCost: data.estimatedCost || 0,
        currency: data.currency || 'USD',
        isFallback: data.isFallback || false,
        fallbackFrom: data.fallbackFrom,
        metadata: data.metadata || {},
        createdBy: data.createdBy,
        createdByName: data.createdByName,
        createdByRole: data.createdByRole
      });

      logger.info(`Notification logged: ${data.channel} to ${data.recipientName}`, {
        logId: logEntry._id,
        channel: data.channel,
        type: data.type,
        status: data.status
      });

      return logEntry;
    } catch (error) {
      logger.error('Failed to create notification log:', error);
      // Don't throw - logging should never break the notification flow
      return null;
    }
  }

  /**
   * Log email notification
   */
  async logEmail(emailData) {
    return this.log({
      channel: 'email',
      provider: 'nodemailer',
      ...emailData,
      messagePreview: this.truncate(emailData.messagePreview || emailData.body, 500)
    });
  }

  /**
   * Log SMS notification
   */
  async logSMS(smsData) {
    return this.log({
      channel: 'sms',
      provider: 'twilio',
      estimatedCost: 0.0075, // Average Twilio SMS cost
      ...smsData,
      messagePreview: this.truncate(smsData.message, 500)
    });
  }

  /**
   * Log WhatsApp notification
   */
  async logWhatsApp(whatsappData) {
    return this.log({
      channel: 'whatsapp',
      provider: 'twilio',
      estimatedCost: 0.005, // Average Twilio WhatsApp cost
      ...whatsappData,
      messagePreview: this.truncate(whatsappData.message, 500)
    });
  }

  /**
   * Log push notification
   */
  async logPush(pushData) {
    return this.log({
      channel: 'push',
      provider: 'firebase',
      estimatedCost: 0, // FCM is free
      ...pushData,
      messagePreview: this.truncate(pushData.body, 500)
    });
  }

  /**
   * Update log status to sent
   */
  async markAsSent(logId, messageId, response = null) {
    try {
      const log = await NotificationLog.findById(logId);
      if (!log) return null;

      log.status = 'sent';
      log.sentAt = new Date();
      log.providerMessageId = messageId;
      if (response) {
        log.providerResponse = response;
      }
      
      await log.save();
      return log;
    } catch (error) {
      logger.error('Failed to mark notification as sent:', error);
      return null;
    }
  }

  /**
   * Update log status to failed
   */
  async markAsFailed(logId, error) {
    try {
      const log = await NotificationLog.findById(logId);
      if (!log) return null;

      log.status = 'failed';
      log.error = {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        details: error
      };
      
      await log.save();
      return log;
    } catch (err) {
      logger.error('Failed to mark notification as failed:', err);
      return null;
    }
  }

  /**
   * Update log status to delivered (for webhooks)
   */
  async markAsDelivered(messageId) {
    try {
      const log = await NotificationLog.findOne({ providerMessageId: messageId });
      if (!log) return null;

      log.status = 'delivered';
      log.deliveredAt = new Date();
      
      await log.save();
      return log;
    } catch (error) {
      logger.error('Failed to mark notification as delivered:', error);
      return null;
    }
  }

  /**
   * Increment retry count
   */
  async incrementRetry(logId) {
    try {
      const log = await NotificationLog.findById(logId);
      if (!log) return null;

      log.retryCount += 1;
      await log.save();
      return log;
    } catch (error) {
      logger.error('Failed to increment retry count:', error);
      return null;
    }
  }

  /**
   * Get statistics for a school
   */
  async getStatistics(schoolId, dateRange = null) {
    try {
      return await NotificationLog.getStatistics(schoolId, dateRange);
    } catch (error) {
      logger.error('Failed to get notification statistics:', error);
      return null;
    }
  }

  /**
   * Get delivery rate
   */
  async getDeliveryRate(schoolId, channel = null, dateRange = null) {
    try {
      return await NotificationLog.getDeliveryRate(schoolId, channel, dateRange);
    } catch (error) {
      logger.error('Failed to get delivery rate:', error);
      return null;
    }
  }

  /**
   * Helper: Truncate text to specified length
   */
  truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Helper: Extract plain text from HTML
   */
  extractPlainText(html) {
    if (!html) return '';
    // Remove HTML tags
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

// Export singleton
module.exports = new NotificationLogger();

