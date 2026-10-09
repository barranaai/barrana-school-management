const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const Progress = require('../models/Progress');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const PlannedSession = require('../models/PlannedSession');
const { eligibleObjectives, alreadyPresent, carryForwardObjective } = require('../services/objectiveCarryForwardService');

const router = express.Router();
const roles = ['school_admin', 'super_admin', 'teacher'];
const validId = value => mongoose.Types.ObjectId.isValid(value);
const id = value => String(value?._id || value || '');
const notFound = res => res.status(404).json({ success: false, message: 'Carry-forward context not found' });

async function context(req, progressId) {
  const schoolId = scopeSchoolId(req.user, req.body?.schoolId || req.query.schoolId);
  if (!validId(schoolId) || !validId(progressId)) return null;
  const progress = await Progress.findOne({ _id: progressId, schoolId });
  const participation = progress && await ChildParticipation.findOne({ _id: progress.childParticipationId, schoolId });
  const session = participation && await DeliveredSession.findOne({ _id: participation.deliveredSessionId, schoolId });
  if (!progress || !participation || !session || (req.user.role === 'teacher' && id(session.deliveredBy) !== id(req.user._id))) return null;
  return { schoolId, progress, participation, session };
}

function safeSuggestion(item, ctx, targets) {
  return {
    objectiveId: id(item.objective.objectiveId),
    status: item.result.status,
    title: item.objective.title,
    description: item.objective.description,
    expectedOutcome: item.objective.expectedOutcome,
    source: {
      progressId: id(ctx.progress),
      deliveredSessionId: id(ctx.session),
      plannedSessionId: id(ctx.session.plannedSessionId)
    },
    targets: targets.filter(target => !alreadyPresent(target, item.objective.objectiveId)).map(target => ({
      _id: id(target), title: target.title, sequence: target.sequence
    }))
  };
}

router.use(protect);
router.get('/:progressId', authorize(...roles), async (req, res) => {
  try {
    const ctx = await context(req, req.params.progressId);
    if (!ctx) return notFound(res);
    const targets = await PlannedSession.find({
      schoolId: ctx.schoolId,
      roadmapId: ctx.session.roadmapId,
      roadmapVersion: ctx.session.roadmapVersion,
      status: 'draft',
      _id: { $ne: ctx.session.plannedSessionId }
    }).sort({ sequence: 1 });
    const suggestions = eligibleObjectives(ctx.progress, ctx.session)
      .map(item => safeSuggestion(item, ctx, targets))
      .filter(item => item.targets.length);
    return res.json({ success: true, data: suggestions });
  } catch (_) {
    return res.status(500).json({ success: false, message: 'Unable to load carry-forward suggestions' });
  }
});

router.post('/:progressId/accept', authorize(...roles), async (req, res) => {
  try {
    const ctx = await context(req, req.params.progressId);
    if (!ctx || !validId(req.body.objectiveId) || !validId(req.body.targetPlannedSessionId)) return notFound(res);
    const item = eligibleObjectives(ctx.progress, ctx.session).find(entry => id(entry.objective.objectiveId) === id(req.body.objectiveId));
    if (!item) return res.status(409).json({ success: false, message: 'Objective is not eligible for carry-forward' });
    const target = await PlannedSession.findOne({
      _id: req.body.targetPlannedSessionId,
      schoolId: ctx.schoolId,
      roadmapId: ctx.session.roadmapId,
      roadmapVersion: ctx.session.roadmapVersion,
      status: 'draft'
    });
    if (!target) return res.status(409).json({ success: false, message: 'Target Planned Session is not compatible' });
    if (alreadyPresent(target, item.objective.objectiveId)) return res.status(409).json({ success: false, message: 'Objective is already present in the target Planned Session' });
    const edits = req.body.objective || {};
    const editable = ['title', 'description', 'expectedOutcome', 'instructionalGuidance'];
    const source = { ...item.objective };
    for (const field of editable) {
      if (Object.prototype.hasOwnProperty.call(edits, field)) {
        if (typeof edits[field] !== 'string') return res.status(400).json({ success: false, message: 'Objective edits are invalid' });
        source[field] = edits[field].trim();
      }
    }
    if (!source.title) return res.status(400).json({ success: false, message: 'Objective title is required' });
    const sourceObjectiveId = item.objective.objectiveId;
    const objective = carryForwardObjective(source, target, {
      sourceObjectiveId,
      sourceDeliveredSessionId: ctx.session._id,
      sourcePlannedSessionId: ctx.session.plannedSessionId,
      sourceProgressId: ctx.progress._id,
      sourceChildParticipationId: ctx.participation._id,
      sourceStatus: item.result.status,
      acceptedBy: req.user._id,
      acceptedAt: new Date()
    }, new mongoose.Types.ObjectId());
    const updated = await PlannedSession.findOneAndUpdate({
      _id: target._id,
      schoolId: ctx.schoolId,
      status: 'draft',
      __v: target.__v,
      'objectives._id': { $ne: sourceObjectiveId },
      'objectives.metadata.carryForward.sourceObjectiveId': { $ne: sourceObjectiveId }
    }, {
      $push: { objectives: objective },
      $set: { updatedBy: req.user._id },
      $inc: { __v: 1 }
    }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ success: false, message: 'Target Planned Session changed or already contains this objective' });
    return res.json({ success: true, data: { targetPlannedSessionId: id(updated), objectiveId: id(objective._id) } });
  } catch (_) {
    return res.status(400).json({ success: false, message: 'Unable to carry forward objective' });
  }
});

module.exports = router;
