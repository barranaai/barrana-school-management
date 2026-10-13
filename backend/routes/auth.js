const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const User = require('../models/User');
const School = require('../models/School');
const { protect, authorize, auditLog } = require('../middleware/auth');
const { developmentOnly, publicRegistrationDisabled } = require('../middleware/environment');
const { sendEmail, isEmailConfigured } = require('../utils/email');
const { logger } = require('../utils/logger');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 10,
  message: { success: false, message: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50, // limit each IP to 50 requests per windowMs (increased for testing)
//   message: {
//     success: false,
//     message: 'Too many authentication attempts, please try again later'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', publicRegistrationDisabled, [
  authLimiter,
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['school_admin', 'teacher', 'parent', 'student']).withMessage('Invalid role'),
  body('schoolId').optional().isMongoId().withMessage('Invalid school ID')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { firstName, lastName, email, password, role, schoolId } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate school exists if provided
    if (schoolId) {
      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(400).json({
          success: false,
          message: 'School not found'
        });
      }
    }

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role,
      schoolId
    });

    await user.save();

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Verify Your Email - Barrana.ai',
        template: 'emailVerification',
        data: {
          name: user.firstName,
          verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
        }
      });
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Generate JWT token
    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          isEmailVerified: user.isEmailVerified
        },
        token
      }
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
  authLimiter,
  body('email').notEmpty().withMessage('Email or Student ID is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Debug logging
    logger.info('Login attempt received');

    // Find user by email OR studentId and include password for comparison
    // Email could be either an actual email or a studentId
    let user = null;
    
    // Try to find by email first
    if (email && email.includes('@')) {
      user = await User.findOne({ email: email.toLowerCase() })
        .select('+password')
        .populate('schoolId', 'name slug schoolType accountType organizationType customOrganizationTypeLabel terminologyProfile');
    } else {
      // Try to find by studentId (for student login)
      user = await User.findOne({ studentId: email.toUpperCase() })
        .select('+password')
        .populate('schoolId', 'name slug schoolType accountType organizationType customOrganizationTypeLabel terminologyProfile');
    }
    if (!user) {
      logger.warn('Login failed', { reason: 'invalid_credentials' });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Login failed', { reason: 'invalid_credentials' });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn('Login failed', { reason: 'invalid_credentials' });
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    user.lastActivity = new Date();
    await user.save();

    // Generate JWT token
    const token = user.generateAuthToken();

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          address: user.address || '',
          role: user.role,
          schoolId: user.schoolId,
          isEmailVerified: user.isEmailVerified,
          preferences: user.preferences
        },
        token
      }
    });

  } catch (error) {
    logger.error('Login failed unexpectedly', { errorName: error?.name || 'Error' });
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('schoolId', 'name slug schoolType accountType organizationType customOrganizationTypeLabel terminologyProfile');

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          address: user.address || '',
          role: user.role,
          schoolId: user.schoolId,
          isEmailVerified: user.isEmailVerified,
          preferences: user.preferences,
          lastLogin: user.lastLogin,
          lastActivity: user.lastActivity,
          canEmailReports: user.canEmailReports || false
        }
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

const SELF_PROFILE_FIELDS = ['firstName', 'lastName', 'phone', 'address'];
const PROTECTED_SELF_FIELDS = [
  'role', 'schoolId', 'isActive', 'isEmailVerified', 'password',
  'permissions', 'grade', 'students', 'assignedTeacher'
];

const publicSelfSettings = user => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone || '',
  address: user.address || '',
  role: user.role,
  schoolId: user.schoolId,
  preferences: user.preferences
});

// @route   PATCH /api/auth/me/profile
// @desc    Update the authenticated user's permitted profile fields
// @access  Private
router.patch('/me/profile', protect, async (req, res) => {
  try {
    if (PROTECTED_SELF_FIELDS.some(field => Object.prototype.hasOwnProperty.call(req.body || {}, field))) {
      return res.status(400).json({ success: false, message: 'Protected account fields cannot be changed here' });
    }
    if (Object.keys(req.body || {}).some(field => !SELF_PROFILE_FIELDS.includes(field))) {
      return res.status(400).json({ success: false, message: 'Only permitted profile fields can be changed here' });
    }

    const updates = {};
    for (const field of SELF_PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }

    if (!updates.firstName && Object.prototype.hasOwnProperty.call(updates, 'firstName')) {
      return res.status(400).json({ success: false, message: 'First name is required' });
    }
    if (!updates.lastName && Object.prototype.hasOwnProperty.call(updates, 'lastName')) {
      return res.status(400).json({ success: false, message: 'Last name is required' });
    }
    if (updates.phone && !/^\+[1-9]\d{7,14}$/.test(updates.phone)) {
      return res.status(400).json({ success: false, message: 'Use an international phone number such as +1234567890' });
    }

    const user = await User.findById(req.user.id || req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    Object.assign(user, updates);
    await user.save();
    res.json({ success: true, message: 'Profile updated successfully', data: publicSelfSettings(user) });
  } catch (error) {
    logger.error('Self profile update failed', { errorName: error?.name || 'Error' });
    res.status(400).json({ success: false, message: 'Unable to update profile. Check the supplied information.' });
  }
});

// @route   PATCH /api/auth/me/notifications
// @desc    Update the authenticated user's supported notification preferences
// @access  Private
router.patch('/me/notifications', protect, async (req, res) => {
  try {
    const allowed = ['email', 'push', 'sms', 'whatsapp'];
    const supplied = Object.keys(req.body || {});
    if (!supplied.length || supplied.some(field => !allowed.includes(field))) {
      return res.status(400).json({ success: false, message: 'Only supported notification preferences can be changed' });
    }
    if (supplied.some(field => typeof req.body[field] !== 'boolean')) {
      return res.status(400).json({ success: false, message: 'Notification preferences must be true or false' });
    }

    const user = await User.findById(req.user.id || req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.preferences) user.preferences = {};
    if (!user.preferences.notifications) user.preferences.notifications = {};
    for (const field of supplied) user.preferences.notifications[field] = req.body[field];
    user.markModified?.('preferences');
    await user.save();

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: { notifications: user.preferences.notifications }
    });
  } catch (error) {
    logger.error('Notification preference update failed', { errorName: error?.name || 'Error' });
    res.status(500).json({ success: false, message: 'Unable to update notification preferences' });
  }
});

// @route   POST /api/auth/me/change-password
// @desc    Change the authenticated user's password after confirming the current password
// @access  Private
router.post('/me/change-password', protect, authLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Current password and a new password of at least 8 characters are required' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: 'The new password must be different from the current password' });
    }

    const user = await User.findById(req.user.id || req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Password change failed', { errorName: error?.name || 'Error' });
    res.status(500).json({ success: false, message: 'Unable to change password' });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
  authLimiter,
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    if (!isEmailConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Password reset email delivery is currently unavailable. Contact your administrator.'
      });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send reset email
    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset - Barrana.ai',
        template: 'passwordReset',
        data: {
          name: user.firstName,
          resetUrl: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
        }
      });

      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email', { errorName: emailError?.name || 'Error', errorCode: emailError?.code || 'EMAIL_DELIVERY_FAILED' });
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }

  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
  authLimiter,
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password reset request'
      });
    }

    const { token, password } = req.body;

    // Hash the token to compare with stored hash
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Set new password
    user.password = password;
    user.isEmailVerified = true;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email with token
// @access  Public
router.post('/verify-email', [
  body('token').notEmpty().withMessage('Verification token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { token } = req.body;

    // Hash the token to compare with stored hash
    const crypto = require('crypto');
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/auth/test
// @desc    Test auth route
// @access  Public
router.get('/test', developmentOnly, (req, res) => {
  res.json({
    success: true,
    message: 'Auth route is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Temporary debug route (simplified)
router.get('/debug/users', developmentOnly, async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.status(200).json({
      success: true,
      userCount: userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', protect, auditLog('logout'), (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Simple test login endpoint - bypasses all middleware
router.post('/test-login', developmentOnly, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email).select('+password');
    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res.json({ success: false, message: 'Invalid credentials' });
    }

    res.json({ success: true, message: 'Test login successful', user: { email: user.email, role: user.role } });
  } catch (error) {
    logger.error('Development test login failed', { errorName: error?.name || 'Error' });
    res.json({ success: false, message: 'Error' });
  }
});

module.exports = router;
