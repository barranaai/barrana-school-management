const mongoose = require('mongoose');

const snapshotObjectiveSchema = new mongoose.Schema({
  // Optional for legacy snapshots; new snapshots copy the Planned Session objective ID.
  objectiveId: { type: mongoose.Schema.Types.ObjectId },
  sequence: Number, title: String, description: String, requirementId: mongoose.Schema.Types.ObjectId,
  requirementLabel: String, parameterId: mongoose.Schema.Types.ObjectId, parameterLabel: String,
  expectedOutcome: String, instructionalGuidance: String, metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

const plannedSessionSnapshotSchema = new mongoose.Schema({
  plannedSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlannedSession', required: true },
  roadmapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', required: true },
  roadmapVersion: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  description: String,
  objectives: { type: [snapshotObjectiveSchema], required: true },
  expectedOutcomes: { type: [String], required: true },
  methodology: { type: String, required: true }
}, { _id: false });

const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  plannedSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlannedSession', required: true, index: true },
  roadmapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
  roadmapVersion: { type: Number, required: true, min: 1 },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true, index: true },
  scheduledAt: { type: Date, required: true },
  deliveredAt: { type: Date },
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled', index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  plannedSessionSnapshot: { type: plannedSessionSnapshotSchema, required: true },
  deliveryNotes: { type: String, maxlength: 10000 },
  methodologyAdjustments: { type: String, maxlength: 10000 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  deliveredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

schema.index({ schoolId: 1, classId: 1, scheduledAt: 1 });
module.exports = mongoose.model('DeliveredSession', schema);
