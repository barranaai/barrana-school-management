const mongoose = require('mongoose');

const parentGroupSchema = new mongoose.Schema({
  // Group Information
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  
  // Members (Parents)
  members: [{
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Group Type
  type: {
    type: String,
    enum: ['custom', 'auto_grade', 'auto_class'],
    default: 'custom'
  },
  
  // Auto-generated criteria (if auto type)
  autoGrade: String,
  autoClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for performance
parentGroupSchema.index({ schoolId: 1, isActive: 1 });
parentGroupSchema.index({ 'members.parentId': 1 });

// Virtual for member count
parentGroupSchema.virtual('memberCount').get(function() {
  return this.members ? this.members.length : 0;
});

// Method to add member
parentGroupSchema.methods.addMember = function(parentId) {
  const exists = this.members.some(m => m.parentId.toString() === parentId.toString());
  if (!exists) {
    this.members.push({ parentId, addedAt: new Date() });
  }
  return this;
};

// Method to remove member
parentGroupSchema.methods.removeMember = function(parentId) {
  this.members = this.members.filter(m => m.parentId.toString() !== parentId.toString());
  return this;
};

// Method to check if user is member
parentGroupSchema.methods.isMember = function(parentId) {
  return this.members.some(m => m.parentId.toString() === parentId.toString());
};

module.exports = mongoose.model('ParentGroup', parentGroupSchema);

