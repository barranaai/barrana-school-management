const mongoose = require('mongoose');

const objectiveSchema = new mongoose.Schema({
  sequence: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
  parameterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parameter' },
  expectedOutcome: { type: String, trim: true, maxlength: 5000 },
  instructionalGuidance: { type: String, trim: true, maxlength: 10000 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: true });

const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  roadmapId: { type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap', required: true, index: true },
  roadmapVersion: { type: Number, required: true, min: 1 },
  sequence: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  objectives: { type: [objectiveSchema], default: [] },
  expectedOutcomes: { type: [String], default: [] },
  methodology: { type: String, trim: true, maxlength: 10000 },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

schema.index({ schoolId: 1, roadmapId: 1, sequence: 1 }, { unique: true });
module.exports = mongoose.model('PlannedSession', schema);
