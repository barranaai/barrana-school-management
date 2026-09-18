const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  slug: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  version: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['draft', 'published', 'retired'], default: 'draft', index: true },
  organizationTypes: { type: [String], default: [] },
  definition: { type: mongoose.Schema.Types.Mixed, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: Date
}, { timestamps: true });
schema.index({ slug: 1, version: 1 }, { unique: true });
module.exports = mongoose.model('StandardPackage', schema);
