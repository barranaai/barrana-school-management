const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const { requireActiveOrganization } = require('../middleware/lifecycleAuthorization');
const DeliveredSession = require('../models/DeliveredSession');
const PlannedSession = require('../models/PlannedSession');
const Roadmap = require('../models/Roadmap');
const Program = require('../models/Program');
const Level = require('../models/Level');
const Class = require('../models/Class');
const Requirement = require('../models/Requirement');
const Parameter = require('../models/Parameter');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const { supportsProgramAndLevel } = require('../services/deliveryGroupCompatibility');
const { canDeliverIndividualSession } = require('../services/individualSessionAuthorization');
const router = express.Router();
const oid = v => mongoose.Types.ObjectId.isValid(v);
const schoolFor = (req, value) => scopeSchoolId(req.user, value);
const managers = ['school_admin', 'super_admin'];
const readers = ['school_admin', 'super_admin', 'teacher'];
const teacherAssigned = (cls, userId) => cls.assignedTeachers?.some(a => String(a.teacherId?._id || a.teacherId) === String(userId));

async function individualAuthorization(session, schoolId, scheduledAt = session.scheduledAt) {
  const [teacher, enrollment, child] = await Promise.all([
    User.findOne({ _id: session.deliveredBy, schoolId, role: 'teacher', isActive: true }),
    Enrollment.findOne({ _id: session.individualEnrollmentId, schoolId }),
    User.findOne({ _id: session.individualChildId, schoolId, role: 'student', isActive: true })
  ]);
  return canDeliverIndividualSession({ teacher, enrollment, child, session: { ...(session.toObject?.() || session), scheduledAt } });
}

async function context(body, user, existing) {
  const schoolId = scopeSchoolId(user, body.schoolId);
  const deliveryMode = body.deliveryMode || 'group';
  if (!['group', 'individual'].includes(deliveryMode)) return { error: 'Delivery mode is invalid' };
  if (!oid(schoolId) || !oid(body.plannedSessionId)) return { error: 'Valid schoolId and plannedSessionId are required' };
  if (deliveryMode === 'group' && !oid(body.classId)) return { error: 'Valid schoolId, plannedSessionId and classId are required' };
  if (deliveryMode === 'individual' && (!oid(body.individualEnrollmentId) || !oid(body.individualChildId) || body.classId)) return { error: 'Valid individual Enrollment and child are required without a classId' };
  const planned = await PlannedSession.findOne({ _id: body.plannedSessionId, schoolId, status: 'active' });
  if (!planned) return { error: 'Active Planned Session not found' };
  const roadmap = await Roadmap.findOne({ _id: planned.roadmapId, schoolId, status: { $in: ['active', 'archived'] }, version: planned.roadmapVersion });
  if (!roadmap || String(roadmap._id) !== String(planned.roadmapId)) return { error: 'Planned Session roadmap is invalid' };
  const [program, level] = await Promise.all([Program.findOne({ _id: roadmap.programId, schoolId, isActive: true }), Level.findOne({ _id: roadmap.levelId, schoolId, programId: roadmap.programId, isActive: true })]);
  if (!program || !level) return { error: 'Roadmap program or level is invalid' };
  if (body.scheduledAt && Number.isNaN(new Date(body.scheduledAt).getTime())) return { error: 'Invalid scheduledAt' };
  let cls = null; let enrollment = null; let child = null;
  if (deliveryMode === 'group') {
    cls = await Class.findOne({ _id: body.classId, schoolId, isActive: true });
    if (!cls) return { error: 'Class not found in this school' };
    if (user.role === 'teacher' && !teacherAssigned(cls, user._id)) return { error: 'Teacher is not assigned to this class', status: 403 };
    if (!supportsProgramAndLevel(cls, roadmap.programId, roadmap.levelId)) return { error: 'Class is not compatible with the Planned Session Program and Level' };
  } else {
    if (user.role !== 'teacher') return { error: 'An assigned instructor must create an individual session', status: 403 };
    const [teacher, enrollmentRow, childRow] = await Promise.all([
      User.findOne({ _id: user._id, schoolId, role: 'teacher', isActive: true }),
      Enrollment.findOne({ _id: body.individualEnrollmentId, schoolId }),
      User.findOne({ _id: body.individualChildId, schoolId, role: 'student', isActive: true })
    ]);
    enrollment = enrollmentRow; child = childRow;
    const candidate = { deliveryMode, schoolId, deliveredBy: user._id, individualEnrollmentId: body.individualEnrollmentId, individualChildId: body.individualChildId, programId: roadmap.programId, levelId: roadmap.levelId, scheduledAt: body.scheduledAt };
    if (!canDeliverIndividualSession({ teacher, child, enrollment, session: candidate })) return { error: 'Not authorized for this individual session', status: 403 };
  }
  if ((planned.objectives || []).some(o => !o._id || !oid(o._id))) return { error: 'Planned Session objective identity is missing or invalid' };
  const reqIds = (planned.objectives || []).map(o => o.requirementId).filter(Boolean);
  const paramIds = (planned.objectives || []).map(o => o.parameterId).filter(Boolean);
  const [reqs, params] = await Promise.all([Requirement.find({ _id: { $in: reqIds }, schoolId, programId: roadmap.programId, levelId: roadmap.levelId }), Parameter.find({ _id: { $in: paramIds }, schoolId, programId: roadmap.programId })]);
  const reqMap = new Map(reqs.map(r => [String(r._id), r.name])); const paramMap = new Map(params.map(p => [String(p._id), p.name]));
  const snapshot = { plannedSessionId: planned._id, roadmapId: roadmap._id, roadmapVersion: planned.roadmapVersion, title: planned.title, description: planned.description, expectedOutcomes: planned.expectedOutcomes || [], methodology: planned.methodology || '', objectives: (planned.objectives || []).map(o => ({ ...o.toObject(), objectiveId: o._id, requirementLabel: o.requirementId ? reqMap.get(String(o.requirementId)) : undefined, parameterLabel: o.parameterId ? paramMap.get(String(o.parameterId)) : undefined })) };
  return { schoolId, deliveryMode, planned, roadmap, cls, enrollment, child, program, level, snapshot };
}

router.use(protect);
router.get('/', authorize(...readers), async (req, res) => { try { const schoolId = schoolFor(req, req.query.schoolId); if (!oid(schoolId)) return res.status(400).json({ success: false, message: 'schoolId is required' }); const q = { schoolId }; for (const k of ['plannedSessionId', 'classId', 'status']) if (req.query[k]) q[k] = req.query[k]; if (req.user.role === 'teacher') q.deliveredBy = req.user._id; const data = await DeliveredSession.find(q).sort({ scheduledAt: -1 }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });
router.get('/:id', authorize(...readers), async (req, res) => { try { const schoolId = schoolFor(req, req.query.schoolId); if (!oid(schoolId) || !oid(req.params.id)) return res.status(404).json({ success: false, message: 'Delivered Session not found' }); const row = await DeliveredSession.findOne({ _id: req.params.id, schoolId }); if (!row || (req.user.role === 'teacher' && String(row.deliveredBy) !== String(req.user._id))) return res.status(404).json({ success: false, message: 'Delivered Session not found' }); res.json({ success: true, data: row }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });
router.post('/', authorize(...managers, 'teacher'), requireActiveOrganization, async (req, res) => { try { const c = await context(req.body, req.user); if (c.error) return res.status(c.status || 400).json({ success: false, message: c.error }); const data = await DeliveredSession.create({ schoolId: c.schoolId, deliveryMode: c.deliveryMode, plannedSessionId: c.planned._id, roadmapId: c.roadmap._id, roadmapVersion: c.planned.roadmapVersion, ...(c.deliveryMode === 'group' ? { classId: c.cls._id } : { individualEnrollmentId: c.enrollment._id, individualChildId: c.child._id }), programId: c.program._id, levelId: c.level._id, scheduledAt: req.body.scheduledAt, title: c.planned.title, plannedSessionSnapshot: c.snapshot, deliveryNotes: req.body.deliveryNotes, methodologyAdjustments: req.body.methodologyAdjustments, metadata: req.body.metadata, deliveredBy: req.user._id, createdBy: req.user._id, updatedBy: req.user._id }); res.status(201).json({ success: true, data }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } });
router.put('/:id', authorize(...managers, 'teacher'), requireActiveOrganization, async (req, res) => { try { const schoolId = schoolFor(req, req.body.schoolId || req.query.schoolId); const row = oid(schoolId) && oid(req.params.id) ? await DeliveredSession.findOne({ _id: req.params.id, schoolId }) : null; if (!row) return res.status(404).json({ success: false, message: 'Delivered Session not found' }); if (['completed', 'cancelled'].includes(row.status)) return res.status(409).json({ success: false, message: 'Finalized Delivered Sessions are immutable' }); if (req.user.role === 'teacher' && String(row.deliveredBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized' }); const allowed = ['scheduledAt', 'deliveryNotes', 'methodologyAdjustments', 'metadata']; const body = {}; allowed.forEach(k => { if (req.body[k] !== undefined) body[k] = req.body[k]; }); if (body.scheduledAt && Number.isNaN(new Date(body.scheduledAt).getTime())) return res.status(400).json({ success: false, message: 'Invalid scheduledAt' }); if ((row.deliveryMode || 'group') === 'individual' && !await individualAuthorization(row, schoolId, body.scheduledAt || row.scheduledAt)) return res.status(403).json({ success: false, message: 'Individual session assignment is not valid for this date' }); Object.assign(row, body, { updatedBy: req.user._id }); await row.save(); res.json({ success: true, data: row }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } });
router.patch('/:id/status', authorize(...managers, 'teacher'), requireActiveOrganization, async (req, res) => { try { const schoolId = schoolFor(req, req.body?.schoolId || req.query.schoolId); const row = oid(schoolId) && oid(req.params.id) ? await DeliveredSession.findOne({ _id: req.params.id, schoolId }) : null; if (!row) return res.status(404).json({ success: false, message: 'Delivered Session not found' }); if (req.user.role === 'teacher' && String(row.deliveredBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized' }); const next = req.body.status; const allowed = { scheduled: ['in_progress', 'cancelled'], in_progress: ['completed', 'cancelled'] }; if (!allowed[row.status]?.includes(next)) return res.status(409).json({ success: false, message: 'Invalid lifecycle transition' }); if ((row.deliveryMode || 'group') === 'individual' && next !== 'cancelled' && !await individualAuthorization(row, schoolId)) return res.status(403).json({ success: false, message: 'Individual session assignment is no longer active for this date' }); row.status = next; if (next === 'completed') row.deliveredAt = req.body.deliveredAt ? new Date(req.body.deliveredAt) : new Date(); row.updatedBy = req.user._id; await row.save(); res.json({ success: true, data: row }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } });
module.exports = router;
