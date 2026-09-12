const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const PlannedSession = require('../models/PlannedSession');
const Roadmap = require('../models/Roadmap');
const Requirement = require('../models/Requirement');
const Parameter = require('../models/Parameter');

const router = express.Router();
const admins = ['school_admin', 'super_admin'];
const readers = ['school_admin', 'super_admin', 'teacher'];
const validId = value => mongoose.Types.ObjectId.isValid(value);
const tenant = (req, requested) => scopeSchoolId(req.user, requested);

async function validateObjectives(objectives, roadmap) {
  if (!Array.isArray(objectives)) return 'objectives must be an array';
  const sequences = objectives.map(o => Number(o.sequence));
  if (sequences.some(n => !Number.isInteger(n) || n < 1) || new Set(sequences).size !== sequences.length) return 'Objective sequences must be unique positive integers';
  for (const objective of objectives) {
    if (!objective.title || !String(objective.title).trim()) return 'Objective title is required';
    if (objective.requirementId) {
      const req = await Requirement.findOne({ _id: objective.requirementId, schoolId: roadmap.schoolId, programId: roadmap.programId, levelId: roadmap.levelId, isActive: true });
      if (!req) return 'Requirement is not valid for this roadmap';
      if (objective.parameterId) {
        const param = await Parameter.findOne({ _id: objective.parameterId, schoolId: roadmap.schoolId, programId: roadmap.programId, requirementId: req._id, isActive: true });
        if (!param) return 'Parameter is not valid for this requirement';
      }
    } else if (objective.parameterId) return 'Parameter requires a requirementId';
  }
  return null;
}

async function roadmapFor(req, id, schoolId) {
  if (!validId(id) || !validId(schoolId)) return null;
  return Roadmap.findOne({ _id: id, schoolId, status: { $in: ['draft', 'active'] } });
}

router.use(protect);
router.get('/:roadmapId/sessions', authorize(...readers), async (req, res) => {
  try { const schoolId = tenant(req, req.query.schoolId); const roadmap = await roadmapFor(req, req.params.roadmapId, schoolId); if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' }); const data = await PlannedSession.find({ schoolId, roadmapId: roadmap._id, status: { $in: ['draft', 'active'] } }).sort({ sequence: 1 }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.get('/:id', authorize(...readers), async (req, res) => {
  try { const schoolId = tenant(req, req.query.schoolId); if (!validId(schoolId) || !validId(req.params.id)) return res.status(404).json({ success: false, message: 'Planned session not found' }); const data = await PlannedSession.findOne({ _id: req.params.id, schoolId }); if (!data) return res.status(404).json({ success: false, message: 'Planned session not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.post('/:roadmapId/sessions', authorize(...admins), async (req, res) => {
  try { const schoolId = tenant(req, req.body.schoolId); const roadmap = await roadmapFor(req, req.params.roadmapId, schoolId); if (!roadmap || roadmap.status !== 'active') return res.status(400).json({ success: false, message: 'An active roadmap is required' }); const err = await validateObjectives(req.body.objectives || [], roadmap); if (err) return res.status(400).json({ success: false, message: err }); const data = await PlannedSession.create({ ...req.body, schoolId, roadmapId: roadmap._id, roadmapVersion: roadmap.version, createdBy: req.user._id, updatedBy: req.user._id, status: 'draft' }); res.status(201).json({ success: true, data }); } catch (e) { res.status(400).json({ success: false, message: e.code === 11000 ? 'Session sequence already exists for this roadmap' : e.message }); }
});
router.patch('/:id/activate', authorize(...admins), async (req, res) => {
  try {
    const schoolId = tenant(req, req.body?.schoolId || req.query.schoolId);
    if (!validId(schoolId) || !validId(req.params.id)) return res.status(404).json({ success: false, message: 'Planned session not found' });
    const current = await PlannedSession.findOne({ _id: req.params.id, schoolId });
    if (!current) return res.status(404).json({ success: false, message: 'Planned session not found' });
    if (current.status === 'active') return res.status(409).json({ success: false, message: 'Planned session is already active' });
    if (current.status === 'archived') return res.status(409).json({ success: false, message: 'Archived planned sessions cannot be activated' });
    const roadmap = await roadmapFor(req, current.roadmapId, schoolId);
    if (!roadmap || roadmap.version !== current.roadmapVersion) return res.status(409).json({ success: false, message: 'Roadmap version is no longer available' });
    const data = await PlannedSession.findOneAndUpdate(
      { _id: current._id, schoolId, status: 'draft' },
      { $set: { status: 'active', updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );
    if (!data) return res.status(409).json({ success: false, message: 'Planned session changed before activation; retry' });
    res.json({ success: true, data });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});
router.put('/:id', authorize(...admins), async (req, res) => {
  try { const schoolId = tenant(req, req.body.schoolId || req.query.schoolId); if (!validId(schoolId) || !validId(req.params.id)) return res.status(404).json({ success: false, message: 'Planned session not found' }); const current = await PlannedSession.findOne({ _id: req.params.id, schoolId }); if (!current) return res.status(404).json({ success: false, message: 'Planned session not found' }); if (current.status !== 'draft') return res.status(409).json({ success: false, message: 'Only draft planned sessions are editable' }); const roadmap = await roadmapFor(req, current.roadmapId, schoolId); if (!roadmap || roadmap.version !== current.roadmapVersion) return res.status(409).json({ success: false, message: 'Roadmap version is no longer available' }); const body = { ...req.body }; delete body.schoolId; delete body.roadmapId; delete body.roadmapVersion; delete body.sequence; delete body.status; delete body.createdBy; delete body.updatedBy; delete body._id; delete body.__v; if (body.objectives) { const err = await validateObjectives(body.objectives, roadmap); if (err) return res.status(400).json({ success: false, message: err }); } Object.assign(current, body, { updatedBy: req.user._id }); await current.save(); res.json({ success: true, data: current }); } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});
router.delete('/:id', authorize(...admins), async (req, res) => {
  try { const schoolId = tenant(req, req.body?.schoolId || req.query.schoolId); if (!validId(schoolId) || !validId(req.params.id)) return res.status(404).json({ success: false, message: 'Planned session not found' }); const data = await PlannedSession.findOneAndUpdate({ _id: req.params.id, schoolId, status: { $ne: 'archived' } }, { $set: { status: 'archived', updatedBy: req.user._id } }, { new: true }); if (!data) return res.status(404).json({ success: false, message: 'Planned session not found' }); res.json({ success: true, data }); } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});
module.exports = router;
