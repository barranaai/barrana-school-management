const mongoose = require('mongoose');
const historySchema = new mongoose.Schema({
  levelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', required: true },
  effectiveFrom: { type: Date, required: true }, effectiveTo: Date,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, trim: true }
}, { _id: true });
const classAssignmentSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  effectiveFrom: { type: Date, required: true }, effectiveTo: Date,
  status: { type: String, enum: ['active','ended'], default: 'active' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, reason: { type: String, trim: true }
}, { _id: true });
const staffAssignmentSchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, role: { type: String, trim: true, required: true },
  effectiveFrom: { type: Date, required: true }, effectiveTo: Date,
  primary: { type: Boolean, default: false }, status: { type: String, enum: ['active','ended'], default: 'active' }
}, { _id: true });
const statusSchema = new mongoose.Schema({ status: { type: String, enum: ['pending','active','paused','completed','withdrawn','cancelled'], required: true }, changedAt: { type: Date, default: Date.now }, changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, reason: String }, { _id: true });
const enrollmentSchema = new mongoose.Schema({
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  currentLevelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Level', default: null },
  currentClassId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  status: { type: String, enum: ['pending','active','paused','completed','withdrawn','cancelled'], default: 'pending', index: true },
  startDate: { type: Date, required: true, default: Date.now }, endDate: Date,
  statusHistory: { type: [statusSchema], default: [] }, levelHistory: { type: [historySchema], default: [] },
  classAssignments: { type: [classAssignmentSchema], default: [] }, staffAssignments: { type: [staffAssignmentSchema], default: [] }
}, { timestamps: true });
enrollmentSchema.index({ schoolId: 1, childId: 1, programId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
module.exports = mongoose.model('Enrollment', enrollmentSchema);

