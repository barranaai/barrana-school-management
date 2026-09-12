const mongoose = require('mongoose');
const objectiveResultSchema = new mongoose.Schema({
  objectiveId: { type: mongoose.Schema.Types.ObjectId, required: true }, sequence: { type: Number, required: true },
  title: { type: String, required: true }, description: String, expectedOutcome: String,
  status: { type: String, enum: ['achieved', 'partially_achieved', 'not_achieved', 'needs_improvement', 'not_observed'], required: true },
  instructorNote: String, evidence: String, metadata: mongoose.Schema.Types.Mixed
}, { _id: false });
const parameterResultSchema = new mongoose.Schema({
  requirementId: { type: mongoose.Schema.Types.ObjectId, required: true }, requirementLabel: { type: String, required: true },
  parameterId: { type: mongoose.Schema.Types.ObjectId, required: true }, parameterLabel: { type: String, required: true },
  type: { type: String, enum: ['text', 'rating', 'percentage', 'number', 'checkbox', 'select'], required: true },
  options: [String], value: { type: mongoose.Schema.Types.Mixed, required: true }, note: String
}, { _id: false });
const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  childParticipationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChildParticipation', required: true, index: true },
  objectiveResults: { type: [objectiveResultSchema], default: [] },
  parameterResults: { type: [parameterResultSchema], default: [] },
  observations: String, recommendations: String,
  overallStatus: { type: String, enum: ['in_progress', 'achieved', 'partially_achieved', 'needs_improvement'] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.index({ schoolId: 1, childParticipationId: 1 }, { unique: true });
module.exports = mongoose.model('Progress', schema);
