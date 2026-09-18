const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'StandardPackage', required: true, index: true },
  packageSlug: { type: String, required: true },
  packageVersion: { type: Number, required: true },
  adoptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adoptedAt: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['completed'], default: 'completed' },
  copiedRecords: {
    programIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Program' }],
    levelIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Level' }],
    requirementIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' }],
    parameterIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Parameter' }],
    roadmapIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Roadmap' }],
    plannedSessionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PlannedSession' }]
  }
}, { timestamps: true });
// Initial policy: an organization may adopt a specific package version only once.
schema.index({ schoolId: 1, packageId: 1 }, { unique: true });
module.exports = mongoose.model('StandardPackageAdoption', schema);
