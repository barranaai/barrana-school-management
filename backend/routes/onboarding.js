const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const {
  PUBLIC_START_MESSAGE,
  OnboardingError,
  issueOnboardingRequest,
  validateOnboardingToken,
  completeOnboarding
} = require('../services/onboardingService');
const { sendEmail } = require('../utils/email');
const { logger } = require('../utils/logger');

const router = express.Router();
const publicLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 25 : 5,
  message: { success: false, message: 'Too many onboarding attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const allowedFields = fields => (req, res, next) => {
  const unexpected = Object.keys(req.body || {}).filter(key => !fields.includes(key));
  if (unexpected.length) {
    return res.status(400).json({ success: false, message: 'The request contains unsupported fields.' });
  }
  next();
};

const validationFailure = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    success: false,
    message: 'Please check the information provided.',
    errors: errors.array().map(error => ({ field: error.path, message: error.msg }))
  });
};

const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

async function sendVerificationStep(delivery) {
  if (!delivery.shouldSend) return;
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const verificationUrl = `${frontendUrl}/onboarding/verify#token=${encodeURIComponent(delivery.token)}`;
  const safeName = escapeHtml(delivery.firstName);
  await sendEmail({
    email: delivery.email,
    subject: 'Continue setting up your Kidsible workspace',
    html: `<p>Hello ${safeName},</p><p>Confirm your email to continue setting up your Kidsible workspace.</p><p><a href="${verificationUrl}">Continue setup</a></p><p>This link expires in 24 hours.</p>`,
    text: `Hello ${delivery.firstName},\n\nConfirm your email to continue setting up your Kidsible workspace:\n${verificationUrl}\n\nThis link expires in 24 hours.`
  });
}

async function startHandler(req, res) {
  try {
    const delivery = await issueOnboardingRequest(req.body);
    try {
      await sendVerificationStep(delivery);
    } catch (error) {
      logger.warn('Onboarding verification delivery failed', { errorName: error?.name || 'Error' });
    }
    return res.status(202).json({ success: true, message: PUBLIC_START_MESSAGE });
  } catch (error) {
    logger.error('Onboarding start failed', {
      errorName: error?.name || 'Error',
      errorCode: error?.code || 'ONBOARDING_START_FAILED'
    });
    return res.status(503).json({
      success: false,
      message: 'Onboarding is temporarily unavailable. Please try again later.'
    });
  }
}

router.post('/start', [
  publicLimiter,
  allowedFields(['firstName', 'lastName', 'email']),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('Enter a valid first name.'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Enter a valid last name.'),
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email address.'),
  validationFailure
], startHandler);

router.post('/resend', [
  publicLimiter,
  allowedFields(['email']),
  body('email').isEmail().normalizeEmail().withMessage('Enter a valid email address.'),
  validationFailure
], async (req, res) => {
  req.body = { email: req.body.email, resend: true };
  return startHandler(req, res);
});

router.post('/verify', [
  publicLimiter,
  allowedFields(['token']),
  body('token').isString().isLength({ min: 32, max: 256 }).withMessage('The onboarding link is invalid or expired.'),
  validationFailure
], async (req, res) => {
  try {
    const request = await validateOnboardingToken(req.body.token);
    return res.json({ success: true, data: { valid: true, expiresAt: request.expiresAt } });
  } catch (error) {
    return res.status(error instanceof OnboardingError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof OnboardingError ? error.message : 'Unable to verify this onboarding link.'
    });
  }
});

router.post('/complete', [
  publicLimiter,
  allowedFields([
    'token', 'password', 'accountType', 'organizationType',
    'customOrganizationTypeLabel', 'workspaceName', 'phone',
    'estimatedParticipants', 'schoolType', 'estimatedStudents',
    'address', 'standardPackageId'
  ]),
  body('token').isString().isLength({ min: 32, max: 256 }).withMessage('The onboarding link is invalid or expired.'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters.'),
  body('accountType').isIn(['organization', 'solo_practitioner']).withMessage('Choose a valid account type.'),
  body('organizationType').optional().isString().withMessage('Choose a valid organization type.'),
  body('workspaceName').trim().isLength({ min: 2, max: 100 }).withMessage('Workspace name must be between 2 and 100 characters.'),
  body('customOrganizationTypeLabel').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Enter a valid organization type.'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 30 }).withMessage('Enter a valid phone number.'),
  body('estimatedParticipants').optional().isInt({ min: 0 }).withMessage('Estimated participants cannot be negative.'),
  body('estimatedStudents').optional().isInt({ min: 1 }).withMessage('Estimated students must be at least 1.'),
  body('standardPackageId').optional({ values: 'falsy' }).isMongoId().withMessage('Choose a valid Standard Package.'),
  validationFailure
], async (req, res) => {
  try {
    const result = await completeOnboarding(req.body);
    const workspace = result.workspace;
    const owner = result.owner;
    return res.status(201).json({
      success: true,
      message: 'Your Kidsible workspace is ready.',
      data: {
        user: {
          id: owner._id,
          firstName: owner.firstName,
          lastName: owner.lastName,
          email: owner.email,
          role: owner.role,
          schoolId: {
            _id: workspace._id,
            name: workspace.name,
            slug: workspace.slug,
            accountType: workspace.accountType,
            organizationType: workspace.organizationType,
            terminologyProfile: workspace.terminologyProfile
          },
          isEmailVerified: owner.isEmailVerified
        },
        token: result.token,
        standardPackageAdopted: Boolean(result.adoption)
      }
    });
  } catch (error) {
    if (!(error instanceof OnboardingError)) {
      logger.error('Onboarding completion failed', {
        errorName: error?.name || 'Error',
        errorCode: error?.code || 'ONBOARDING_COMPLETION_FAILED'
      });
    }
    return res.status(error instanceof OnboardingError ? error.statusCode : 500).json({
      success: false,
      message: error instanceof OnboardingError ? error.message : 'Unable to create the workspace.'
    });
  }
});

module.exports = router;
