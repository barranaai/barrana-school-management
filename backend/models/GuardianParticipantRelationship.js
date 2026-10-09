const mongoose = require('mongoose');

const permissionsSchema = new mongoose.Schema({
  canViewProfile: { type: Boolean, default: true },
  canViewReports: { type: Boolean, default: true },
  canReceiveCommunications: { type: Boolean, default: true },
  canManageMeetings: { type: Boolean, default: true },
  canViewIncidents: { type: Boolean, default: true }
}, { _id: false });

const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  guardianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  relationshipType: { type: String, enum: ['parent', 'legal_guardian', 'caregiver', 'other'], required: true },
  isPrimaryContact: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'active', 'revoked'], default: 'pending' },
  permissions: { type: permissionsSchema, default: () => ({}) },
  activatedAt: Date,
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revocationReason: { type: String, trim: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lifecycleHistory: [{
    fromStatus: { type: String, enum: ['pending', 'active', 'revoked'] },
    toStatus: { type: String, enum: ['pending', 'active', 'revoked'], required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, trim: true, maxlength: 500 }
  }]
}, { timestamps: true });

schema.index({ schoolId: 1, guardianId: 1, participantId: 1 }, { unique: true });
schema.index({ schoolId: 1, guardianId: 1, status: 1 });
schema.index({ schoolId: 1, participantId: 1, status: 1 });
schema.index(
  { schoolId: 1, participantId: 1, isPrimaryContact: 1 },
  { unique: true, partialFilterExpression: { isPrimaryContact: true, status: 'active' } }
);

module.exports = mongoose.model('GuardianParticipantRelationship', schema);
