const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const whatsappService = require('../services/whatsappService');
const { logger } = require('../utils/logger');

/**
 * @route   GET /api/whatsapp/status
 * @desc    Check WhatsApp service status
 * @access  Private
 */
router.get('/status', protect, async (req, res) => {
  try {
    whatsappService.initialize();
    
    const status = {
      available: whatsappService.isAvailable(),
      configured: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_WHATSAPP_NUMBER
    };

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error checking WhatsApp status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking WhatsApp status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/whatsapp/preferences
 * @desc    Get user's WhatsApp notification preferences
 * @access  Private
 */
router.get('/preferences', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('phoneNumber phone preferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        phoneNumber: user.phoneNumber || user.phone || null,
        whatsappEnabled: user.preferences?.notifications?.whatsapp || false,
        emailEnabled: user.preferences?.notifications?.email || true,
        smsEnabled: user.preferences?.notifications?.sms || false,
        pushEnabled: user.preferences?.notifications?.push || true
      }
    });
  } catch (error) {
    logger.error('Error fetching WhatsApp preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/whatsapp/preferences
 * @desc    Update user's WhatsApp notification preferences
 * @access  Private
 */
router.put('/preferences', protect, async (req, res) => {
  try {
    const { phoneNumber, whatsappEnabled, emailEnabled, smsEnabled, pushEnabled } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate phone number if provided
    if (phoneNumber) {
      if (!whatsappService.validatePhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid phone number format. Use international format: +1234567890'
        });
      }
      user.phoneNumber = phoneNumber;
      user.phone = phoneNumber; // Keep both fields in sync
    }

    // Update notification preferences
    if (!user.preferences) {
      user.preferences = { notifications: {} };
    }
    if (!user.preferences.notifications) {
      user.preferences.notifications = {};
    }

    if (whatsappEnabled !== undefined) {
      user.preferences.notifications.whatsapp = whatsappEnabled;
    }
    if (emailEnabled !== undefined) {
      user.preferences.notifications.email = emailEnabled;
    }
    if (smsEnabled !== undefined) {
      user.preferences.notifications.sms = smsEnabled;
    }
    if (pushEnabled !== undefined) {
      user.preferences.notifications.push = pushEnabled;
    }

    await user.save();

    logger.info(`User ${user._id} updated WhatsApp preferences`, {
      phoneNumber: !!phoneNumber,
      whatsappEnabled,
      userId: user._id
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        phoneNumber: user.phoneNumber || user.phone || null,
        whatsappEnabled: user.preferences.notifications.whatsapp,
        emailEnabled: user.preferences.notifications.email,
        smsEnabled: user.preferences.notifications.sms,
        pushEnabled: user.preferences.notifications.push
      }
    });
  } catch (error) {
    logger.error('Error updating WhatsApp preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating preferences',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/whatsapp/test
 * @desc    Send a test WhatsApp message
 * @access  Private
 */
router.post('/test', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('phoneNumber phone firstName lastName');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const phoneNumber = user.phoneNumber || user.phone;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'No phone number configured. Please add a phone number first.'
      });
    }

    whatsappService.initialize();

    if (!whatsappService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp service is not configured. Please contact your administrator.'
      });
    }

    const message = `🎉 *Test Message from Barrana.ai*

Hi ${user.firstName},

This is a test message from the Barrana.ai School Management System.

✅ WhatsApp notifications are working!

You will now receive notifications for:
• Student reports
• School events and reminders
• Important announcements

Thank you for using Barrana.ai! 🎓✨`;

    const result = await whatsappService.sendMessage(phoneNumber, message);

    if (result.success) {
      logger.info(`Test WhatsApp message sent to user ${user._id}`);
      res.json({
        success: true,
        message: 'Test message sent successfully! Please check your WhatsApp.',
        data: {
          messageId: result.messageId,
          phoneNumber: phoneNumber
        }
      });
    } else {
      logger.error(`Failed to send test WhatsApp to user ${user._id}:`, result.error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test message',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Error sending test WhatsApp message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending test message',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/whatsapp/validate-phone
 * @desc    Validate a phone number format
 * @access  Private
 */
router.post('/validate-phone', protect, async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const isValid = whatsappService.validatePhoneNumber(phoneNumber);

    res.json({
      success: true,
      data: {
        phoneNumber,
        isValid,
        message: isValid 
          ? 'Phone number is valid' 
          : 'Invalid phone number format. Use international format: +1234567890'
      }
    });
  } catch (error) {
    logger.error('Error validating phone number:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating phone number',
      error: error.message
    });
  }
});

module.exports = router;

