const express = require('express');
const mongoose = require('mongoose');
const Class = require('../models/Class');
const School = require('../models/School');
const { protectReadOnly, authorize } = require('../middleware/auth');
const { scopeSchoolId, idOf } = require('../middleware/resourceAuthorization');

const router = express.Router();
const validId = value => typeof value === 'string' && mongoose.isObjectIdOrHexString(value);

// Read-only selector; deliberately does not use the legacy enrollment-sync list.
router.get('/', protectReadOnly, authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const requested = req.query.schoolId;
    if (requested !== undefined && !validId(requested)) {
      return res.status(400).json({ success: false, message: 'A valid school is required' });
    }
    const schoolId = scopeSchoolId(req.user, requested);
    if (!validId(schoolId)) {
      return res.status(400).json({ success: false, message: 'A valid school is required' });
    }
    if (req.user.role !== 'super_admin' && requested && requested !== schoolId) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this school' });
    }
    if (!await School.exists({ _id: schoolId })) {
      return res.status(404).json({ success: false, message: 'School not found' });
    }
    const query = { schoolId, isActive: true };
    if (req.user.role === 'teacher') {
      const teacherId = idOf(req.user._id);
      if (!validId(teacherId)) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      query['assignedTeachers.teacherId'] = teacherId;
    }
    const data = await Class.find(query).select('_id name schoolId').sort({ name: 1, _id: 1 }).lean();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to load class options' });
  }
});

module.exports = router;
