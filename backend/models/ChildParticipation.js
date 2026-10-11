const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  deliveredSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveredSession', required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true },
  levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
  deliveryMode: { type: String, enum: ['group', 'individual'], default: 'group' },
  classId: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null,
    required() { return (this.deliveryMode || 'group') === 'group'; }
  },
  status: { type: String, enum: ['active', 'excused', 'absent', 'cancelled'], default: 'active', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
schema.pre('validate', function validateDeliveryContext(next) {
  if (this.deliveryMode === 'individual' && this.classId) return next(new Error('Individual participation cannot reference a Delivery Group'));
  next();
});
schema.index({ schoolId: 1, deliveredSessionId: 1, childId: 1 }, { unique: true });
module.exports = mongoose.model('ChildParticipation', schema);
