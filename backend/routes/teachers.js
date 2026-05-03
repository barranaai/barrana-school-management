const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const router = express.Router();
const User = require('../models/User');
const Class = require('../models/Class');
const Report = require('../models/Report');
const School = require('../models/School');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { sendTeacherWelcomeEmail } = require('../services/emailService');

// Helper function to generate a secure random password
const generateSecurePassword = () => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    password += charset[randomBytes[i] % charset.length];
  }
  
  return password;
};

// @desc    Get all teachers for a school
// @route   GET /api/teachers
// @access  Private (School Admin, Super Admin, Teacher)
router.get('/', protect, authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const query = { role: 'teacher' };
    
    // If school admin or teacher, only show teachers from their school
    if (req.user.role === 'school_admin' || req.user.role === 'teacher') {
      query.schoolId = req.user.schoolId;
    }
    
    const teachers = await User.find(query)
      .select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires')
      .populate('schoolId', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: teachers,
      count: teachers.length
    });
  } catch (error) {
    logger.error('Error fetching teachers:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teachers'
    });
  }
});

// @desc    Get students assigned to a teacher through their classes
// @route   GET /api/teachers/:id/students
// @access  Private (Teacher, School Admin, Super Admin)
router.get('/:id/students', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const teacherId = req.params.id;
    
    // Verify the teacher exists and user has permission
    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // If teacher is accessing their own data, allow it
    // If school admin, verify teacher is from their school
    if (req.user.role === 'teacher' && req.user._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own students'
      });
    }

    if (req.user.role === 'school_admin' && req.user.schoolId.toString() !== teacher.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only access teachers from your school'
      });
    }

    // Get teacher's assigned classes
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacherId,
      isActive: true
    });

    // Get students from teacher's assigned classes
    const students = await User.find({
      role: 'student', // Students are stored as 'student' role
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId
    }).select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    logger.info(`Fetched ${students.length} students for teacher ${teacherId}`);

    res.json({
      success: true,
      data: students,
      count: students.length
    });
  } catch (error) {
    logger.error('Error fetching teacher students:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teacher students'
    });
  }
});

// @desc    Get reports for a teacher's students
// @route   GET /api/teachers/:id/reports
// @access  Private (Teacher, School Admin, Super Admin)
router.get('/:id/reports', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const teacherId = req.params.id;
    
    // Verify the teacher exists and user has permission
    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    // If teacher is accessing their own data, allow it
    // If school admin, verify teacher is from their school
    if (req.user.role === 'teacher' && req.user._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        message: 'You can only access your own reports'
      });
    }

    if (req.user.role === 'school_admin' && req.user.schoolId.toString() !== teacher.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only access teachers from your school'
      });
    }

    // Get teacher's assigned classes
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacherId,
      isActive: true
    });

    // Get students from teacher's assigned classes
    const teacherStudents = await User.find({
      role: 'student', // Students are stored as 'student' role
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId
    });

    // Get reports for these students
    const reports = await Report.find({
      studentId: { $in: teacherStudents.map(student => student._id) }
    }).populate('studentId') // Include all fields to debug
      .populate('teacherId', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Get all unique class names from the students
    const classNames = [...new Set(teacherStudents.map(student => student.studentClass).filter(Boolean))];
    
    // Fetch class information to get grades
    const classes = await Class.find({
      name: { $in: classNames },
      schoolId: teacher.schoolId
    }).select('name grade');
    
    // Create a lookup map for class name to grade
    const classToGradeMap = {};
    classes.forEach(cls => {
      classToGradeMap[cls.name] = cls.grade;
    });

    // Add grade information to reports based on student's class
    const reportsWithGrade = reports.map(report => {
      const reportObj = report.toObject();
      if (reportObj.studentId && reportObj.studentId.studentClass) {
        reportObj.studentId.grade = classToGradeMap[reportObj.studentId.studentClass] || 'Unknown';
      }
      return reportObj;
    });

    // Debug: Log populated student data
    console.log('🔍 Debug - Teacher students found:', teacherStudents.length);
    console.log('🔍 Debug - Class to grade mapping:', classToGradeMap);
    console.log('🔍 Debug - Teacher students sample:', teacherStudents.slice(0, 2).map(s => ({
      id: s._id,
      name: `${s.firstName} ${s.lastName}`,
      studentGrade: s.studentGrade,
      studentClass: s.studentClass,
      classGrade: classToGradeMap[s.studentClass],
      role: s.role
    })));
    
    console.log('🔍 Debug - Reports found:', reports.length);
    if (reportsWithGrade.length > 0) {
      console.log('🔍 Debug - First report student data:', {
        studentId: reportsWithGrade[0].studentId,
        studentType: typeof reportsWithGrade[0].studentId,
        studentClass: reportsWithGrade[0].studentId?.studentClass,
        grade: reportsWithGrade[0].studentId?.grade,
        studentFields: reportsWithGrade[0].studentId ? Object.keys(reportsWithGrade[0].studentId) : 'null'
      });
    }

    logger.info(`Fetched ${reports.length} reports for teacher ${teacherId}`);

    res.json({
      success: true,
      data: reportsWithGrade,
      count: reportsWithGrade.length
    });
  } catch (error) {
    logger.error('Error fetching teacher reports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teacher reports'
    });
  }
});

// @desc    Create new teacher
// @route   POST /api/teachers
// @access  Private (School Admin, Super Admin)
router.post('/', [
  protect,
  authorize('school_admin', 'super_admin'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('phone').optional({ checkFalsy: true }).trim().matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone number must be in E.164 format (e.g., +1234567890)'),
  body('grade').trim().notEmpty().withMessage('Grade is required'),
  body('specialization').optional({ checkFalsy: true }).trim(),
  body('qualifications').optional({ checkFalsy: true }).trim(),
  body('bio').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('hireDate').optional({ checkFalsy: true }).isISO8601().withMessage('Please provide a valid hire date'),
  body('subjects').optional({ checkFalsy: true }).isArray().withMessage('Subjects must be an array'),
  body('canEmailReports').optional({ checkFalsy: true }).isBoolean().withMessage('canEmailReports must be a boolean'),
  body('schoolId').optional({ checkFalsy: true }).isMongoId().withMessage('Valid school ID is required when provided')
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

    const {
      firstName,
      lastName,
      email,
      phone,
      grade,
      specialization,
      qualifications,
      bio,
      hireDate,
      subjects,
      schoolId: providedSchoolId,
      canEmailReports
    } = req.body;

    // Generate secure random password
    const generatedPassword = generateSecurePassword();

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Determine the school ID to use
    let schoolId;
    if (req.user.role === 'school_admin') {
      // School admins can only create teachers for their own school
      schoolId = req.user.schoolId;
    } else if (req.user.role === 'super_admin') {
      // Super admins can create teachers for any school
      schoolId = providedSchoolId;
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'School ID is required for super admin'
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to create teachers'
      });
    }

    // Generate avatar initials
    const avatar = `${firstName[0]}${lastName[0]}`.toUpperCase();

    const teacher = new User({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: generatedPassword,
      phone,
      role: 'teacher',
      schoolId,
      grade,
      specialization,
      qualifications,
      bio,
      hireDate: hireDate ? new Date(hireDate) : undefined,
      subjects: subjects || [],
      avatar,
      isActive: true,
      isEmailVerified: true, // Auto-verify admin-created accounts
      canEmailReports: !!canEmailReports
    });

    await teacher.save();

    logger.info(`Teacher account created successfully:`, {
      email: email,
      schoolId: schoolId,
      passwordGenerated: true,
      passwordLength: generatedPassword.length,
      isEmailVerified: teacher.isEmailVerified,
      isActive: teacher.isActive
    });

    // Send welcome email to teacher with credentials
    try {
      const school = await School.findById(schoolId);
      await sendTeacherWelcomeEmail({
        teacherEmail: email,
        teacherName: `${firstName} ${lastName}`,
        temporaryPassword: generatedPassword,
        schoolName: school?.name || 'Your School',
        schoolEmail: school?.email || '',
        loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        schoolId: schoolId,
        schoolBranding: school?.branding || {}
      });
      logger.info(`Welcome email sent to teacher: ${email}`);
    } catch (emailError) {
      logger.error(`Failed to send welcome email to teacher ${email}:`, emailError);
      // Don't fail the request if email fails
    }

    // Remove password from response
    const teacherResponse = teacher.toObject();
    delete teacherResponse.password;

    res.status(201).json({
      success: true,
      data: teacherResponse,
      generatedPassword: generatedPassword, // Return password to show to admin
      message: 'Teacher created successfully'
    });
  } catch (error) {
    logger.error('Error creating teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating teacher'
    });
  }
});

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private (School Admin, Super Admin)
router.put('/:id', [
  protect,
  authorize('school_admin', 'super_admin'),
  body('firstName').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email'),
  body('phone').optional({ checkFalsy: true }).trim().matches(/^\+[1-9]\d{7,14}$/).withMessage('Phone number must be in E.164 format (e.g., +1234567890)'),
  body('grade').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Grade cannot be empty'),
  body('specialization').optional({ checkFalsy: true }).trim(),
  body('qualifications').optional({ checkFalsy: true }).trim(),
  body('bio').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('hireDate').optional({ checkFalsy: true }).isISO8601().withMessage('Please provide a valid hire date'),
  body('subjects').optional({ checkFalsy: true }).isArray().withMessage('Subjects must be an array'),
  body('canEmailReports').optional({ checkFalsy: true }).isBoolean().withMessage('canEmailReports must be a boolean')
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

    const query = { _id: req.params.id, role: 'teacher' };
    
    // If school admin, only update teachers from their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const teacher = await User.findOne(query);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      grade,
      specialization,
      qualifications,
      bio,
      hireDate,
      subjects,
      isActive,
      canEmailReports
    } = req.body;

    // Check if email is being changed and if it already exists
    if (email && email.toLowerCase() !== teacher.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }

    // Update fields
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName;
    if (lastName) updateFields.lastName = lastName;
    if (email) updateFields.email = email.toLowerCase();
    if (phone) updateFields.phone = phone;
    if (grade) updateFields.grade = grade;
    if (specialization !== undefined) updateFields.specialization = specialization;
    if (qualifications !== undefined) updateFields.qualifications = qualifications;
    if (bio !== undefined) updateFields.bio = bio;
    if (hireDate) updateFields.hireDate = new Date(hireDate);
    if (subjects) updateFields.subjects = subjects;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (canEmailReports !== undefined) updateFields.canEmailReports = !!canEmailReports;

    const updatedTeacher = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires');

    logger.info(`Teacher updated: ${updatedTeacher.email}`);

    res.json({
      success: true,
      data: updatedTeacher,
      message: 'Teacher updated successfully'
    });
  } catch (error) {
    logger.error('Error updating teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating teacher'
    });
  }
});

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private (School Admin, Super Admin)
router.delete('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const query = { _id: req.params.id, role: 'teacher' };
    
    // If school admin, only delete teachers from their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const teacher = await User.findOne(query);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Teacher not found'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    logger.info(`Teacher deleted: ${teacher.email}`);

    res.json({
      success: true,
      message: 'Teacher deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting teacher:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting teacher'
    });
  }
});

// @desc    Get teacher statistics
// @route   GET /api/teachers/stats/overview
// @access  Private (School Admin, Super Admin)
router.get('/stats/overview', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const query = { role: 'teacher' };
    
    // If school admin, only show stats for their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const teachers = await User.find(query);
    
    const stats = {
      totalTeachers: teachers.length,
      activeTeachers: teachers.filter(t => t.isActive).length,
      totalReports: teachers.reduce((sum, t) => sum + (t.reportsGenerated || 0), 0),
      avgReportsPerTeacher: Math.round(teachers.reduce((sum, t) => sum + (t.reportsGenerated || 0), 0) / teachers.length) || 0,
      avgEfficiency: Math.round(teachers.reduce((sum, t) => sum + (t.efficiency || 0), 0) / teachers.length) || 0,
      avgTimePerReport: Math.round(teachers.reduce((sum, t) => sum + (t.avgTimePerReport || 0), 0) / teachers.length) || 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching teacher stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teacher statistics'
    });
  }
});

// @desc    Get teacher notifications
// @route   GET /api/teachers/me/notifications
// @access  Private (Teacher only)
router.get('/me/notifications', protect, authorize('teacher'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sort notifications by createdAt (most recent first)
    const sortedNotifications = (user.notifications || []).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      data: {
        notifications: sortedNotifications,
        unreadCount: sortedNotifications.filter(n => !n.read).length
      }
    });
  } catch (error) {
    logger.error('Error fetching teacher notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications',
      error: error.message
    });
  }
});

// @desc    Get teacher's school branding (for mobile app)
// @route   GET /api/teachers/me/school-branding
// @access  Private (Teacher only)
router.get('/me/school-branding', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await User.findById(req.user._id).select('schoolId');
    
    if (!teacher || !teacher.schoolId) {
      return res.status(404).json({
        success: false,
        message: 'Teacher or school not found'
      });
    }

    const School = require('../models/School');
    const school = await School.findById(teacher.schoolId).select('name branding logo updatedAt');

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Canonical path from School Configuration is branding.logo (/uploads/logos/…).
    // Return it as stored (relative). Clients resolve against their API/public origin
    // so logos work in dev (CRA proxy), staging, and production without hard-coded hosts.
    const logoPath = school.branding?.logo || school.logo || null;

    res.json({
      success: true,
      data: {
        schoolId: school._id,
        schoolName: school.name,
        updatedAt: school.updatedAt,
        logo: logoPath,
        branding: {
          primaryColor: school.branding?.primaryColor || '#667eea',
          secondaryColor: school.branding?.secondaryColor || '#764ba2',
          logo: logoPath
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching teacher school branding:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching school branding',
      error: error.message
    });
  }
});

module.exports = router; 