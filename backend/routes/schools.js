const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const School = require('../models/School');
const User = require('../models/User');
const Report = require('../models/Report');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const crypto = require('node:crypto');
const { upload, uploadSchoolLogo, getSchoolLogo, deleteSchoolLogo } = require('../services/logoService');
const { sendWelcomeEmail } = require('../services/emailService');

const toPlainObject = value => value?.toObject ? value.toObject({ virtuals: true }) : { ...value };
const pickDefined = (source, fields) => fields.reduce((result, field) => {
  if (source && source[field] !== undefined) result[field] = source[field];
  return result;
}, {});
const safeCommunication = communication => ({
  whatsapp: pickDefined(communication?.whatsapp, ['enabled', 'phoneNumber', 'displayName']),
  email: pickDefined(communication?.email, ['enabled', 'fromName', 'fromEmail', 'replyTo']),
  sms: pickDefined(communication?.sms, ['enabled', 'phoneNumber'])
});
const organizationSchoolView = school => {
  const value = toPlainObject(school);
  return pickDefined({
    ...value,
    communication: safeCommunication(value.communication)
  }, [
    '_id', 'name', 'slug', 'accountType', 'organizationType', 'customOrganizationTypeLabel', 'terminologyProfile',
    'workspaceProfile', 'contactPerson', 'address', 'schoolType', 'gradeLevels',
    'estimatedStudents', 'estimatedParticipants', 'settings', 'branding',
    'communication', 'isActive', 'createdAt', 'updatedAt'
  ]);
};
const teacherSchoolView = school => {
  const value = toPlainObject(school);
  return pickDefined({
    ...value,
    settings: pickDefined(value.settings, ['timezone', 'language', 'dateFormat'])
  }, [
    '_id', 'name', 'slug', 'accountType', 'organizationType', 'customOrganizationTypeLabel', 'terminologyProfile',
    'workspaceProfile', 'settings', 'branding', 'isActive', 'updatedAt'
  ]);
};
const schoolViewFor = (user, school) => {
  if (user?.role === 'super_admin') return school;
  return user?.role === 'teacher' ? teacherSchoolView(school) : organizationSchoolView(school);
};
const schoolAdminUpdate = body => {
  const update = pickDefined(body, [
    'name', 'schoolType', 'gradeLevels', 'estimatedStudents', 'estimatedParticipants'
  ]);
  if (body.contactPerson !== undefined) {
    update.contactPerson = pickDefined(body.contactPerson, ['name', 'email', 'phone', 'role']);
  }
  if (body.address !== undefined) {
    update.address = pickDefined(body.address, ['street', 'city', 'state', 'zipCode', 'country']);
  }
  return update;
};

// Create an invited administrator without generating a reusable known password.
const generateSchoolAdminInvitation = async (contactPerson, schoolId) => {
  try {
    const nameParts = contactPerson.name.trim().split(' ');
    const firstName = nameParts[0] || 'School';
    const lastName = nameParts.slice(1).join(' ') || 'Admin';
    const schoolAdmin = new User({
      firstName,
      lastName,
      email: contactPerson.email,
      password: crypto.randomBytes(48).toString('base64url'),
      role: 'school_admin',
      schoolId,
      phone: contactPerson.phone,
      isActive: true,
      isEmailVerified: false
    });
    const activationToken = schoolAdmin.generatePasswordResetToken();
    await schoolAdmin.save();
    return { user: schoolAdmin, activationToken };
  } catch (error) {
    logger.error('Error creating school administrator invitation', {
      errorName: error?.name || 'Error',
      errorCode: error?.code || 'SCHOOL_ADMIN_INVITATION_FAILED'
    });
    throw error;
  }
};

// @route   GET /api/schools
// @desc    Get all schools
// @access  Private (Super Admin)
router.get('/', protect, authorize('super_admin'), async (req, res) => {
  try {
    const schools = await School.find().populate('contactPerson');
    
    res.json({
      success: true,
      data: schools
    });
  } catch (error) {
    logger.error('Error fetching schools:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching schools'
    });
  }
});

// @route   GET /api/schools/:id
// @desc    Get school by ID
// @access  Private (Super Admin, School Admin, Teacher)
router.get('/:id', protect, authorize('super_admin', 'school_admin', 'teacher'), async (req, res) => {
  try {
    const school = await School.findById(req.params.id).populate('contactPerson');
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Check if user has access to this school
    if ((req.user.role === 'school_admin' || req.user.role === 'teacher') && req.user.schoolId?.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: schoolViewFor(req.user, school)
    });
  } catch (error) {
    logger.error('Error fetching school:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching school'
    });
  }
});

// @route   PUT /api/schools/:id/settings
// @desc    Update school settings (timezone, calendar, report frequencies)
// @access  Private (Super Admin, School Admin)
router.put('/:id/settings', protect, authorize('super_admin', 'school_admin'), async (req, res) => {
  try {
    const { timezone, calendar, reportFrequencies } = req.body;
    
    // Debug logging
    if (reportFrequencies?.Daily) {
      logger.info('📝 Daily frequency update received:', {
        workingDays: reportFrequencies.Daily.workingDays,
        dueTime: reportFrequencies.Daily.dueTime,
        enabled: reportFrequencies.Daily.enabled
      });
    }
    
    // Check if user has access to this school
    if (req.user.role === 'school_admin' && req.user.schoolId?.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const school = await School.findById(req.params.id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Update settings
    const updateData = {};
    
    if (timezone) {
      updateData['settings.timezone'] = timezone;
    }
    
    if (calendar) {
      updateData['settings.calendar'] = calendar;
    }
    
    if (reportFrequencies) {
      updateData['settings.reportFrequencies'] = reportFrequencies;
    }

    logger.info('📝 Update data being saved:', {
      updateData: JSON.stringify(updateData, null, 2)
    });

    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.info('✅ School settings updated successfully');
    
    // Log the saved Daily config for verification
    if (updatedSchool.settings?.reportFrequencies?.Daily) {
      logger.info('📝 Saved Daily config:', {
        workingDays: updatedSchool.settings.reportFrequencies.Daily.workingDays,
        dueTime: updatedSchool.settings.reportFrequencies.Daily.dueTime
      });
    }

    res.json({
      success: true,
      message: 'School settings updated successfully',
      data: schoolViewFor(req.user, updatedSchool)
    });
  } catch (error) {
    logger.error('Error updating school settings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating school settings'
    });
  }
});

// @route   POST /api/schools
// @desc    Create a new school
// @access  Private (Super Admin)
router.post('/', [
  protect,
  authorize('super_admin'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('School name must be between 2 and 100 characters'),
  body('slug').trim().isLength({ min: 2, max: 50 }).withMessage('Slug must be between 2 and 50 characters'),
  body('schoolType').trim().isIn(['licensed_daycare', 'montessori_school', 'public_private_school']).withMessage('Invalid school type'),
  body('estimatedStudents').isInt({ min: 1 }).withMessage('Estimated students must be at least 1'),
  body('gradeLevels').isArray().withMessage('Grade levels must be an array'),
  body('address.street').trim().notEmpty().withMessage('Street address is required'),
  body('address.city').trim().notEmpty().withMessage('City is required'),
  body('address.state').trim().notEmpty().withMessage('State is required'),
  body('address.zipCode').trim().notEmpty().withMessage('Zip code is required'),
  body('address.country').trim().notEmpty().withMessage('Country is required'),
  body('contactPerson.name').trim().notEmpty().withMessage('Contact person name is required'),
  body('contactPerson.email').isEmail().withMessage('Contact person email must be valid'),
  body('contactPerson.phone').trim().notEmpty().withMessage('Contact person phone is required'),
  body('contactPerson.role').trim().notEmpty().withMessage('Contact person role is required'),
  body('subscription.plan').isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan'),
  body('settings.timezone').optional().isString().withMessage('Timezone must be a valid string')
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

    const {
      name,
      slug,
      schoolType,
      estimatedStudents,
      gradeLevels,
      address,
      contactPerson,
      subscription,
      settings
    } = req.body;

    // Check if school with same slug already exists
    const existingSchool = await School.findOne({ slug });
    if (existingSchool) {
      return res.status(400).json({
        success: false,
        message: 'School with this slug already exists'
      });
    }

    const existingAdmin = await User.findByEmail(contactPerson.email);
    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message: 'An account with the administrator email already exists'
      });
    }

    // Create school
    const school = new School({
      name,
      slug,
      schoolType,
      estimatedStudents,
      gradeLevels,
      address,
      contactPerson,
      subscription,
      settings,
      isActive: true
    });

    await school.save();

    let schoolAdminInvitation = null;
    try {
      schoolAdminInvitation = await generateSchoolAdminInvitation(contactPerson, school._id);
      logger.info(`School admin account created for ${contactPerson.email} at school ${school.name}`);
    } catch (error) {
      logger.error('Failed to create school admin account', { errorName: error?.name || 'Error' });
    }

    let invitationSent = false;
    try {
      if (schoolAdminInvitation) {
        const activationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(schoolAdminInvitation.activationToken)}`;
        await sendWelcomeEmail({
          schoolName: school.name,
          contactPersonName: contactPerson.name,
          contactPersonEmail: contactPerson.email,
          administratorEmail: schoolAdminInvitation.user.email,
          activationUrl
        });
        invitationSent = true;
        logger.info(`Welcome email sent successfully to ${contactPerson.email} for school ${school.name}`);
      }
    } catch (error) {
      logger.error('Failed to send school administrator invitation', { errorName: error?.name || 'Error' });
    }

    res.status(201).json({
      success: true,
      message: 'School created successfully',
      data: school,
      schoolAdmin: schoolAdminInvitation ? {
        email: schoolAdminInvitation.user.email,
        firstName: schoolAdminInvitation.user.firstName,
        lastName: schoolAdminInvitation.user.lastName,
        invitationSent
      } : null
    });
  } catch (error) {
    logger.error('Error creating school:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating school'
    });
  }
});

// @route   PUT /api/schools/:id
// @desc    Update school
// @access  Private (Super Admin, School Admin)
router.put('/:id', [
  protect,
  authorize('super_admin', 'school_admin'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('School name must be between 2 and 100 characters'),
  body('schoolType').optional().trim().isIn(['licensed_daycare', 'montessori_school', 'public_private_school']).withMessage('Invalid school type'),
  body('estimatedStudents').optional().isInt({ min: 1 }).withMessage('Estimated students must be at least 1'),
  body('gradeLevels').optional().isArray().withMessage('Grade levels must be an array'),
  body('contactPerson.email').optional().isEmail().withMessage('Contact person email must be valid'),
  body('subscription.plan').optional().isIn(['basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan')
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

    const school = await School.findById(req.params.id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Check if user has access to this school
    if (req.user.role === 'school_admin' && req.user.schoolId?.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const updateData = req.user.role === 'super_admin' ? req.body : schoolAdminUpdate(req.body);

    // Update only fields authorized for the caller's role.
    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'School updated successfully',
      data: schoolViewFor(req.user, updatedSchool)
    });
  } catch (error) {
    logger.error('Error updating school:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating school'
    });
  }
});

// @route   DELETE /api/schools/:id
// @desc    Delete school
// @access  Private (Super Admin)
router.delete('/:id', protect, authorize('super_admin'), async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    await School.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'School deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting school:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting school'
    });
  }
});

// @route   GET /api/schools/:id/reports
// @desc    Get all reports for a school
// @access  Private (Super Admin, School Admin)
router.get('/:id/reports', protect, authorize('super_admin', 'school_admin'), async (req, res) => {
  try {
    const schoolId = req.params.id;
    
    // Check if school exists
    const school = await School.findById(schoolId);
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Check if user has access to this school
    if (req.user.role === 'school_admin' && req.user.schoolId?.toString() !== schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get all reports for this school with populated student and teacher data
    const reports = await Report.find({ schoolId })
      .populate('studentId', 'firstName lastName grade studentGrade studentClass parentEmail')
      .populate('teacherId', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    logger.error('Error fetching school reports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching school reports'
    });
  }
});

// @route   PUT /api/schools/:id/branding
// @desc    Update school branding (colors, logo, etc.)
// @access  Private (School Admin, Super Admin)
router.put('/:id/branding', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { primaryColor, secondaryColor } = req.body;
    
    // Check if user has access to this school
    if (req.user.role === 'school_admin' && req.user.schoolId?.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const school = await School.findById(req.params.id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Update branding
    const updateData = {};
    
    if (primaryColor) {
      updateData['branding.primaryColor'] = primaryColor;
    }
    
    if (secondaryColor) {
      updateData['branding.secondaryColor'] = secondaryColor;
    }

    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.info(`School branding updated for school ${req.params.id} by user ${req.user._id}`);

    res.json({
      success: true,
      message: 'School branding updated successfully',
      data: {
        branding: updatedSchool.branding
      }
    });
  } catch (error) {
    logger.error('Error updating school branding:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating school branding',
      error: error.message
    });
  }
});

// @route   POST /api/schools/:id/logo
// @desc    Upload school logo
// @access  Private (School Admin, Super Admin)
router.post('/:id/logo', protect, authorize('school_admin', 'super_admin'), upload.single('logo'), uploadSchoolLogo);

// @route   GET /api/schools/:id/logo
// @desc    Get school logo URL
// @access  Private (School Admin, Super Admin)
router.get('/:id/logo', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = req.params.id;
    const logoUrl = await getSchoolLogo(schoolId);
    
    res.json({
      success: true,
      data: { logoUrl }
    });
  } catch (error) {
    logger.error('Error getting school logo:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting school logo'
    });
  }
});

// @route   DELETE /api/schools/:id/logo
// @desc    Delete school logo
// @access  Private (School Admin, Super Admin)
router.delete('/:id/logo', protect, authorize('school_admin', 'super_admin'), deleteSchoolLogo);

// @route   PUT /api/schools/:id/communication
// @desc    Update school communication settings (WhatsApp, Email, SMS)
// @access  Private (School Admin, Super Admin)
router.put('/:id/communication', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { whatsapp, email, sms } = req.body;
    
    // Check if user has access to this school
    if (req.user.role === 'school_admin' && req.user.schoolId?.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const school = await School.findById(req.params.id);
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Update communication settings
    const updateData = {};
    
    if (whatsapp) {
      if (whatsapp.enabled !== undefined) updateData['communication.whatsapp.enabled'] = whatsapp.enabled;
      if (whatsapp.phoneNumber !== undefined) updateData['communication.whatsapp.phoneNumber'] = whatsapp.phoneNumber;
      if (req.user.role === 'super_admin' && whatsapp.twilioAccountSid !== undefined) updateData['communication.whatsapp.twilioAccountSid'] = whatsapp.twilioAccountSid;
      if (req.user.role === 'super_admin' && whatsapp.twilioAuthToken !== undefined) updateData['communication.whatsapp.twilioAuthToken'] = whatsapp.twilioAuthToken;
      if (whatsapp.displayName !== undefined) updateData['communication.whatsapp.displayName'] = whatsapp.displayName;
    }
    
    if (email) {
      if (email.enabled !== undefined) updateData['communication.email.enabled'] = email.enabled;
      if (email.fromName !== undefined) updateData['communication.email.fromName'] = email.fromName;
      if (email.fromEmail !== undefined) updateData['communication.email.fromEmail'] = email.fromEmail;
      if (email.replyTo !== undefined) updateData['communication.email.replyTo'] = email.replyTo;
    }
    
    if (sms) {
      if (sms.enabled !== undefined) updateData['communication.sms.enabled'] = sms.enabled;
      if (sms.phoneNumber !== undefined) updateData['communication.sms.phoneNumber'] = sms.phoneNumber;
      if (req.user.role === 'super_admin' && sms.twilioAccountSid !== undefined) updateData['communication.sms.twilioAccountSid'] = sms.twilioAccountSid;
      if (req.user.role === 'super_admin' && sms.twilioAuthToken !== undefined) updateData['communication.sms.twilioAuthToken'] = sms.twilioAuthToken;
    }

    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.info(`School communication settings updated for school ${req.params.id} by user ${req.user._id}`);

    res.json({
      success: true,
      message: 'Communication settings updated successfully',
      data: {
        communication: req.user.role === 'super_admin'
          ? updatedSchool.communication
          : safeCommunication(updatedSchool.communication)
      }
    });
  } catch (error) {
    logger.error('Error updating school communication settings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
