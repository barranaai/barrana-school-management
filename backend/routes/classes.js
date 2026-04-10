const express = require('express');
const { body, validationResult } = require('express-validator');
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

// @desc    Get all classes for a school
// @route   GET /api/classes
// @access  Private (School Admin, Super Admin)
router.get('/', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    let query = { isActive: true };
    
    // If school admin, only show classes from their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }
    
    const classes = await Class.find(query)
      .populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Build live enrollment count: count active students whose classId or studentClass matches
    const classIds = classes.map(c => c._id);
    const enrollmentAgg = await User.aggregate([
      {
        $match: {
          role: 'student',
          isActive: true,
          classId: { $in: classIds }
        }
      },
      {
        $group: {
          _id: '$classId',
          count: { $sum: 1 }
        }
      }
    ]);
    const enrollmentMap = {};
    enrollmentAgg.forEach(e => { enrollmentMap[e._id.toString()] = e.count; });

    // Clean up null teacher references and inject live enrollment
    const cleanedClasses = classes.map(classDoc => {
      const classObj = classDoc.toObject();
      classObj.assignedTeachers = classObj.assignedTeachers.filter(at => at.teacherId);
      const liveCount = enrollmentMap[classObj._id.toString()] || 0;
      classObj.currentEnrollment = liveCount;
      // Also keep the DB field in sync (fire-and-forget, don't await)
      if (classObj.currentEnrollment !== classDoc.currentEnrollment) {
        Class.findByIdAndUpdate(classObj._id, { currentEnrollment: liveCount }).catch(() => {});
      }
      return classObj;
    });

    res.json({
      success: true,
      count: cleanedClasses.length,
      data: cleanedClasses
    });
  } catch (error) {
    logger.error('Error fetching classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes'
    });
  }
});

// @desc    Get single class
// @route   GET /api/classes/:id
// @access  Private (School Admin, Super Admin)
router.get('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    let query = { _id: req.params.id, isActive: true };
    
    // If school admin, only show classes from their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }
    
    const classData = await Class.findOne(query)
      .populate('assignedTeachers.teacherId', 'firstName lastName email avatar grade specialization')
      .populate('createdBy', 'firstName lastName');

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Clean up null teacher references
    const classObj = classData.toObject();
    classObj.assignedTeachers = classObj.assignedTeachers.filter(at => at.teacherId);

    res.json({
      success: true,
      data: classObj
    });
  } catch (error) {
    logger.error('Error fetching class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching class'
    });
  }
});

// @desc    Create new class
// @route   POST /api/classes
// @access  Private (School Admin, Super Admin)
router.post('/', protect, authorize('school_admin', 'super_admin'), [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Class name must be between 2 and 100 characters'),
  body('grade').trim().notEmpty().withMessage('Grade is required'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('capacity').optional({ checkFalsy: true }).isInt({ min: 1, max: 1000 }).withMessage('Capacity must be between 1 and 1000'),
  body('academicYear').trim().notEmpty().withMessage('Academic year is required'),
  body('semester').optional({ checkFalsy: true }).isIn(['fall', 'spring', 'summer']).withMessage('Invalid semester'),
  body('subjects').optional({ checkFalsy: true }).isArray().withMessage('Subjects must be an array'),
  body('assignedTeachers').optional({ checkFalsy: true }).isArray().withMessage('Assigned teachers must be an array'),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive', 'archived']).withMessage('Invalid status')
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
      name,
      grade,
      description,
      capacity,
      academicYear,
      semester,
      subjects,
      assignedTeachers
    } = req.body;

    // Determine school ID
    let schoolId;
    if (req.user.role === 'school_admin') {
      schoolId = req.user.schoolId;
    } else if (req.user.role === 'super_admin') {
      // Super admin can create classes for any school
      schoolId = req.body.schoolId;
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'School ID is required for super admin'
        });
      }
    }

    // Validate assigned teachers if provided
    if (assignedTeachers && assignedTeachers.length > 0) {
      for (const assignment of assignedTeachers) {
        const teacher = await User.findOne({ 
          _id: assignment.teacherId, 
          role: 'teacher',
          schoolId: schoolId
        });
        
        if (!teacher) {
          return res.status(400).json({
            success: false,
            message: `Teacher with ID ${assignment.teacherId} not found or not assigned to this school`
          });
        }
      }
    }

    const classData = new Class({
      name,
      schoolId,
      grade,
      description,
      capacity,
      schedule: {
        academicYear,
        semester: semester || 'fall',
        startDate: new Date()
      },
      subjects: subjects || [],
      assignedTeachers: assignedTeachers || [],
      createdBy: req.user.id
    });

    await classData.save();

    // Populate the created class with teacher details
    const populatedClass = await Class.findById(classData._id)
      .populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName');

    logger.info(`Class created: ${name} at school ${schoolId}`);

    res.status(201).json({
      success: true,
      data: populatedClass,
      message: 'Class created successfully'
    });
  } catch (error) {
    logger.error('Error creating class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating class'
    });
  }
});

// @desc    Update class
// @route   PUT /api/classes/:id
// @access  Private (School Admin, Super Admin)
router.put('/:id', protect, authorize('school_admin', 'super_admin'), [
  body('name').optional({ checkFalsy: true }).trim().isLength({ min: 2, max: 100 }).withMessage('Class name must be between 2 and 100 characters'),
  body('grade').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Grade cannot be empty'),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('status').optional({ checkFalsy: true }).isIn(['active', 'inactive', 'archived']).withMessage('Invalid status'),
  body('capacity').optional({ checkFalsy: true }).isInt({ min: 1, max: 1000 }).withMessage('Capacity must be between 1 and 1000'),
  body('subjects').optional({ checkFalsy: true }).isArray().withMessage('Subjects must be an array'),
  body('assignedTeachers').optional({ checkFalsy: true }).isArray().withMessage('Assigned teachers must be an array')
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

    let query = { _id: req.params.id, isActive: true };
    
    // If school admin, only update classes from their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const classData = await Class.findOne(query);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const {
      name,
      grade,
      description,
      status,
      capacity,
      assignedTeachers
    } = req.body;

    // Validate assigned teachers if provided
    if (assignedTeachers && assignedTeachers.length > 0) {
      for (const assignment of assignedTeachers) {
        const teacher = await User.findOne({ 
          _id: assignment.teacherId, 
          role: 'teacher',
          schoolId: classData.schoolId
        });
        
        if (!teacher) {
          return res.status(400).json({
            success: false,
            message: `Teacher with ID ${assignment.teacherId} not found or not assigned to this school`
          });
        }
      }
    }

    // Update fields
    const updateFields = {};
    if (name) updateFields.name = name;
    if (grade) updateFields.grade = grade;
    if (description !== undefined) updateFields.description = description;
    if (status) updateFields.status = status;
    if (capacity) updateFields.capacity = capacity;
    if (assignedTeachers) updateFields.assignedTeachers = assignedTeachers;

    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
     .populate('createdBy', 'firstName lastName');

    logger.info(`Class updated: ${updatedClass.name}`);

    res.json({
      success: true,
      data: updatedClass,
      message: 'Class updated successfully'
    });
  } catch (error) {
    logger.error('Error updating class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating class'
    });
  }
});

// @desc    Delete class
// @route   DELETE /api/classes/:id
// @access  Private (School Admin, Super Admin)
router.delete('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    let query = { _id: req.params.id, isActive: true };
    
    // If school admin, only delete classes from their school
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const classData = await Class.findOne(query);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Soft delete by setting isActive to false
    await Class.findByIdAndUpdate(req.params.id, { isActive: false });

    logger.info(`Class deleted: ${classData.name}`);

    res.json({
      success: true,
      message: 'Class deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting class'
    });
  }
});

// @desc    Assign teacher to class
// @route   POST /api/classes/:id/teachers
// @access  Private (School Admin, Super Admin)
router.post('/:id/teachers', protect, authorize('school_admin', 'super_admin'), [
  body('teacherId').isMongoId().withMessage('Valid teacher ID is required'),
  body('role').optional().isIn(['primary', 'secondary', 'assistant']).withMessage('Invalid role')
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

    let query = { _id: req.params.id, isActive: true };
    
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const classData = await Class.findOne(query);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const { teacherId, role = 'primary' } = req.body;

    // Check if teacher exists and belongs to the school
    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      schoolId: classData.schoolId
    });

    if (!teacher) {
      return res.status(400).json({
        success: false,
        message: 'Teacher not found or not assigned to this school'
      });
    }

    // Check if teacher is already assigned
    const existingAssignment = classData.assignedTeachers.find(
      assignment => assignment.teacherId.toString() === teacherId
    );

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Teacher is already assigned to this class'
      });
    }

    // Add teacher to class
    classData.assignedTeachers.push({
      teacherId,
      role,
      assignedDate: new Date()
    });

    await classData.save();

    const updatedClass = await Class.findById(classData._id)
      .populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName');

    logger.info(`Teacher ${teacherId} assigned to class ${classData.name}`);

    res.json({
      success: true,
      data: updatedClass,
      message: 'Teacher assigned successfully'
    });
  } catch (error) {
    logger.error('Error assigning teacher to class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while assigning teacher'
    });
  }
});

// @desc    Get teacher's assigned classes
// @route   GET /api/classes/teacher/assigned
// @access  Private (Teacher)
router.get('/teacher/assigned', protect, authorize('teacher'), async (req, res) => {
  try {
    const classes = await Class.find({
      schoolId: req.user.schoolId,
      isActive: true,
      'assignedTeachers.teacherId': req.user._id
    })
    .populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: classes.length,
      data: classes
    });
  } catch (error) {
    logger.error('Error fetching teacher assigned classes:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching assigned classes'
    });
  }
});

// @desc    Remove teacher from class
// @route   DELETE /api/classes/:id/teachers/:teacherId
// @access  Private (School Admin, Super Admin)
router.delete('/:id/teachers/:teacherId', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    let query = { _id: req.params.id, isActive: true };
    
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    }

    const classData = await Class.findOne(query);
    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Remove teacher from class
    classData.assignedTeachers = classData.assignedTeachers.filter(
      assignment => assignment.teacherId.toString() !== req.params.teacherId
    );

    await classData.save();

    const updatedClass = await Class.findById(classData._id)
      .populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName');

    logger.info(`Teacher ${req.params.teacherId} removed from class ${classData.name}`);

    res.json({
      success: true,
      data: updatedClass,
      message: 'Teacher removed successfully'
    });
  } catch (error) {
    logger.error('Error removing teacher from class:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing teacher'
    });
  }
});

module.exports = router; 