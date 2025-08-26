const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// Get all students for a school
router.get('/', protect, authorize('school_admin', 'super_admin', 'teacher', 'parent'), async (req, res) => {
  try {
    let query = { role: 'parent' }; // Students are stored as 'parent' role
    
    // Filter by school for school admins and teachers
    if (req.user.role === 'school_admin' || req.user.role === 'teacher') {
      query.schoolId = req.user.schoolId;
    }
    
    // For parent users, only return their own children
    if (req.user.role === 'parent') {
      query.parentId = req.user._id;
      query.schoolId = req.user.schoolId;
    }
    
    // Add search functionality
    if (req.query.search) {
      query.$or = [
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Add grade filter
    if (req.query.grade) {
      query.studentGrade = req.query.grade;
    }
    
    // Add teacher filter
    if (req.query.teacherId) {
      query.assignedTeacher = req.query.teacherId;
    }

    const students = await User.find(query)
      .populate('assignedTeacher', 'firstName lastName email')
      .populate('classId', 'name grade')
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: students,
      count: students.length
    });
  } catch (error) {
    logger.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students'
    });
  }
});

// Get a single student
router.get('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const query = { _id: req.params.id, role: 'parent' };
    
    // Filter by school for school admins
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const student = await User.findOne(query)
      .populate('assignedTeacher', 'firstName lastName email')
      .populate('classId', 'name grade')
      .select('-password');

    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (error) {
    logger.error('Error fetching student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student'
    });
  }
});

// Create a new student
router.post('/', [
  protect,
  authorize('school_admin', 'super_admin'),
  body('firstName').trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  // Student email is optional (students stored as role 'parent')
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('studentGrade').trim().notEmpty().withMessage('Grade is required'),
  body('parentName').trim().notEmpty().withMessage('Parent name is required'),
  // Parent email is required to receive reports
  body('parentEmail').isEmail().withMessage('Please provide a valid parent email'),
  body('parentPhone').optional().trim(),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date of birth'),
  body('enrollmentDate').optional().isISO8601().withMessage('Please provide a valid enrollment date'),
  body('academicLevel').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid academic level'),
  body('isActive').optional().isBoolean().withMessage('Status must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      firstName, 
      lastName, 
      email, 
      studentGrade, 
      parentName,
      parentEmail,
      parentPhone,
      studentClass,
      dateOfBirth,
      enrollmentDate,
      address,
      emergencyContact,
      medicalInfo,
      academicLevel,
      notes,
      isActive,
      ...otherFields 
    } = req.body;
    
    // Debug logging
    console.log('Backend - Received student data:', {
      firstName,
      lastName,
      email,
      studentGrade,
      parentName,
      parentEmail,
      parentPhone,
      studentClass,
      schoolId: req.user.schoolId,
      schoolIdType: typeof req.user.schoolId
    });

    // Check if email already exists (only if email is provided and not empty)
    if (email && email.trim()) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists',
          field: 'email',
          message: 'This email is already registered. Please use a different email or leave it empty.'
        });
      }
    }

    // Generate avatar initials
    const avatar = `${firstName[0]}${lastName[0]}`.toUpperCase();

    // If studentClass is provided, find the corresponding class and populate both studentClass and classId
    let classId = null;
    if (studentClass && studentClass.trim()) {
      try {
        const foundClass = await Class.findOne({ 
          schoolId: typeof req.user.schoolId === 'string' ? req.user.schoolId : req.user.schoolId._id,
          name: studentClass.trim()
        });
        
        if (foundClass) {
          classId = foundClass._id;
          logger.info(`Found class for student: ${studentClass} -> ${classId}`);
        } else {
          logger.warn(`Class not found for student: ${studentClass}`);
        }
      } catch (error) {
        logger.error('Error finding class for student:', error);
      }
    }

    // Prepare student data with all fields
    const studentData = {
      firstName,
      lastName,
      role: 'parent', // Students are stored as 'parent' role
      schoolId: typeof req.user.schoolId === 'string' ? req.user.schoolId : req.user.schoolId._id,
      studentGrade,
      parentName,
      parentEmail: parentEmail ? parentEmail.toLowerCase() : undefined,
      parentPhone,
      studentClass,
      classId, // Add the classId field
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      enrollmentDate: enrollmentDate ? new Date(enrollmentDate) : Date.now(),
      address,
      emergencyContact,
      medicalInfo,
      academicLevel: academicLevel || 'beginner',
      notes,
      isActive: isActive !== undefined ? isActive : true,
      avatar,
      ...otherFields
    };
    
    // Only include email if it's provided
    if (email && email.trim()) {
      studentData.email = email.toLowerCase();
    }

    const student = await User.create(studentData);

    logger.info(`Student account created: ${student.firstName} ${student.lastName} at school ${req.user.schoolId}`);

    // Create or update parent account for login access
    let parentAccount = null;
    try {
      // Check if a parent account already exists with this email
      parentAccount = await User.findOne({ 
        email: parentEmail.toLowerCase(),
        role: 'parent',
        schoolId: typeof req.user.schoolId === 'string' ? req.user.schoolId : req.user.schoolId._id
      });

      if (!parentAccount) {
        // Create new parent account
        const nameParts = parentName.split(' ');
        const parentFirstName = nameParts[0] || 'Parent';
        const parentLastName = nameParts.slice(1).join(' ') || 'User';
        
        parentAccount = await User.create({
          firstName: parentFirstName,
          lastName: parentLastName,
          email: parentEmail.toLowerCase(),
          password: 'Parent123!', // Default password - should be changed on first login
          role: 'parent',
          schoolId: typeof req.user.schoolId === 'string' ? req.user.schoolId : req.user.schoolId._id,
          phone: parentPhone,
          isActive: true,
          isEmailVerified: false,
          avatar: `${parentFirstName[0]}${parentLastName[0]}`.toUpperCase(),
          // Store parent-specific info
          parentName: parentName,
          parentEmail: parentEmail.toLowerCase(),
          parentPhone: parentPhone
        });

        logger.info(`Parent account created: ${parentEmail} for student ${student.firstName} ${student.lastName}`);
        
        // TODO: Send welcome email to parent with login credentials
        // await emailService.sendParentWelcomeEmail({
        //   parentEmail: parentEmail,
        //   parentName: parentName,
        //   studentName: `${student.firstName} ${student.lastName}`,
        //   schoolName: school.name,
        //   defaultPassword: 'Parent123!'
        // });
      } else {
        logger.info(`Parent account already exists: ${parentEmail} - student added to existing parent`);
      }

      // Link student to parent account
      student.parentId = parentAccount._id;
      await student.save();

    } catch (parentError) {
      logger.error('Error creating parent account:', parentError);
      // Don't fail student creation if parent account creation fails
      // The parent can be created manually later
    }

    res.status(201).json({
      success: true,
      data: student,
      message: 'Student created successfully',
      parentAccount: parentAccount ? {
        email: parentAccount.email,
        hasAccount: true
      } : null
    });
  } catch (error) {
    logger.error('Error creating student:', error);
    
    // Handle duplicate key errors specifically
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = 'Duplicate value error';
      let fieldName = field;
      
      if (field === 'email') {
        message = 'This email is already registered. Please use a different email or leave it empty.';
        fieldName = 'email';
      }
      
      return res.status(400).json({
        success: false,
        error: 'Duplicate value error',
        field: fieldName,
        message: message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create student',
      message: 'An unexpected error occurred while creating the student.'
    });
  }
});

// Update a student
router.put('/:id', [
  protect,
  authorize('school_admin', 'super_admin'),
  body('firstName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
  body('lastName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('studentGrade').optional().trim().notEmpty().withMessage('Grade is required'),
  body('parentName').optional().trim().notEmpty().withMessage('Parent name is required'),
  body('parentEmail').optional().isEmail().withMessage('Please provide a valid parent email'),
  body('parentPhone').optional().trim(),
  body('studentClass').optional().trim(),
  body('dateOfBirth').optional().isISO8601().withMessage('Please provide a valid date of birth'),
  body('enrollmentDate').optional().isISO8601().withMessage('Please provide a valid enrollment date'),
  body('academicLevel').optional().isIn(['beginner', 'intermediate', 'advanced']).withMessage('Invalid academic level'),
  body('isActive').optional().isBoolean().withMessage('Status must be a boolean'),
  body('assignedTeacher').optional().isMongoId().withMessage('Valid teacher ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const query = { _id: req.params.id, role: 'parent' };
    
    // Filter by school for school admins
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const student = await User.findOne(query);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // If email is being changed, check for duplicates
    if (req.body.email && req.body.email !== student.email) {
      const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
    }

    // If teacher is being changed, verify new teacher and update counts
    if (req.body.assignedTeacher && req.body.assignedTeacher !== student.assignedTeacher.toString()) {
      const newTeacher = await User.findOne({ 
        _id: req.body.assignedTeacher, 
        role: 'teacher',
        schoolId: req.user.schoolId 
      });
      
      if (!newTeacher) {
        return res.status(400).json({
          success: false,
          error: 'Invalid teacher or teacher not found in your school'
        });
      }

      // Decrease old teacher's student count
      if (student.assignedTeacher) {
        await User.findByIdAndUpdate(student.assignedTeacher, {
          $inc: { students: -1 }
        });
      }

      // Increase new teacher's student count
      await User.findByIdAndUpdate(req.body.assignedTeacher, {
        $inc: { students: 1 }
      });
    }

    // If studentClass is being updated, find the corresponding class and populate both studentClass and classId
    if (req.body.studentClass && req.body.studentClass.trim()) {
      try {
        const foundClass = await Class.findOne({ 
          schoolId: typeof req.user.schoolId === 'string' ? req.user.schoolId : req.user.schoolId._id,
          name: req.body.studentClass.trim()
        });
        
        if (foundClass) {
          req.body.classId = foundClass._id;
          logger.info(`Found class for student update: ${req.body.studentClass} -> ${foundClass._id}`);
        } else {
          req.body.classId = null;
          logger.warn(`Class not found for student update: ${req.body.studentClass}`);
        }
      } catch (error) {
        logger.error('Error finding class for student update:', error);
        req.body.classId = null;
      }
    } else if (req.body.studentClass === '' || req.body.studentClass === null) {
      // If studentClass is being cleared, also clear classId
      req.body.classId = null;
    }

    // Prepare update data with proper field handling
    const updateData = { ...req.body };
    
    // Handle date fields
    if (req.body.dateOfBirth) {
      updateData.dateOfBirth = new Date(req.body.dateOfBirth);
    }
    if (req.body.enrollmentDate) {
      updateData.enrollmentDate = new Date(req.body.enrollmentDate);
    }
    
    // Handle email fields
    if (req.body.email) {
      updateData.email = req.body.email.toLowerCase();
    }
    if (req.body.parentEmail) {
      updateData.parentEmail = req.body.parentEmail.toLowerCase();
    }
    
    // Handle boolean fields
    if (req.body.isActive !== undefined) {
      updateData.isActive = req.body.isActive;
    }

    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('assignedTeacher', 'firstName lastName email')
    .populate('classId', 'name grade')
    .select('-password');

    res.json({
      success: true,
      data: updatedStudent,
      message: 'Student updated successfully'
    });
  } catch (error) {
    logger.error('Error updating student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update student'
    });
  }
});

// Delete a student
router.delete('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const query = { _id: req.params.id, role: 'parent' };
    
    // Filter by school for school admins
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const student = await User.findOne(query);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Decrease teacher's student count
    if (student.assignedTeacher) {
      await User.findByIdAndUpdate(student.assignedTeacher, {
        $inc: { students: -1 }
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting student:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete student'
    });
  }
});

// Assign students to teacher (bulk assignment)
router.post('/assign-teacher', [
  protect,
  authorize('school_admin', 'super_admin'),
  body('teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  body('studentIds').isArray().withMessage('Student IDs must be an array'),
  body('studentIds.*').isMongoId().withMessage('Each student ID must be valid')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array()
      });
    }

    const { teacherId, studentIds } = req.body;

    // Verify teacher exists and belongs to the same school
    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      schoolId: req.user.schoolId 
    });
    
    if (!teacher) {
      return res.status(400).json({
        success: false,
        error: 'Invalid teacher or teacher not found in your school'
      });
    }

    // Get current students assigned to this teacher
    const currentStudents = await User.find({ 
      assignedTeacher: teacherId,
      role: 'parent',
      schoolId: req.user.schoolId 
    });

    // Remove students from current teacher
    if (currentStudents.length > 0) {
      await User.updateMany(
        { _id: { $in: currentStudents.map(s => s._id) } },
        { $unset: { assignedTeacher: 1 } }
      );
      
      // Decrease teacher's student count
      await User.findByIdAndUpdate(teacherId, {
        $inc: { students: -currentStudents.length }
      });
    }

    // Assign new students to teacher
    if (studentIds.length > 0) {
      await User.updateMany(
        { _id: { $in: studentIds }, role: 'parent', schoolId: req.user.schoolId },
        { assignedTeacher: teacherId }
      );
      
      // Increase teacher's student count
      await User.findByIdAndUpdate(teacherId, {
        $inc: { students: studentIds.length }
      });
    }

    res.json({
      success: true,
      message: `Successfully assigned ${studentIds.length} students to teacher`
    });
  } catch (error) {
    logger.error('Error assigning students to teacher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign students to teacher'
    });
  }
});

module.exports = router; 