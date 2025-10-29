const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// @desc    Get users with optional filtering
// @route   GET /api/users
// @access  Private (school_admin, super_admin)
router.get('/', protect, authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { role, grade, classId } = req.query;
    
    // Build query
    const query = {
      schoolId: req.user.schoolId,
      isActive: true
    };
    
    // Filter by role if provided
    if (role) {
      query.role = role;
    }
    
    // Filter by grade if provided
    if (grade) {
      query.grade = grade;
    }
    
    // Filter by class if provided
    if (classId) {
      query.classId = classId;
    }
    
    // Fetch users
    const users = await User.find(query)
      .select('firstName lastName email phone role grade studentId')
      .sort({ lastName: 1, firstName: 1 });
    
    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check authorization
    if (req.user.role !== 'super_admin' && user.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this user'
      });
    }
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
});

module.exports = router;
