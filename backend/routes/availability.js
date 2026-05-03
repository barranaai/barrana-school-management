/**
 * /api/availability — teacher-published meeting time slots
 *
 * Role rules:
 *   - teacher: create their own, list their own, delete their own (if unbooked)
 *   - parent: list all open slots for any teacher in their school
 *             (filtered down to teachers of their children when ?onlyMyTeachers=true)
 *   - school_admin / super_admin: full visibility
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const User = require('../models/User');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeSchoolId(schoolId) {
  if (!schoolId) return null;
  if (typeof schoolId === 'string') return schoolId;
  if (schoolId._id) return schoolId._id.toString();
  return schoolId.toString();
}

const POPULATE = [{ path: 'teacherId', select: 'firstName lastName email role' }];

/** Teachers of all children whose parentEmail matches the parent's email. */
async function getTeacherIdsForParent(parentUser) {
  const parentEmail = (parentUser.email || '').toLowerCase();
  if (!parentEmail) return [];
  const children = await User.find({ role: 'student', parentEmail })
    .select('classId')
    .lean();
  if (children.length === 0) return [];
  const Class = require('../models/Class');
  const classIds = children.map((c) => c.classId).filter(Boolean);
  const classes = await Class.find({ _id: { $in: classIds } })
    .select('assignedTeachers')
    .lean();
  const teacherIds = new Set();
  classes.forEach((cls) => {
    (cls.assignedTeachers || []).forEach((t) => {
      if (t && t.teacherId) teacherIds.add(t.teacherId.toString());
    });
  });
  return Array.from(teacherIds);
}

// ─── Routes ───────────────────────────────────────────────────────────

/**
 * POST /api/availability
 * Body: { startsAt, endsAt, location?, meetingUrl?, format?, notes? }
 * Or: { slots: [{ startsAt, endsAt, ... }, ...] } for batch creation.
 */
router.post(
  '/',
  protect,
  authorize('teacher', 'school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const items = Array.isArray(req.body.slots) ? req.body.slots : [req.body];
      const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
      const teacherId = req.user.role === 'teacher' ? req.user._id : req.body.teacherId || req.user._id;

      // Basic validation per item
      const cleaned = [];
      for (const it of items) {
        if (!it.startsAt || !it.endsAt) {
          return res.status(400).json({ success: false, error: 'startsAt and endsAt are required.' });
        }
        const startsAt = new Date(it.startsAt);
        const endsAt = new Date(it.endsAt);
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
          return res.status(400).json({ success: false, error: 'Invalid date format.' });
        }
        if (endsAt <= startsAt) {
          return res.status(400).json({ success: false, error: 'endsAt must be after startsAt.' });
        }
        if (startsAt < new Date()) {
          return res.status(400).json({ success: false, error: 'Cannot publish a slot in the past.' });
        }
        cleaned.push({
          schoolId: requesterSchoolId,
          teacherId,
          startsAt,
          endsAt,
          location: it.location,
          meetingUrl: it.meetingUrl,
          format: it.format || 'in_person',
          notes: it.notes,
        });
      }

      // Conflict check: reject if any new slot overlaps an existing
      // published or booked slot for the same teacher.
      const anyExisting = await AvailabilitySlot.find({
        teacherId,
        status: { $in: ['published', 'booked'] },
        $or: cleaned.map((c) => ({
          startsAt: { $lt: c.endsAt },
          endsAt: { $gt: c.startsAt },
        })),
      }).lean();
      if (anyExisting.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'overlap',
          message: 'One or more of the new slots overlap with existing slots.',
          conflicting: anyExisting.map((s) => ({
            _id: s._id,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
          })),
        });
      }

      const created = await AvailabilitySlot.insertMany(cleaned);
      const populated = await AvailabilitySlot.find({ _id: { $in: created.map((c) => c._id) } })
        .populate(POPULATE)
        .lean();
      res.status(201).json({ success: true, data: populated });
    } catch (err) {
      logger.error('Create availability error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

/**
 * GET /api/availability
 * Query: ?teacherId=&from=&to=&status=&onlyMyTeachers=true
 */
router.get('/', protect, async (req, res) => {
  try {
    const requesterSchoolId = normalizeSchoolId(req.user.schoolId);
    const query = { schoolId: requesterSchoolId };

    if (req.query.teacherId) query.teacherId = req.query.teacherId;
    if (req.query.status) query.status = req.query.status;
    if (req.query.from || req.query.to) {
      query.startsAt = {};
      if (req.query.from) query.startsAt.$gte = new Date(req.query.from);
      if (req.query.to) query.startsAt.$lte = new Date(req.query.to);
    }

    if (req.user.role === 'teacher') {
      // Teachers only see their own
      query.teacherId = req.user._id;
    } else if (req.user.role === 'parent') {
      // Parents see only published (open) slots by default
      if (!req.query.status) query.status = 'published';
      if (req.query.onlyMyTeachers === 'true') {
        const teacherIds = await getTeacherIdsForParent(req.user);
        if (teacherIds.length === 0) {
          return res.json({ success: true, data: [] });
        }
        query.teacherId = { $in: teacherIds };
      }
    }

    const slots = await AvailabilitySlot.find(query)
      .populate(POPULATE)
      .sort({ startsAt: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: slots });
  } catch (err) {
    logger.error('List availability error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/availability/:id
 * Teachers can delete their own slots, but only if status is 'published'
 * (booked slots must be cancelled via the meeting).
 */
router.delete(
  '/:id',
  protect,
  authorize('teacher', 'school_admin', 'super_admin'),
  async (req, res) => {
    try {
      const slot = await AvailabilitySlot.findById(req.params.id);
      if (!slot) return res.status(404).json({ success: false, error: 'Slot not found' });

      if (req.user.role === 'teacher' && slot.teacherId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'You can only delete your own slots.' });
      }
      if (slot.status === 'booked') {
        return res.status(409).json({
          success: false,
          error: 'slot_booked',
          message: 'Slot is booked. Cancel the meeting first.',
        });
      }
      slot.status = 'cancelled';
      await slot.save();
      res.json({ success: true });
    } catch (err) {
      logger.error('Delete availability error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

module.exports = router;
