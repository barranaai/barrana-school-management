const twilio = require('twilio');
const { logger } = require('../utils/logger');

class SMSService {
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
   * Initialize global/fallback Twilio SMS client
   */
  initialize() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !this.fromNumber) {
        logger.warn('Global SMS service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in environment variables.');
        return false;
      }

      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      logger.info('✅ Global SMS service initialized successfully');
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize global SMS service:', error);
      return false;
    }
  }

  /**
   * Initialize or get school-specific Twilio client
   * @param {Object} school - School object with communication.sms config
   * @returns {Object|null} - {client, fromNumber} or null if not configured
   */
  async getSchoolClient(school) {
    if (!school) {
      logger.warn('No school provided, using global SMS client');
      return this.initialized ? { client: this.client, fromNumber: this.fromNumber } : null;
    }

    const schoolId = school._id.toString();

    // Check if we already have a client for this school
    if (this.schoolClients.has(schoolId)) {
      return this.schoolClients.get(schoolId);
    }

    // Check if school has SMS configured
    if (!school.communication?.sms?.enabled || 
        !school.communication?.sms?.twilioAccountSid || 
        !school.communication?.sms?.twilioAuthToken || 
        !school.communication?.sms?.phoneNumber) {
      logger.info(`School ${school.name} doesn't have SMS configured, using global client`);
      return this.initialized ? { client: this.client, fromNumber: this.fromNumber } : null;
    }

    try {
      // Create school-specific client
      const client = twilio(
        school.communication.sms.twilioAccountSid,
        school.communication.sms.twilioAuthToken
      );
      const fromNumber = school.communication.sms.phoneNumber;

      const schoolClient = { client, fromNumber };
      this.schoolClients.set(schoolId, schoolClient);

      logger.info(`✅ Initialized SMS client for school: ${school.name} (${fromNumber})`);
      return schoolClient;
    } catch (error) {
      logger.error(`❌ Failed to initialize SMS for school ${school.name}:`, error);
      // Fallback to global client
      return this.initialized ? { client: this.client, fromNumber: this.fromNumber } : null;
    }
  }

  /**
   * Check if SMS service is available (global or school-specific)
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
   * Format phone number for SMS (E.164 format)
   * @param {string} phoneNumber - Phone number to format
   * @returns {string} - Formatted phone number
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
    
    return cleaned;
  }

  /**
   * Validate phone number (strict E.164 format)
   * @param {string} phoneNumber - Phone number to validate
   * @returns {boolean} - True if valid
   */
  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) return false;
    // E.164 format: + followed by 1-15 digits
    return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
  }

  /**
   * Send an SMS with retry logic
   * @param {string} to - Recipient phone number
   * @param {string} message - Message content
   * @param {Object} options - Additional options (school, retries, etc.)
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
        error: 'SMS service not initialized for this school',
        retryable: false
      };
    }

    const { client, fromNumber } = schoolClient;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Validate inputs
        if (!to || !message) {
          throw new Error('Recipient phone number and message are required');
        }

        // SMS has a 160 character limit for single message, 1600 for concatenated
        if (message.length > 1600) {
          logger.warn(`Message to ${to} is ${message.length} characters. SMS limit is 1600. Truncating...`);
          message = message.substring(0, 1597) + '...';
        }

        const formattedTo = this.formatPhoneNumber(to);
        const formattedFrom = this.formatPhoneNumber(fromNumber);

        const messageData = {
          from: formattedFrom,
          to: formattedTo,
          body: message
        };

        const result = await client.messages.create(messageData);

        logger.info(`✅ SMS sent to ${to} from ${fromNumber}:`, {
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
        logger.warn(`⚠️  SMS attempt ${attempt}/${maxRetries} failed for ${to}:`, error.message);

        // Don't retry on certain errors
        if (error.code === 21211 || // Invalid phone number
            error.code === 21614 || // Phone number not valid
            error.message.includes('Invalid phone number')) {
          logger.error(`❌ Non-retryable error sending SMS to ${to}:`, error.message);
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

    logger.error(`❌ Failed to send SMS to ${to} after ${maxRetries} attempts:`, lastError?.message);

    return {
      success: false,
      error: lastError?.message || 'Unknown error',
      code: lastError?.code,
      retryable: true,
      attempts: maxRetries
    };
  }

  /**
   * Send event notification via SMS
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} - Send result
   */
  async sendEventNotification(eventData) {
    try {
      const { event, parent, schoolName, reminderType } = eventData;

      if (!parent.phoneNumber) {
        logger.warn(`Parent ${parent.email} has no phone number for SMS`);
        return {
          success: false,
          error: 'No phone number available'
        };
      }

      const message = this.generateEventMessage(event, schoolName, reminderType);
      
      return await this.sendMessage(parent.phoneNumber, message, { school: eventData.school });
    } catch (error) {
      logger.error('Failed to send event notification via SMS:', error);
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
   * @param {string} reminderType - Type of reminder
   * @returns {string} - Formatted message
   */
  generateEventMessage(event, schoolName, reminderType = 'immediate') {
    const startDate = new Date(event.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    let prefix = '📅 New Event';
    
    if (reminderType === '2days') {
      prefix = '⏰ Event Reminder - 2 Days';
    } else if (reminderType === '1day') {
      prefix = '🔔 Event Tomorrow';
    }

    // Keep SMS concise due to character limits
    let message = `${prefix}: ${event.title}\n`;
    message += `Date: ${startDate}\n`;
    if (event.location) {
      message += `Location: ${event.location}\n`;
    }
    message += `- ${schoolName}`;

    return message;
  }

  /**
   * Send report notification via SMS
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} - Send result
   */
  async sendReportNotification(reportData) {
    try {
      const { student, parent, report, schoolName, school } = reportData;

      if (!parent.phoneNumber) {
        logger.warn(`Parent ${parent.email} has no phone number for SMS`);
        return {
          success: false,
          error: 'No phone number available'
        };
      }

      const message = this.generateReportMessage(student, report, schoolName);
      
      return await this.sendMessage(parent.phoneNumber, message, { school });
    } catch (error) {
      logger.error('Failed to send report notification via SMS:', error);
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
      month: 'short',
      day: 'numeric'
    });

    return `📚 New Report\n${studentName} - ${reportDate}\nCheck your email or app for details.\n- ${schoolName}`;
  }

  /**
   * Send bulk SMS messages with rate limiting
   * @param {Array} recipients - Array of {phoneNumber, message}
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} - Array of results
   */
  async sendBulkMessages(recipients, options = {}) {
    const results = [];
    
    for (const recipient of recipients) {
      const result = await this.sendMessage(
        recipient.phoneNumber,
        recipient.message,
        options
      );
      
      results.push({
        phoneNumber: recipient.phoneNumber,
        ...result
      });
      
      // Rate limiting delay between messages
      if (this.rateLimitDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }
    
    return results;
  }
}

// Create singleton instance
const smsService = new SMSService();

module.exports = smsService;

