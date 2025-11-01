const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { logger } = require('../utils/logger');
const EventReminder = require('../models/EventReminder');
const whatsappService = require('./whatsappService');
const smsService = require('./smsService');
const notificationLogger = require('./notificationLogger');

// Initialize WhatsApp and SMS services
whatsappService.initialize();
smsService.initialize();

// Initialize Twilio client
let twilioClient = null;
let isTwilioInitialized = false;

try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    isTwilioInitialized = true;
    logger.info('Twilio initialized successfully');
  } else {
    logger.warn('Twilio credentials not found. SMS/WhatsApp notifications will be disabled.');
  }
} catch (error) {
  logger.error('Error initializing Twilio:', error);
}

// Initialize email transporter
let emailTransporter = null;
let isEmailInitialized = false;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    isEmailInitialized = true;
    logger.info('Email transporter initialized successfully');
  } else {
    logger.warn('Email credentials not found. Email notifications will be disabled.');
  }
} catch (error) {
  logger.error('Error initializing email transporter:', error);
}

/**
 * Build professional, branded email shell
 */
const buildBrandedEmail = ({
  school,
  title,
  subtitle,
  bodyHtml,
}) => {
  const primary = school?.branding?.primaryColor || '#667eea';
  const secondary = school?.branding?.secondaryColor || '#764ba2';
  const schoolName = school?.name || 'Your School';

  const headerLogoHtml = school?.logoCid
    ? `<img src="cid:${school.logoCid}" alt="${schoolName} Logo" style="height:40px; object-fit:contain; margin-right:12px; vertical-align:middle;" />`
    : '';

  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
    <div style="background: linear-gradient(135deg, ${primary} 0%, ${secondary} 100%); color: white; padding: 22px; border-radius: 12px 12px 0 0;">
      <div style="display:flex; align-items:center; justify-content:center; gap:12px;">
        ${headerLogoHtml}
        <div>
          <div style="font-size: 20px; font-weight: 700; letter-spacing:.2px;">${title}</div>
          ${subtitle ? `<div style=\"margin-top:4px; font-size:14px; opacity:.95;\">${subtitle}</div>` : ''}
        </div>
      </div>
    </div>
    <div style="background: #ffffff; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 6px 18px rgba(0,0,0,0.06);">
      ${bodyHtml}
      <div style="text-align:center; color:#6b7280; font-size:12px; margin-top:28px; padding-top:16px; border-top:1px solid #e5e7eb;">
        <div style="font-weight:600;">${schoolName}</div>
        <div>This is an automated message. Please contact the school for questions.</div>
      </div>
    </div>
  </div>`;
};

/** Fetch school with branding and prepare inline logo (CID) if available */
const getSchoolWithBranding = async (schoolId) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const School = require('../models/School');
    const school = await School.findById(schoolId).select('name branding logo');
    if (!school) return null;
    // Attach logo as inline image (if local file path)
    const logoPath = school.logo;
    if (logoPath) {
      const absolute = path.join(__dirname, '..', logoPath);
      if (fs.existsSync(absolute)) {
        school.logoAttachment = {
          filename: 'school-logo.png',
          path: absolute,
          cid: `school-logo-${school._id}@barrana`
        };
        school.logoCid = school.logoAttachment.cid;
      }
    }
    return school;
  } catch (e) {
    logger.warn('Unable to load school branding for email:', e.message);
    return null;
  }
};

/**
 * Send event reminder via email
 */
const sendEmailReminder = async (event, recipient, reminderType) => {
  if (!isEmailInitialized) {
    logger.warn('Email not initialized. Skipping email notification.');
    return { sent: false, status: 'failed', error: 'Email not configured' };
  }

  try {
    const school = await getSchoolWithBranding(event.schoolId);
    const schoolName = school?.name || 'Your School';
    const reminderMessages = {
      immediate: schoolName,
      twoDaysBefore: `${schoolName} - Reminder: Event in 2 days`,
      oneDayBefore: `${schoolName} - Reminder: Event tomorrow`
    };

    // Prepare attachments
    const emailAttachments = [];
    const path = require('path');
    const fs = require('fs');
    
    if (event.attachments && event.attachments.length > 0) {
      for (const att of event.attachments) {
        try {
          const filePath = path.join(__dirname, '..', att.url);
          if (fs.existsSync(filePath)) {
            emailAttachments.push({
              filename: att.originalName,
              path: filePath,
              contentType: att.mimeType
            });
            logger.info(`Added attachment to email: ${att.originalName}`);
          } else {
            logger.warn(`Attachment file not found: ${filePath}`);
          }
        } catch (error) {
          logger.error(`Error processing attachment ${att.originalName}:`, error);
        }
      }
    }

    // Build body
    const detailsHtml = `
      <h3 style="margin: 0 0 12px 0; color: #374151; font-size: 18px;">Event Details</h3>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid ${(school?.branding?.primaryColor || '#667eea')};">
        <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${event.title}</p>
        ${event.description ? `<p style=\"margin:0 0 8px 0;\"><strong>Description:</strong> ${event.description}</p>` : ''}
        <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${event.isMultiDay ? `<p style=\"margin:0 0 8px 0;\"><strong>End Date:</strong> ${new Date(event.endDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
        ${event.location ? `<p style=\"margin:0 0 8px 0;\"><strong>Location:</strong> ${event.location}</p>` : ''}
        ${emailAttachments.length > 0 ? `<p style=\"margin:0;\"><strong>📎 Attachments:</strong> ${emailAttachments.length} file(s) attached</p>` : ''}
      </div>`;

    const html = buildBrandedEmail({
      school,
      title: 'New Event',
      subtitle: event.title,
      bodyHtml: detailsHtml,
    });

    // Prepare attachments array with logo first (for inline CID reference)
    const allAttachments = [];
    
    // Add school logo first as inline attachment (CID)
    if (school?.logoAttachment) {
      allAttachments.push(school.logoAttachment);
    }
    
    // Add event attachments
    if (emailAttachments.length > 0) {
      allAttachments.push(...emailAttachments);
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: recipient.email,
      subject: `${reminderMessages[reminderType]}: ${event.title}`,
      html,
      attachments: allAttachments
    };

    await emailTransporter.sendMail(mailOptions);
    logger.info(`Email sent to ${recipient.email} for event ${event._id} with ${emailAttachments.length} attachment(s)`);
    
    return { 
      sent: true, 
      status: 'sent', 
      sentAt: new Date(),
      attachmentsCount: emailAttachments.length
    };
  } catch (error) {
    logger.error(`Error sending email to ${recipient.email}:`, error);
    return { 
      sent: false, 
      status: 'failed', 
      error: error.message 
    };
  }
};

/**
 * Send event reminder via SMS
 */
const sendSMSReminder = async (event, recipient, reminderType) => {
  if (!isTwilioInitialized) {
    logger.warn('Twilio not initialized. Skipping SMS notification.');
    return { sent: false, status: 'failed', error: 'SMS not configured' };
  }

  if (!recipient.phone) {
    return { sent: false, status: 'failed', error: 'No phone number' };
  }

  try {
    const reminderMessages = {
      immediate: 'New event added',
      twoDaysBefore: 'Reminder in 2 days',
      oneDayBefore: 'Reminder tomorrow'
    };

    const message = `${reminderMessages[reminderType]}: ${event.title}\n` +
      `Date: ${new Date(event.startDate).toLocaleDateString()}${event.isMultiDay ? ` - ${new Date(event.endDate).toLocaleDateString()}` : ''}\n` +
      `${event.location ? `Location: ${event.location}\n` : ''}` +
      `${event.description ? event.description.substring(0, 100) + '...' : ''}`;

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: recipient.phone
    });

    logger.info(`SMS sent to ${recipient.phone} for event ${event._id}`);
    
    return { 
      sent: true, 
      status: 'sent', 
      sentAt: new Date(),
      messageId: result.sid
    };
  } catch (error) {
    logger.error(`Error sending SMS to ${recipient.phone}:`, error);
    return { 
      sent: false, 
      status: 'failed', 
      error: error.message 
    };
  }
};

/**
 * Send event reminder via WhatsApp
 */
const sendWhatsAppReminder = async (event, recipient, reminderType) => {
  // Check if recipient has WhatsApp enabled
  if (!recipient.preferences?.notifications?.whatsapp) {
    logger.info(`WhatsApp notifications disabled for ${recipient.email}`);
    return { sent: false, status: 'skipped', error: 'WhatsApp notifications disabled' };
  }

  if (!recipient.phone && !recipient.phoneNumber) {
    return { sent: false, status: 'failed', error: 'No phone number' };
  }

  try {
    const whatsappService = require('./whatsappService');
    whatsappService.initialize();
    
    if (!whatsappService.isAvailable()) {
      logger.warn('WhatsApp service not available. Skipping WhatsApp notification.');
      return { sent: false, status: 'failed', error: 'WhatsApp not configured' };
    }

    // Get school name
    const School = require('../models/School');
    const school = await School.findById(event.schoolId);
    const schoolName = school ? school.name : 'Your School';

    // Map reminder types
    const reminderTypeMap = {
      immediate: 'immediate',
      twoDaysBefore: '2days',
      oneDayBefore: '1day'
    };

    const result = await whatsappService.sendEventNotification({
      event,
      parent: {
        email: recipient.email,
        phoneNumber: recipient.phone || recipient.phoneNumber
      },
      schoolName,
      reminderType: reminderTypeMap[reminderType] || 'immediate'
    });

    if (result.success) {
      logger.info(`WhatsApp sent to ${recipient.phone || recipient.phoneNumber} for event ${event._id}`);
      return { 
        sent: true, 
        status: 'sent', 
        sentAt: new Date(),
        messageId: result.messageId
      };
    } else {
      logger.error(`WhatsApp failed to ${recipient.phone || recipient.phoneNumber}: ${result.error}`);
      return { 
        sent: false, 
        status: 'failed',
        error: result.error
      };
    }
  } catch (error) {
    logger.error(`Error sending WhatsApp to ${recipient.phone || recipient.phoneNumber}:`, error);
    return { 
      sent: false, 
      status: 'failed',
      error: error.message 
    };
  }
};

/**
 * Send reminder via all channels and log the result
 */
const sendEventReminder = async (event, recipient, reminderType) => {
  try {
    logger.info(`Sending ${reminderType} reminder for event ${event._id} to ${recipient.name}`);

    // Send via all channels
    const [emailResult, smsResult, whatsappResult] = await Promise.all([
      sendEmailReminder(event, recipient, reminderType),
      sendSMSReminder(event, recipient, reminderType),
      sendWhatsAppReminder(event, recipient, reminderType)
    ]);

    // Create reminder log
    const reminderLog = new EventReminder({
      eventId: event._id,
      reminderType,
      recipientId: recipient._id,
      recipientName: recipient.name,
      recipientEmail: recipient.email,
      recipientPhone: recipient.phone,
      schoolId: event.schoolId,
      channels: {
        email: emailResult,
        sms: smsResult,
        whatsapp: whatsappResult
      }
    });

    // Update overall status
    reminderLog.updateOverallStatus();
    await reminderLog.save();

    logger.info(`Reminder log created for event ${event._id}, recipient ${recipient._id}`);

    return reminderLog;
  } catch (error) {
    logger.error(`Error sending event reminder:`, error);
    throw error;
  }
};

/**
 * Check service status
 */
const getServiceStatus = () => {
  return {
    email: isEmailInitialized,
    sms: isTwilioInitialized,
    whatsapp: isTwilioInitialized
  };
};

// Send event update notification
const sendEventUpdateNotification = async (event, recipients, changes) => {
  if (!isEmailInitialized) {
    logger.warn('Email not initialized. Skipping event update notification.');
    return;
  }

  try {
    // Fetch school for WhatsApp configuration
    const School = require('../models/School');
    const school = await School.findById(event.schoolId);
    
    const changeMessages = [];
    if (changes.titleChanged) changeMessages.push('title');
    if (changes.dateChanged) changeMessages.push('date/time');
    if (changes.timeChanged) changeMessages.push('reminder time');
    if (changes.recipientsChanged) changeMessages.push('recipients');

    const changeText = changeMessages.join(', ');
    
    for (const recipient of recipients) {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Barrana School'}" <${process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject: `Event Updated: ${event.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, ${(school?.branding?.primaryColor || '#667eea')} 0%, ${(school?.branding?.secondaryColor || '#764ba2')} 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📅 Event Updated</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${event.title}</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">⚠️ Event Changes</h3>
                <p style="margin: 0; color: #92400e;">The following aspects of this event have been updated: <strong>${changeText}</strong></p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">📋 Updated Event Details</h3>
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
                  <p style="margin: 0 0 10px 0;"><strong>Event:</strong> ${event.title}</p>
                  ${event.description ? `<p style="margin: 0 0 10px 0;"><strong>Description:</strong> ${event.description}</p>` : ''}
                  <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                  ${event.isMultiDay ? `<p style="margin: 0 0 10px 0;"><strong>End Date:</strong> ${new Date(event.endDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>` : ''}
                  ${event.location ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${event.location}</p>` : ''}
                  <p style="margin: 0;"><strong>Reminder Time:</strong> ${event.reminderTime}</p>
                </div>
              </div>
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 16px;">🔄 What This Means</h3>
                <ul style="margin: 0; padding-left: 20px; color: #065f46;">
                  <li>You will receive updated reminders based on the new schedule</li>
                  <li>Please update your calendar with the new details</li>
                  <li>Contact the school if you have any questions</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  This is an automated notification from your school's event management system.
                </p>
              </div>
            </div>
          </div>
        `
      };

      const emailResult = await emailTransporter.sendMail(mailOptions);
      
      // Log the email notification
      await EventReminder.create({
        eventId: event._id,
        schoolId: event.schoolId,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientPhone: recipient.phone,
        reminderType: 'update',
        channels: {
          email: {
            sent: true,
            status: 'sent',
            sentAt: new Date()
          }
        },
        overallStatus: 'partial'
      });

      // Log to notification logger
      await notificationLogger.logEmail({
        schoolId: event.schoolId,
        type: 'event',
        subType: 'update',
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        eventId: event._id,
        eventTitle: event.title,
        subject: `Event Updated: ${event.title}`,
        messagePreview: `Changes: ${changeText}`,
        status: 'sent',
        sentAt: new Date(),
        providerMessageId: emailResult.messageId
      });

      // Send WhatsApp notification if enabled
      if (isTwilioInitialized && recipient.phone && recipient.preferences?.notifications?.whatsapp) {
        try {
          const changeMessages = [];
          if (changes.titleChanged) changeMessages.push('title');
          if (changes.dateChanged) changeMessages.push('date/time');
          if (changes.timeChanged) changeMessages.push('reminder time');
          if (changes.recipientsChanged) changeMessages.push('recipients');
          const changeText = changeMessages.join(', ');

          const whatsappMessage = `🏫 *School Notification*\n` +
            `📅 *Event Updated*\n\n` +
            `⚠️ The following have been updated: ${changeText}\n\n` +
            `*Event:* ${event.title}\n` +
            `*Date:* ${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
            `${event.location ? `*Location:* ${event.location}\n` : ''}` +
            `\nPlease update your calendar with these changes.`;

          const result = await whatsappService.sendMessage(recipient.phone, whatsappMessage, { school });
          
          let whatsappSuccess = result && result.success;
          let smsSuccess = false;
          let smsResult = null;

          // SMS Fallback: Try SMS if WhatsApp fails
          if (!whatsappSuccess && recipient.preferences?.notifications?.sms) {
            logger.info(`WhatsApp failed for ${recipient.phone}, trying SMS fallback...`);
            try {
              const smsMessage = `Event Updated: ${changeText}\n${event.title}\n${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\n- ${school ? school.name : 'School'}`;
              smsResult = await smsService.sendMessage(recipient.phone, smsMessage, { school });
              smsSuccess = smsResult && smsResult.success;
              
              if (smsSuccess) {
                logger.info(`✅ SMS fallback successful for ${recipient.phone}`);
              }
            } catch (smsError) {
              logger.error(`SMS fallback also failed for ${recipient.phone}:`, smsError.message);
            }
          }
          
          // Log notification if at least one channel succeeded
          if (whatsappSuccess || smsSuccess) {
            const reminderData = {
              eventId: event._id,
              schoolId: event.schoolId,
              recipientId: recipient.id,
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              recipientPhone: recipient.phone,
              reminderType: 'update',
              channels: {},
              overallStatus: 'partial'
            };

            if (whatsappSuccess) {
              reminderData.channels.whatsapp = {
                sent: true,
                status: 'sent',
                sentAt: new Date(),
                messageId: result.messageId
              };
            }

            if (smsSuccess) {
              reminderData.channels.sms = {
                sent: true,
                status: 'sent',
                sentAt: new Date(),
                messageId: smsResult.messageId
              };
            }

            await EventReminder.create(reminderData);
            logger.info(`Update notification sent to ${recipient.phone} via ${whatsappSuccess ? 'WhatsApp' : 'SMS (fallback)'}`);

            // Log WhatsApp to notification logger
            if (whatsappSuccess) {
              await notificationLogger.logWhatsApp({
                schoolId: event.schoolId,
                type: 'event',
                subType: 'update',
                recipientId: recipient.id,
                recipientName: recipient.name,
                recipientPhone: recipient.phone,
                eventId: event._id,
                eventTitle: event.title,
                message: whatsappMessage,
                status: 'sent',
                sentAt: new Date(),
                providerMessageId: result.messageId
              });
            }

            // Log SMS to notification logger
            if (smsSuccess) {
              await notificationLogger.logSMS({
                schoolId: event.schoolId,
                type: 'event',
                subType: 'update',
                recipientId: recipient.id,
                recipientName: recipient.name,
                recipientPhone: recipient.phone,
                eventId: event._id,
                eventTitle: event.title,
                message: smsMessage,
                status: 'sent',
                sentAt: new Date(),
                providerMessageId: smsResult.messageId,
                isFallback: true,
                fallbackFrom: 'whatsapp'
              });
            }
          } else {
            logger.error(`All notification channels failed for ${recipient.phone}`);
            
            // Log failed WhatsApp attempt
            if (!whatsappSuccess && recipient.preferences?.notifications?.whatsapp) {
              await notificationLogger.logWhatsApp({
                schoolId: event.schoolId,
                type: 'event',
                subType: 'update',
                recipientId: recipient.id,
                recipientName: recipient.name,
                recipientPhone: recipient.phone,
                eventId: event._id,
                eventTitle: event.title,
                message: whatsappMessage,
                status: 'failed',
                error: {
                  message: result?.error || 'Unknown error'
                }
              });
            }
          }
        } catch (whatsappError) {
          logger.error(`Failed to send WhatsApp update notification to ${recipient.phone}:`, whatsappError.message);
          // Don't fail if WhatsApp fails
        }
      }
    }

    logger.info(`Event update notifications sent to ${recipients.length} recipients for event ${event._id}`);
  } catch (error) {
    logger.error('Error sending event update notification:', error);
    throw error;
  }
};

// Send event deletion notification
const sendEventDeletionNotification = async (event, recipients) => {
  if (!isEmailInitialized) {
    logger.warn('Email not initialized. Skipping event deletion notification.');
    return;
  }

  try {
    // Fetch school for WhatsApp configuration
    const School = require('../models/School');
    const school = await School.findById(event.schoolId);
    
    for (const recipient of recipients) {
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'Barrana School'}" <${process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject: `Event Cancelled: ${event.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600;">❌ Event Cancelled</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${event.title}</p>
            </div>
            
            <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #dc2626; font-size: 16px;">⚠️ Important Notice</h3>
                <p style="margin: 0; color: #dc2626;">This event has been cancelled and will no longer take place.</p>
              </div>
              
              <div style="margin-bottom: 20px;">
                <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">📋 Cancelled Event Details</h3>
                <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444;">
                  <p style="margin: 0 0 10px 0;"><strong>Event:</strong> ${event.title}</p>
                  ${event.description ? `<p style="margin: 0 0 10px 0;"><strong>Description:</strong> ${event.description}</p>` : ''}
                  <p style="margin: 0 0 10px 0;"><strong>Date:</strong> ${new Date(event.startDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>
                  ${event.isMultiDay ? `<p style="margin: 0 0 10px 0;"><strong>End Date:</strong> ${new Date(event.endDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</p>` : ''}
                  ${event.location ? `<p style="margin: 0 0 10px 0;"><strong>Location:</strong> ${event.location}</p>` : ''}
                </div>
              </div>
              
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">📝 What This Means</h3>
                <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                  <li>This event will no longer take place</li>
                  <li>You will not receive any further reminders for this event</li>
                  <li>Please remove this event from your calendar</li>
                  <li>Contact the school if you have any questions</li>
                </ul>
              </div>
              
              <div style="background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #065f46; font-size: 16px;">💡 Next Steps</h3>
                <ul style="margin: 0; padding-left: 20px; color: #065f46;">
                  <li>Remove this event from your personal calendar</li>
                  <li>Check for any new events that may have been scheduled</li>
                  <li>Contact the school if you need clarification</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                  This is an automated notification from your school's event management system.
                </p>
              </div>
            </div>
          </div>
        `
      };

      await emailTransporter.sendMail(mailOptions);
      
      // Log the email notification
      await EventReminder.create({
        eventId: event._id,
        schoolId: event.schoolId,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientPhone: recipient.phone,
        reminderType: 'cancellation',
        channels: {
          email: {
            sent: true,
            status: 'sent',
            sentAt: new Date()
          }
        },
        overallStatus: 'partial'
      });

      // Send WhatsApp notification if enabled
      if (isTwilioInitialized && recipient.phone && recipient.preferences?.notifications?.whatsapp) {
        try {
          const whatsappMessage = `🏫 *School Notification*\n` +
            `❌ *Event Cancelled*\n\n` +
            `⚠️ *Important:* This event has been cancelled and will not take place.\n\n` +
            `*Event:* ${event.title}\n` +
            `*Date:* ${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n` +
            `${event.location ? `*Location:* ${event.location}\n` : ''}` +
            `\nPlease remove this event from your calendar.`;

          const result = await whatsappService.sendMessage(recipient.phone, whatsappMessage, { school });
          
          let whatsappSuccess = result && result.success;
          let smsSuccess = false;
          let smsResult = null;

          // SMS Fallback: Try SMS if WhatsApp fails
          if (!whatsappSuccess && recipient.preferences?.notifications?.sms) {
            logger.info(`WhatsApp failed for ${recipient.phone}, trying SMS fallback...`);
            try {
              const smsMessage = `Event Cancelled: ${event.title}\n${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\nPlease remove from your calendar.\n- ${school ? school.name : 'School'}`;
              smsResult = await smsService.sendMessage(recipient.phone, smsMessage, { school });
              smsSuccess = smsResult && smsResult.success;
              
              if (smsSuccess) {
                logger.info(`✅ SMS fallback successful for ${recipient.phone}`);
              }
            } catch (smsError) {
              logger.error(`SMS fallback also failed for ${recipient.phone}:`, smsError.message);
            }
          }
          
          // Log notification if at least one channel succeeded
          if (whatsappSuccess || smsSuccess) {
            const reminderData = {
              eventId: event._id,
              schoolId: event.schoolId,
              recipientId: recipient.id,
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              recipientPhone: recipient.phone,
              reminderType: 'cancellation',
              channels: {},
              overallStatus: 'partial'
            };

            if (whatsappSuccess) {
              reminderData.channels.whatsapp = {
                sent: true,
                status: 'sent',
                sentAt: new Date(),
                messageId: result.messageId
              };
            }

            if (smsSuccess) {
              reminderData.channels.sms = {
                sent: true,
                status: 'sent',
                sentAt: new Date(),
                messageId: smsResult.messageId
              };
            }

            await EventReminder.create(reminderData);
            logger.info(`Cancellation notification sent to ${recipient.phone} via ${whatsappSuccess ? 'WhatsApp' : 'SMS (fallback)'}`);
          }
        } catch (whatsappError) {
          logger.error(`Failed to send WhatsApp cancellation notification to ${recipient.phone}:`, whatsappError.message);
          // Don't fail if WhatsApp fails
        }
      }
    }

    logger.info(`Event deletion notifications sent to ${recipients.length} recipients for event ${event._id}`);
  } catch (error) {
    logger.error('Error sending event deletion notification:', error);
    throw error;
  }
};

module.exports = {
  sendEventReminder,
  sendEmailReminder,
  sendSMSReminder,
  sendWhatsAppReminder,
  sendEventUpdateNotification,
  sendEventDeletionNotification,
  getServiceStatus,
  isTwilioInitialized,
  isEmailInitialized
};

