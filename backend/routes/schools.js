const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const School = require('../models/School');
const User = require('../models/User');
const Report = require('../models/Report');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { upload, uploadSchoolLogo, getSchoolLogo, deleteSchoolLogo } = require('../services/logoService');
const { sendWelcomeEmail } = require('../services/emailService');

// Helper function to generate school admin login credentials
const generateSchoolAdminCredentials = async (contactPerson, schoolId) => {
  try {
    // Generate a simple, memorable password
    const password = 'TestSchool123';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Split contact person name into first and last name
    const nameParts = contactPerson.name.trim().split(' ');
    const firstName = nameParts[0] || 'School';
    const lastName = nameParts.slice(1).join(' ') || 'Admin';
    
    // Create the school admin user using updateOne with upsert to bypass pre-save middleware
    const result = await User.updateOne(
      { email: contactPerson.email },
      {
        $setOnInsert: {
          firstName,
          lastName,
          email: contactPerson.email,
          password: hashedPassword, // Already hashed, won't be re-hashed
          role: 'school_admin',
          schoolId: schoolId,
          phone: contactPerson.phone,
          isActive: true,
          isEmailVerified: false
        }
      },
      { upsert: true, new: true }
    );
    
    // Fetch the created/updated user
    const schoolAdmin = await User.findOne({ email: contactPerson.email });
    
    return {
      user: schoolAdmin,
      plainPassword: password
    };
  } catch (error) {
    logger.error('Error generating school admin credentials:', error);
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
      data: school
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

    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    logger.info(`School settings updated for school ${req.params.id} by user ${req.user._id}`);

    res.json({
      success: true,
      message: 'School settings updated successfully',
      data: updatedSchool
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

    // Auto-generate school admin login credentials
    let schoolAdminCredentials = null;
    try {
      schoolAdminCredentials = await generateSchoolAdminCredentials(contactPerson, school._id);
      logger.info(`School admin account created for ${contactPerson.email} at school ${school.name}`);
    } catch (error) {
      logger.error('Failed to create school admin account:', error);
      // Don't fail the school creation if admin creation fails
      // The super admin can manually create the admin account later
    }

    // Send welcome email to the contact person
    try {
      if (schoolAdminCredentials) {
        const dashboardUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
        
        await sendWelcomeEmail({
          schoolName: school.name,
          contactPersonName: contactPerson.name,
          contactPersonEmail: contactPerson.email,
          loginCredentials: {
            email: schoolAdminCredentials.user.email,
            password: schoolAdminCredentials.plainPassword
          },
          dashboardUrl: dashboardUrl
        });
        
        logger.info(`Welcome email sent successfully to ${contactPerson.email} for school ${school.name}`);
      }
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
      // Don't fail the school creation if email sending fails
      // The welcome email can be sent manually later
    }

    res.status(201).json({
      success: true,
      message: 'School created successfully',
      data: school,
      schoolAdmin: schoolAdminCredentials ? {
        email: schoolAdminCredentials.user.email,
        password: schoolAdminCredentials.plainPassword,
        firstName: schoolAdminCredentials.user.firstName,
        lastName: schoolAdminCredentials.user.lastName
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

    // Update school
    const updatedSchool = await School.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'School updated successfully',
      data: updatedSchool
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

module.exports = router; 