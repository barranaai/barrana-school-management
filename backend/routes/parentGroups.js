const express = require('express');
const router = express.Router();
const ParentGroup = require('../models/ParentGroup');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// @desc    Get all parent groups for a school
// @route   GET /api/parent-groups
// @access  Private (school_admin)
router.get('/', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const groups = await ParentGroup.find({ 
      schoolId: req.user.schoolId, 
      isActive: true 
    })
      .populate('members.parentId', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: groups,
      count: groups.length
    });
  } catch (error) {
    logger.error('Error fetching parent groups:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching parent groups',
      error: error.message
    });
  }
});

// @desc    Get single parent group
// @route   GET /api/parent-groups/:id
// @access  Private (school_admin)
router.get('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const group = await ParentGroup.findById(req.params.id)
      .populate('members.parentId', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName');

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    logger.error('Error fetching parent group:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching parent group',
      error: error.message
    });
  }
});

// @desc    Create parent group
// @route   POST /api/parent-groups
// @access  Private (school_admin)
router.post('/', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { name, description, members } = req.body;

    // Validate members are parents
    if (members && members.length > 0) {
      const parentIds = members.map(m => m.parentId || m);
      const validParents = await User.find({
        _id: { $in: parentIds },
        role: 'parent',
        schoolId: req.user.schoolId
      });

      if (validParents.length !== parentIds.length) {
        return res.status(400).json({
          success: false,
          message: 'Some selected members are not valid parents'
        });
      }
    }

    const group = await ParentGroup.create({
      name,
      description,
      schoolId: req.user.schoolId,
      members: members || [],
      createdBy: req.user._id
    });

    logger.info(`Parent group created: ${group._id} by user ${req.user._id}`);

    res.status(201).json({
      success: true,
      data: group,
      message: 'Parent group created successfully'
    });
  } catch (error) {
    logger.error('Error creating parent group:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating parent group',
      error: error.message
    });
  }
});

// @desc    Update parent group
// @route   PUT /api/parent-groups/:id
// @access  Private (school_admin)
router.put('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const group = await ParentGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_admin' && group.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this group'
      });
    }

    const updatedGroup = await ParentGroup.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('members.parentId', 'firstName lastName email phone');

    logger.info(`Parent group updated: ${group._id} by user ${req.user._id}`);

    res.json({
      success: true,
      data: updatedGroup,
      message: 'Parent group updated successfully'
    });
  } catch (error) {
    logger.error('Error updating parent group:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating parent group',
      error: error.message
    });
  }
});

// @desc    Add members to parent group (supports single or multiple)
// @route   POST /api/parent-groups/:id/members
// @access  Private (school_admin)
router.post('/:id/members', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { parentId, parentIds } = req.body;
    const group = await ParentGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    // Support both single and multiple members
    const idsToAdd = parentIds || (parentId ? [parentId] : []);
    
    if (idsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No parent IDs provided'
      });
    }

    // Verify all parents exist and are in the same school
    const validParents = await User.find({
      _id: { $in: idsToAdd },
      role: 'parent',
      schoolId: req.user.schoolId
    });

    if (validParents.length !== idsToAdd.length) {
      return res.status(400).json({
        success: false,
        message: 'Some parents were not found or not in your school'
      });
    }

    // Add members
    let addedCount = 0;
    for (const id of idsToAdd) {
      const added = group.addMember(id);
      if (added) addedCount++;
    }
    await group.save();

    // Populate the group data before sending response
    await group.populate('members.parentId', 'firstName lastName email phone');

    logger.info(`Added ${addedCount} member(s) to group ${group._id}`);

    res.json({
      success: true,
      data: group,
      message: `${addedCount} member(s) added successfully`
    });
  } catch (error) {
    logger.error('Error adding member to group:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding member',
      error: error.message
    });
  }
});

// @desc    Remove member from parent group
// @route   DELETE /api/parent-groups/:id/members/:parentId
// @access  Private (school_admin)
router.delete('/:id/members/:parentId', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const group = await ParentGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    // Remove member
    group.removeMember(req.params.parentId);
    await group.save();

    logger.info(`Removed member ${req.params.parentId} from group ${group._id}`);

    res.json({
      success: true,
      data: group,
      message: 'Member removed successfully'
    });
  } catch (error) {
    logger.error('Error removing member from group:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing member',
      error: error.message
    });
  }
});

// @desc    Delete parent group
// @route   DELETE /api/parent-groups/:id
// @access  Private (school_admin)
router.delete('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const group = await ParentGroup.findById(req.params.id);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Parent group not found'
      });
    }

    // Check authorization
    if (req.user.role !== 'super_admin' && group.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this group'
      });
    }

    // Soft delete
    group.isActive = false;
    await group.save();

    logger.info(`Parent group deleted: ${group._id} by user ${req.user._id}`);

    res.json({
      success: true,
      message: 'Parent group deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting parent group:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting parent group',
      error: error.message
    });
  }
});

module.exports = router;

