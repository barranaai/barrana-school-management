const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const { canCreateOperationalParticipation } = require('../utils/operationalParticipationAuthorization');
const Class = require('../models/Class');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const router = express.Router();
const oid = v => mongoose.Types.ObjectId.isValid(v);
const managers = ['school_admin', 'super_admin'];
const readers = [...managers, 'teacher'];
const schoolFor = (req, value) => scopeSchoolId(req.user, value);
const teacherOwns = (session, user) => String(session.deliveredBy) === String(user._id);
const transitions = { active: ['active', 'excused', 'absent', 'cancelled'], excused: ['excused', 'active'], absent: ['absent', 'active'], cancelled: ['cancelled'] };

async function context(body, user) {
  const schoolId = scopeSchoolId(user, body.schoolId);
  if (!oid(schoolId) || !oid(body.deliveredSessionId) || !oid(body.childId) || !oid(body.enrollmentId)) return { error: 'Valid schoolId, deliveredSessionId, childId and enrollmentId are required' };
  const session = await DeliveredSession.findOne({ _id: body.deliveredSessionId, schoolId });
  if (!session || ['cancelled'].includes(session.status)) return { error: 'Delivered Session not found or unavailable' };
  if (user.role === 'teacher' && !teacherOwns(session, user)) return { error: 'Not authorized for this Delivered Session', status: 403 };
  const [child, enrollment] = await Promise.all([User.findOne({ _id: body.childId, schoolId, role: 'student' }), Enrollment.findOne({ _id: body.enrollmentId, schoolId })]);
  if (!child) return { error: 'Child not found in this school' };
  if (!enrollment || String(enrollment.childId) !== String(child._id) || String(enrollment.programId) !== String(session.programId)) return { error: 'Enrollment does not match the child and session program' };
  if (['withdrawn', 'cancelled'].includes(enrollment.status)) return { error: 'Enrollment is not valid for this session' };
  const at = session.scheduledAt;
  const assignment = (enrollment.classAssignments || []).find(a => String(a.classId) === String(session.classId) && new Date(a.effectiveFrom) <= at && (!a.effectiveTo || new Date(a.effectiveTo) >= at));
  if ((enrollment.classAssignments || []).length && !assignment) return { error: 'Enrollment is not assigned to this session class' };
  if (user.role === 'teacher') {
    const cls = await Class.findOne({ _id: session.classId, schoolId, isActive: true });
    if (!canCreateOperationalParticipation({ teacher: user, child, enrollment, session, cls, childId: body.childId, enrollmentId: body.enrollmentId })) return { error: 'Not authorized for this operational participation', status: 403 };
  }
  return { schoolId, session, child, enrollment };
}

router.use(protect);
router.get('/', authorize(...readers), async (req, res) => { try { const schoolId = schoolFor(req, req.query.schoolId); if (!oid(schoolId)) return res.status(400).json({ success: false, message: 'schoolId is required' }); const q = { schoolId }; for (const k of ['deliveredSessionId', 'childId', 'enrollmentId', 'status']) if (req.query[k]) q[k] = req.query[k]; if (req.user.role === 'teacher') { const sessions = await DeliveredSession.find({ schoolId, deliveredBy: req.user._id }).select('_id'); q.deliveredSessionId = { $in: sessions.map(s => s._id) }; } const data = await ChildParticipation.find(q).sort({ createdAt: -1 }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });
router.get('/:id', authorize(...readers), async (req, res) => { try { const schoolId = schoolFor(req, req.query.schoolId); if (!oid(schoolId) || !oid(req.params.id)) return res.status(404).json({ success: false, message: 'Participation not found' }); const row = await ChildParticipation.findOne({ _id: req.params.id, schoolId }); if (!row) return res.status(404).json({ success: false, message: 'Participation not found' }); if (req.user.role === 'teacher') { const session = await DeliveredSession.findOne({ _id: row.deliveredSessionId, schoolId }); if (!session || !teacherOwns(session, req.user)) return res.status(404).json({ success: false, message: 'Participation not found' }); } res.json({ success: true, data: row }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });
router.post('/', authorize(...managers, 'teacher'), async (req, res) => { try { const c = await context(req.body, req.user); if (c.error) return res.status(c.status || 400).json({ success: false, message: c.error }); const data = await ChildParticipation.create({ schoolId: c.schoolId, deliveredSessionId: c.session._id, childId: c.child._id, enrollmentId: c.enrollment._id, programId: c.session.programId, levelId: c.session.levelId, classId: c.session.classId, status: 'active', createdBy: req.user._id, updatedBy: req.user._id }); res.status(201).json({ success: true, data }); } catch (e) { res.status(400).json({ success: false, message: e.code === 11000 ? 'Child already has participation for this Delivered Session' : e.message }); } });
router.put('/:id', authorize(...managers, 'teacher'), async (req, res) => { try { const schoolId = schoolFor(req, req.body.schoolId || req.query.schoolId); const row = oid(schoolId) && oid(req.params.id) ? await ChildParticipation.findOne({ _id: req.params.id, schoolId }) : null; if (!row) return res.status(404).json({ success: false, message: 'Participation not found' }); const session = await DeliveredSession.findOne({ _id: row.deliveredSessionId, schoolId }); if (req.user.role === 'teacher' && (!session || !teacherOwns(session, req.user))) return res.status(403).json({ success: false, message: 'Not authorized' }); if (req.body.deliveredSessionId || req.body.childId || req.body.enrollmentId || req.body.schoolId || req.body.programId || req.body.levelId || req.body.classId) return res.status(400).json({ success: false, message: 'Participation identity fields cannot be changed' }); if (!Object.prototype.hasOwnProperty.call(req.body, 'status') || !transitions[row.status]?.includes(req.body.status)) return res.status(409).json({ success: false, message: row.status === 'cancelled' ? 'Cancelled participation is finalized' : 'Invalid participation status transition' }); row.status = req.body.status; row.updatedBy = req.user._id; await row.save(); res.json({ success: true, data: row }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } });
router.delete('/:id', authorize(...managers, 'teacher'), async (req, res) => { try { const schoolId = schoolFor(req, req.body?.schoolId || req.query.schoolId); const row = oid(schoolId) && oid(req.params.id) ? await ChildParticipation.findOne({ _id: req.params.id, schoolId }) : null; if (!row) return res.status(404).json({ success: false, message: 'Participation not found' }); const session = await DeliveredSession.findOne({ _id: row.deliveredSessionId, schoolId }); if (req.user.role === 'teacher' && (!session || !teacherOwns(session, req.user))) return res.status(403).json({ success: false, message: 'Not authorized' }); if (row.status === 'cancelled') return res.status(409).json({ success: false, message: 'Cancelled participation is already finalized' }); row.status = 'cancelled'; row.updatedBy = req.user._id; await row.save(); res.json({ success: true, data: row }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } });
module.exports = router;
