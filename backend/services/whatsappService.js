const twilio = require('twilio');
const { logger } = require('../utils/logger');

class WhatsAppService {
  constructor() {
    this.client = null; // Global fallback client
    this.initialized = false;
    this.fromNumber = null; // Global fallback number
    this.schoolClients = new Map(); // Per-school clients: Map<schoolId, {client, fromNumber}>
    this.messageQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitDelay = 100; // ms between messages to avoid rate limiting
    this.maxRetries = 3;
  }

  /**
   * Initialize global/fallback Twilio WhatsApp client
   */
  initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

      if (!accountSid || !authToken || !this.fromNumber) {
        logger.warn('Global WhatsApp service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_NUMBER in environment variables.');
        return false;
      }

      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      logger.info('✅ Global WhatsApp service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize global WhatsApp service:', error);
      return false;
    }
  }

  /**
   * Initialize or get school-specific Twilio client
   * @param {Object} school - School object with communication.whatsapp config
   * @returns {Object|null} - {client, fromNumber} or null if not configured
   */
  async getSchoolClient(school) {
    if (!school) {
      logger.warn('No school provided, using global WhatsApp client');
      return this.initialized ? { client: this.client, fromNumber: this.fromNumber } : null;
    }

    const schoolId = school._id.toString();

    // Check if we already have a client for this school
    if (this.schoolClients.has(schoolId)) {
      return this.schoolClients.get(schoolId);
    }

    // Check if school has WhatsApp configured
    if (!school.communication?.whatsapp?.enabled || 
        !school.communication?.whatsapp?.twilioAccountSid || 
        !school.communication?.whatsapp?.twilioAuthToken || 
        !school.communication?.whatsapp?.phoneNumber) {
      logger.info(`School ${school.name} doesn't have WhatsApp configured, using global client`);
      return this.initialized ? { client: this.client, fromNumber: this.fromNumber } : null;
    }

    try {
      // Create school-specific client
      const client = twilio(
        school.communication.whatsapp.twilioAccountSid,
        school.communication.whatsapp.twilioAuthToken
      );
      const fromNumber = school.communication.whatsapp.phoneNumber;

      const schoolClient = { client, fromNumber };
      this.schoolClients.set(schoolId, schoolClient);

      logger.info(`✅ Initialized WhatsApp client for school: ${school.name} (${fromNumber})`);
      return schoolClient;
    } catch (error) {
      logger.error(`❌ Failed to initialize WhatsApp for school ${school.name}:`, error);
      // Fallback to global client
      return this.initialized ? { client: this.client, fromNumber: this.fromNumber } : null;
    }
  }

  /**
   * Check if WhatsApp service is available (global or school-specific)
   * @param {Object} school - Optional school object
   */
  async isAvailable(school = null) {
    if (school) {
      const schoolClient = await this.getSchoolClient(school);
      return schoolClient !== null;
    }
    return this.initialized && this.client !== null;
  }

  /**
   * Format phone number for WhatsApp (E.164 format)
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} - Formatted phone number with whatsapp: prefix
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Keep the + if present, remove everything else except digits
    let cleaned = phoneNumber.trim();
    
    // If it starts with +, keep it and remove all non-digits after it
    if (cleaned.startsWith('+')) {
      cleaned = '+' + cleaned.substring(1).replace(/\D/g, '');
    } else {
      // Remove all non-digits and add +
      cleaned = '+' + cleaned.replace(/\D/g, '');
    }
    
    // Validate E.164 format
    if (!this.validatePhoneNumber(cleaned)) {
      throw new Error(`Invalid phone number format: ${phoneNumber}. Must be in E.164 format: +1234567890`);
    }
    
    return `whatsapp:${cleaned}`;
  }

  /**
   * Send a WhatsApp message with retry logic
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content (or null if using template)
   * @param {Object} options - Additional options (school, mediaUrl, retries, contentSid, contentVariables, etc.)
   * @returns {Promise<Object>} - Message result
   */
  async sendMessage(to, message, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    const school = options.school || null;
    let lastError = null;

    // Get the appropriate client (school-specific or global)
    const schoolClient = await this.getSchoolClient(school);
    if (!schoolClient) {
      return {
        success: false,
        error: 'WhatsApp service not initialized for this school',
        retryable: false
      };
    }

    const { client, fromNumber } = schoolClient;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Validate inputs
        if (!to) {
          throw new Error('Recipient phone number is required');
        }

        const formattedTo = this.formatPhoneNumber(to);
        const formattedFrom = this.formatPhoneNumber(fromNumber);

        const messageData = {
          from: formattedFrom,
          to: formattedTo
        };

        // Use template if contentSid is provided, otherwise use freeform message
        if (options.contentSid) {
          messageData.contentSid = options.contentSid;
          
          // Add template variables if provided
          if (options.contentVariables) {
            messageData.contentVariables = JSON.stringify(options.contentVariables);
          }
          
          logger.info(`Sending WhatsApp template message to ${to} with contentSid: ${options.contentSid}`);
        } else {
          // Freeform message
          if (!message) {
            throw new Error('Message content is required when not using a template');
          }
          
          if (message.length > 1600) {
            logger.warn(`Message to ${to} is ${message.length} characters. WhatsApp limit is 1600. Truncating...`);
            message = message.substring(0, 1597) + '...';
          }
          
          messageData.body = message;
          
          // Add media URL if provided (only for freeform messages)
          if (options.mediaUrl) {
            if (Array.isArray(options.mediaUrl)) {
              messageData.mediaUrl = options.mediaUrl;
            } else {
              messageData.mediaUrl = [options.mediaUrl];
            }
          }
        }

        const result = await client.messages.create(messageData);

        logger.info(`✅ WhatsApp message sent to ${to} from ${fromNumber}:`, {
          sid: result.sid,
          status: result.status,
          attempt: attempt,
          school: school ? school.name : 'Global'
        });

        return {
          success: true,
          messageId: result.sid,
          status: result.status,
          attempt: attempt
        };
      } catch (error) {
        lastError = error;
        logger.warn(`⚠️  WhatsApp message attempt ${attempt}/${maxRetries} failed for ${to}:`, error.message);

        // Don't retry on certain errors
        if (error.code === 21211 || // Invalid phone number
            error.code === 21614 || // Phone number not WhatsApp-enabled
            error.message.includes('Invalid phone number')) {
          logger.error(`❌ Non-retryable error sending WhatsApp to ${to}:`, error.message);
          return {
            success: false,
            error: error.message,
            code: error.code,
            retryable: false
          };
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error(`❌ Failed to send WhatsApp message to ${to} after ${maxRetries} attempts:`, lastError?.message);
    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      code: lastError?.code,
      retryable: true,
      attempts: maxRetries
    };
  }

  /**
   * Send report notification via WhatsApp using template
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} - Send result
   */
  async sendReportNotification(reportData) {
    try {
      const { student, parent, report, schoolName, school } = reportData;

      if (!parent.phoneNumber) {
        logger.warn(`Parent ${parent.email} has no phone number for WhatsApp`);
        return {
          success: false,
          error: 'No phone number available'
        };
      }

      const templateSid = process.env.TWILIO_WHATSAPP_TEMPLATE_SID;
      
      if (!templateSid) {
        logger.error('WhatsApp template SID not configured. Set TWILIO_WHATSAPP_TEMPLATE_SID in environment variables.');
        return {
          success: false,
          error: 'WhatsApp template not configured'
        };
      }

      // Prepare template variables based on the template structure
      // Template: Hello {{1}}! A new report for {{2}} has been shared with you.
      // Report: {{3}}
      // Date: {{4}}
      // Please check your email or click on the link {{5}} to view the full report.
      // - {{6}}
      
      const studentName = `${student.firstName} ${student.lastName}`;
      const parentName = parent.firstName ? `${parent.firstName} ${parent.lastName || ''}`.trim() : 'Parent';
      const reportDate = new Date(report.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Create link to view report (you can customize this based on your app)
      const reportLink = `${process.env.BASE_URL || 'http://localhost:5050'}/reports/${report._id || report.id || ''}`;
      
      const contentVariables = {
        "1": parentName,
        "2": studentName,
        "3": report.reportType || 'Progress Report',
        "4": reportDate,
        "5": reportLink,
        "6": schoolName
      };

      logger.info(`Sending WhatsApp report notification to ${parent.phoneNumber}:`, {
        parentName,
        studentName,
        reportType: report.reportType,
        templateSid
      });
      
      return await this.sendMessage(
        parent.phoneNumber,
        null, // No message body when using template
        {
          contentSid: templateSid,
          contentVariables: contentVariables,
          school: school
        }
      );
    } catch (error) {
      logger.error('Failed to send report notification via WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate report notification message
   * @param {Object} student - Student data
   * @param {Object} report - Report data
   * @param {string} schoolName - School name
   * @returns {string} - Formatted message
   */
  generateReportMessage(student, report, schoolName) {
    const studentName = `${student.firstName} ${student.lastName}`;
    const reportDate = new Date(report.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `📚 *New Report Available*

🎓 *School:* ${schoolName}
👤 *Student:* ${studentName}
📅 *Date:* ${reportDate}
📝 *Type:* ${report.reportType || 'General Report'}

A new report has been generated for your child. Please check your email or the Barrana app for the full report.

Thank you,
${schoolName}`;
  }

  /**
   * Send event notification via WhatsApp
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} - Send result
   */
  async sendEventNotification(eventData) {
    try {
      const { event, parent, schoolName, reminderType } = eventData;

      if (!parent.phoneNumber) {
        logger.warn(`Parent ${parent.email} has no phone number for WhatsApp`);
        return {
          success: false,
          error: 'No phone number available'
        };
      }

      const message = this.generateEventMessage(event, schoolName, reminderType);
      
      return await this.sendMessage(parent.phoneNumber, message);
    } catch (error) {
      logger.error('Failed to send event notification via WhatsApp:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate event notification message
   * @param {Object} event - Event data
   * @param {string} schoolName - School name
   * @param {string} reminderType - Type of reminder (immediate, 2days, 1day)
   * @returns {string} - Formatted message
   */
  generateEventMessage(event, schoolName, reminderType = 'immediate') {
    const startDate = new Date(event.startDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const startTime = event.startTime || 'All day';
    
    let reminderText = '📅 *New Event*';
    let urgencyEmoji = '📢';
    
    if (reminderType === '2days') {
      reminderText = '⏰ *Event Reminder - 2 Days*';
      urgencyEmoji = '⚠️';
    } else if (reminderType === '1day') {
      reminderText = '🔔 *Event Reminder - Tomorrow*';
      urgencyEmoji = '🚨';
    }

    let message = `${urgencyEmoji} ${reminderText}

🎓 *School:* ${schoolName}
📌 *Event:* ${event.title}
📅 *Date:* ${startDate}`;

    if (startTime && startTime !== 'All day') {
      message += `\n⏰ *Time:* ${startTime}`;
    }

    if (event.description) {
      message += `\n\n📝 *Details:*\n${event.description}`;
    }

    if (event.location) {
      message += `\n\n📍 *Location:* ${event.location}`;
    }

    message += `\n\nThank you,\n${schoolName}`;

    return message;
  }

  /**
   * Send bulk WhatsApp messages
   * @param {Array} recipients - Array of {phoneNumber, message} objects
   * @returns {Promise<Array>} - Array of send results
   */
  async sendBulkMessages(recipients) {
    try {
      if (!this.isAvailable()) {
        throw new Error('WhatsApp service not initialized');
      }

      const results = [];
      
      for (const recipient of recipients) {
        const result = await this.sendMessage(recipient.phoneNumber, recipient.message, recipient.options || {});
        results.push({
          phoneNumber: recipient.phoneNumber,
          ...result
        });
        
        // Add a small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return results;
    } catch (error) {
      logger.error('Failed to send bulk WhatsApp messages:', error);
      throw error;
    }
  }

  /**
   * Validate phone number format (E.164)
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - True if valid
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }
    
    // E.164 format: +[country code][subscriber number]
    // Should be between 8 and 15 digits after the +
    // Must start with + and contain only digits after
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    
    // Direct test - no cleaning, must match exactly
    return e164Regex.test(phoneNumber);
  }
}

// Export singleton instance
const whatsappService = new WhatsAppService();
module.exports = whatsappService;

