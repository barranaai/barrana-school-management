const mongoose = require('mongoose');

const onboardingRequestSchema = new mongoose.Schema({
  normalizedEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  lastName: { type: String, required: true, trim: true, maxlength: 50 },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null },
  invalidatedAt: { type: Date, default: null }
}, { timestamps: true });

onboardingRequestSchema.index({ normalizedEmail: 1, createdAt: -1 });
onboardingRequestSchema.index({ tokenHash: 1 }, { unique: true });
onboardingRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OnboardingRequest', onboardingRequestSchema);
