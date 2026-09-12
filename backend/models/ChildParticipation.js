const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  deliveredSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveredSession', required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  status: { type: String, enum: ['active', 'excused', 'absent', 'cancelled'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.index({ schoolId: 1, deliveredSessionId: 1, childId: 1 }, { unique: true });
module.exports = mongoose.model('ChildParticipation', schema);
