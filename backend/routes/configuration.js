const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const Program = require('../models/Program');
const Level = require('../models/Level');
const Requirement = require('../models/Requirement');
const Parameter = require('../models/Parameter');
const router = express.Router();
const models = { programs: Program, levels: Level, requirements: Requirement, parameters: Parameter };
const admins = ['school_admin', 'super_admin'];
const validId = value => mongoose.Types.ObjectId.isValid(value);
const tenantId = (req, requested) => scopeSchoolId(req.user, requested);
const findOwned = (Model, id, schoolId) => validId(id) ? Model.findOne({ _id: id, schoolId }) : null;
const resolveTenant = (req, value) => req.user.role === 'super_admin' ? value : req.user.schoolId;

router.use(protect);
router.get('/:kind/:id', authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const Model = models[req.params.kind];
    const schoolId = tenantId(req, req.query.schoolId);
    if (!Model || !validId(req.params.id) || !schoolId) return res.status(404).json({ success: false, message: 'Configuration not found' });
    const data = await Model.findOne({ _id: req.params.id, schoolId });
    if (!data) return res.status(404).json({ success: false, message: 'Configuration not found' });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
router.get('/:kind', authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const Model = models[req.params.kind];
    if (!Model) return res.status(404).json({ success: false, message: 'Unknown configuration type' });
    const schoolId = tenantId(req, req.query.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, message: 'schoolId is required for scoped configuration access' });
    const query = { schoolId, isActive: true };
    if (req.params.kind === 'levels' && req.query.programId) query.programId = req.query.programId;
    if (req.params.kind === 'requirements' && req.query.levelId) query.levelId = req.query.levelId;
    if (req.params.kind === 'parameters' && req.query.requirementId) query.requirementId = req.query.requirementId;
    const data = await Model.find(query).sort({ sequence: 1, displayOrder: 1, name: 1 });
    res.json({ success: true, data });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});
router.post('/:kind', authorize(...admins), async (req, res) => {
  try {
    const Model = models[req.params.kind];
    if (!Model) return res.status(404).json({ success: false, message: 'Unknown configuration type' });
    const body = { ...req.body }; delete body.schoolId;
    const schoolId = resolveTenant(req, req.body.schoolId);
    if (!schoolId || !validId(schoolId)) return res.status(400).json({ success: false, message: 'Valid schoolId is required' });
    body.schoolId = schoolId;
    if (req.params.kind === 'levels') {
      const parent = await findOwned(Program, body.programId, schoolId);
      if (!parent || parent.isActive === false) return res.status(404).json({ success: false, message: 'Parent configuration not found' });
    }
    if (req.params.kind === 'requirements') {
      const parent = await findOwned(Level, body.levelId, schoolId);
      if (!parent || parent.isActive === false || (body.programId && String(body.programId) !== String(parent.programId))) return res.status(404).json({ success: false, message: 'Parent configuration not found' });
      body.programId = parent.programId;
    }
    if (req.params.kind === 'parameters') {
      const parent = await findOwned(Requirement, body.requirementId, schoolId);
      if (!parent || parent.isActive === false || (body.programId && String(body.programId) !== String(parent.programId))) return res.status(404).json({ success: false, message: 'Parent configuration not found' });
      body.programId = parent.programId;
    }
    if (req.params.kind === 'parameters' && body.type === 'select' && (!Array.isArray(body.options) || body.options.length === 0)) return res.status(400).json({ success: false, message: 'Select parameters require options' });
    const data = await Model.create(body);
    res.status(201).json({ success: true, data });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.put('/:kind/:id', authorize(...admins), async (req, res) => {
  try {
    const Model = models[req.params.kind];
    const schoolId = resolveTenant(req, req.body.schoolId || req.query.schoolId);
    if (!Model || !schoolId || !validId(schoolId) || !validId(req.params.id)) return res.status(404).json({ success: false, message: 'Configuration not found' });
    const current = await Model.findOne({ _id: req.params.id, schoolId });
    if (!current) return res.status(404).json({ success: false, message: 'Configuration not found' });
    const body = { ...req.body }; delete body.schoolId;
    const programId = body.programId || current.programId;
    if (req.params.kind === 'levels') { if (!await findOwned(Program, programId, schoolId)) return res.status(404).json({ success: false, message: 'Parent configuration not found' }); }
    if (req.params.kind === 'requirements') { const parent = await findOwned(Level, body.levelId || current.levelId, schoolId); if (!parent || String(parent.programId) !== String(programId)) return res.status(404).json({ success: false, message: 'Parent configuration not found' }); body.programId = parent.programId; }
    if (req.params.kind === 'parameters') { const parent = await findOwned(Requirement, body.requirementId || current.requirementId, schoolId); if (!parent || String(parent.programId) !== String(programId)) return res.status(404).json({ success: false, message: 'Parent configuration not found' }); body.programId = parent.programId; if (body.type === 'select' && (!Array.isArray(body.options) || body.options.length === 0)) return res.status(400).json({ success: false, message: 'Select parameters require options' }); }
    const data = await Model.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { ...body, schoolId } }, { new: true, runValidators: true });
    res.json({ success: true, data });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
router.delete('/:kind/:id', authorize(...admins), async (req, res) => {
  try {
    const Model = models[req.params.kind];
    const schoolId = resolveTenant(req, req.body?.schoolId || req.query.schoolId);
    if (!Model || !schoolId || !validId(schoolId) || !validId(req.params.id)) return res.status(400).json({ success: false, message: 'Explicit valid schoolId is required' });
    const data = await Model.findOneAndUpdate({ _id: req.params.id, schoolId }, { $set: { isActive: false } }, { new: true });
    if (!data) return res.status(404).json({ success: false, message: 'Configuration not found' });
    res.json({ success: true, data });
  } catch (error) { res.status(400).json({ success: false, message: error.message }); }
});
module.exports = router;