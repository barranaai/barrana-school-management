const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const Progress = require('../models/Progress');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const PlannedSession = require('../models/PlannedSession');
const Requirement = require('../models/Requirement');
const Parameter = require('../models/Parameter');
const Roadmap = require('../models/Roadmap');
const router = express.Router();
const oid = v => mongoose.Types.ObjectId.isValid(v);
const managers = ['school_admin', 'super_admin']; const readers = [...managers, 'teacher'];
const schoolFor = (req, value) => scopeSchoolId(req.user, value);
const teacherOwns = (session, user) => String(session.deliveredBy) === String(user._id);
const valueValid = (p, value) => {
  if (p.type === 'text') return typeof value === 'string';
  if (p.type === 'checkbox') return typeof value === 'boolean';
  if (p.type === 'number' || p.type === 'rating') return typeof value === 'number' && Number.isFinite(value);
  if (p.type === 'percentage') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  if (p.type === 'select') return typeof value === 'string' && Array.isArray(p.options) && p.options.includes(value);
  return false;
};
async function context(body, user) {
  const schoolId = scopeSchoolId(user, body.schoolId);
  if (!oid(schoolId) || !oid(body.childParticipationId)) return { error: 'Valid schoolId and childParticipationId are required' };
  const participation = await ChildParticipation.findOne({ _id: body.childParticipationId, schoolId });
  if (!participation || ['cancelled', 'absent', 'excused'].includes(participation.status)) return { error: 'Participation not found or unavailable' };
  const session = await DeliveredSession.findOne({ _id: participation.deliveredSessionId, schoolId });
  if (!session || session.status === 'cancelled' || !['in_progress', 'completed'].includes(session.status)) return { error: 'Delivered Session is not eligible for Progress' };
  if (user.role === 'teacher' && !teacherOwns(session, user)) return { error: 'Not authorized for this Delivered Session', status: 403 };
  const planned = await PlannedSession.findOne({ _id: session.plannedSessionId, schoolId });
  if (!planned || String(planned.roadmapId) !== String(session.roadmapId) || planned.roadmapVersion !== session.roadmapVersion) return { error: 'Planned Session context is invalid' };
  const roadmap = await Roadmap.findOne({ _id: session.roadmapId, schoolId, version: session.roadmapVersion, status: { $in: ['active', 'archived'] } });
  if (!roadmap) return { error: 'Roadmap context is invalid' };
  return { schoolId, participation, session, planned, roadmap };
}
async function validatedResults(body, ctx) {
  const objectives = ctx.planned.objectives || []; const byId = new Map(objectives.map(o => [String(o._id), o]));
  const objectiveResults = body.objectiveResults || []; if (!Array.isArray(objectiveResults)) return { error: 'objectiveResults must be an array' };
  const seen = new Set(); const objectiveSnapshots = [];
  for (const r of objectiveResults) { const o = byId.get(String(r.objectiveId)); if (!o || seen.has(String(r.objectiveId))) return { error: 'Objective result does not match the Planned Session' }; if (!['achieved','partially_achieved','not_achieved','needs_improvement','not_observed'].includes(r.status)) return { error: 'Invalid objective result status' }; seen.add(String(r.objectiveId)); objectiveSnapshots.push({ objectiveId: o._id, sequence: o.sequence, title: o.title, description: o.description, expectedOutcome: o.expectedOutcome, status: r.status, instructorNote: r.instructorNote, evidence: r.evidence, metadata: r.metadata }); }
  const parameterResults = body.parameterResults || []; if (!Array.isArray(parameterResults)) return { error: 'parameterResults must be an array' };
  const ids = parameterResults.map(r => r.parameterId); if (ids.some(id => !oid(id)) || new Set(ids.map(String)).size !== ids.length) return { error: 'Invalid or duplicate parameter result' };
  const params = await Parameter.find({ _id: { $in: ids }, schoolId: ctx.schoolId, programId: ctx.roadmap.programId, isActive: true }); const pMap = new Map(params.map(p => [String(p._id), p]));
  const reqIds = params.map(p => p.requirementId); const reqs = await Requirement.find({ _id: { $in: reqIds }, schoolId: ctx.schoolId, programId: ctx.roadmap.programId, levelId: ctx.roadmap.levelId, isActive: true }); const reqMap = new Map(reqs.map(r => [String(r._id), r])); const snapshots = [];
  for (const r of parameterResults) { const p = pMap.get(String(r.parameterId)); const req = p && reqMap.get(String(p.requirementId)); if (!p || !req || !valueValid(p, r.value)) return { error: 'Parameter result is invalid for this Planned Session' }; snapshots.push({ requirementId: req._id, requirementLabel: req.name, parameterId: p._id, parameterLabel: p.name, type: p.type, options: p.type === 'select' ? p.options : undefined, value: r.value, note: r.note }); }
  return { objectiveResults: objectiveSnapshots, parameterResults: snapshots };
}
router.use(protect);
router.get('/', authorize(...readers), async (req, res) => { try { const schoolId = schoolFor(req, req.query.schoolId); if (!oid(schoolId)) return res.status(400).json({ success: false, message: 'schoolId is required' }); const q = { schoolId }; if (req.query.childParticipationId) q.childParticipationId = req.query.childParticipationId; const rows = await Progress.find(q).sort({ createdAt: -1 }); if (req.user.role === 'teacher') { const sessions = await DeliveredSession.find({ schoolId, deliveredBy: req.user._id }).select('_id'); const participations = await ChildParticipation.find({ schoolId, deliveredSessionId: { $in: sessions.map(s => s._id) } }).select('_id'); const ids = new Set(participations.map(p => String(p._id))); return res.json({ success: true, data: rows.filter(r => ids.has(String(r.childParticipationId))) }); } res.json({ success: true, data: rows }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });
router.get('/:id', authorize(...readers), async (req, res) => { try { const schoolId = schoolFor(req, req.query.schoolId); if (!oid(schoolId) || !oid(req.params.id)) return res.status(404).json({ success: false, message: 'Progress not found' }); const row = await Progress.findOne({ _id: req.params.id, schoolId }); if (!row) return res.status(404).json({ success: false, message: 'Progress not found' }); if (req.user.role === 'teacher') { const p = await ChildParticipation.findOne({ _id: row.childParticipationId, schoolId }); const s = p && await DeliveredSession.findOne({ _id: p.deliveredSessionId, schoolId }); if (!s || !teacherOwns(s, req.user)) return res.status(404).json({ success: false, message: 'Progress not found' }); } res.json({ success: true, data: row }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } });
router.post('/', authorize(...managers, 'teacher'), async (req, res) => { try { const c = await context(req.body, req.user); if (c.error) return res.status(c.status || 400).json({ success: false, message: c.error }); const results = await validatedResults(req.body, c); if (results.error) return res.status(400).json({ success: false, message: results.error }); const data = await Progress.create({ schoolId: c.schoolId, childParticipationId: c.participation._id, ...results, observations: req.body.observations, recommendations: req.body.recommendations, overallStatus: req.body.overallStatus, metadata: req.body.metadata, createdBy: req.user._id, updatedBy: req.user._id }); res.status(201).json({ success: true, data }); } catch (e) { res.status(400).json({ success: false, message: e.code === 11000 ? 'Progress already exists for this participation' : e.message }); } });
router.put('/:id', authorize(...managers, 'teacher'), async (req, res) => { try { const schoolId = schoolFor(req, req.body.schoolId || req.query.schoolId); const row = oid(schoolId) && oid(req.params.id) ? await Progress.findOne({ _id: req.params.id, schoolId }) : null; if (!row) return res.status(404).json({ success: false, message: 'Progress not found' }); const p = await ChildParticipation.findOne({ _id: row.childParticipationId, schoolId }); const s = p && await DeliveredSession.findOne({ _id: p.deliveredSessionId, schoolId }); if (req.user.role === 'teacher' && (!s || !teacherOwns(s, req.user))) return res.status(403).json({ success: false, message: 'Not authorized' }); if (!s || s.status === 'cancelled') return res.status(409).json({ success: false, message: 'Progress context is not editable' }); const ctx = await context({ schoolId, childParticipationId: row.childParticipationId }, req.user); if (ctx.error) return res.status(ctx.status || 409).json({ success: false, message: ctx.error }); const results = await validatedResults(req.body, ctx); if (results.error) return res.status(400).json({ success: false, message: results.error }); Object.assign(row, results, { observations: req.body.observations, recommendations: req.body.recommendations, overallStatus: req.body.overallStatus, metadata: req.body.metadata, updatedBy: req.user._id }); await row.save(); res.json({ success: true, data: row }); } catch (e) { res.status(400).json({ success: false, message: e.message }); } });
module.exports = router;
