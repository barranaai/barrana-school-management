const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Class name is required'],
    trim: true,
    maxlength: [100, 'Class name cannot exceed 100 characters']
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Class Details
  grade: {
    type: String,
    required: [true, 'Grade is required'],
    trim: true
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  
  // Status Management
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  
  // Teacher Assignments
  assignedTeachers: [{
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['primary', 'secondary', 'assistant'],
      default: 'primary'
    },
    assignedDate: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Class Schedule
  schedule: {
    academicYear: {
      type: String,
      required: [true, 'Academic year is required']
    },
    semester: {
      type: String,
      enum: ['fall', 'spring', 'summer'],
      default: 'fall'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    }
  },
  
  // Capacity and Enrollment
  capacity: {
    type: Number,
    default: 25,
    min: [1, 'Capacity must be at least 1']
  },
  
  currentEnrollment: {
    type: Number,
    default: 0,
    min: [0, 'Current enrollment cannot be negative']
  },
  
  // Academic Information
  subjects: [{
    type: String,
    trim: true
  }],
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if class is full
classSchema.virtual('isFull').get(function() {
  return this.currentEnrollment >= this.capacity;
});

// Virtual for available spots
classSchema.virtual('availableSpots').get(function() {
  return Math.max(0, this.capacity - this.currentEnrollment);
});

// Index for efficient queries
classSchema.index({ schoolId: 1, status: 1 });
classSchema.index({ assignedTeachers: 1 });
classSchema.index({ name: 1, schoolId: 1 });

// Pre-save middleware to generate slug
classSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

// Static method to find classes by school
classSchema.statics.findBySchool = function(schoolId) {
  return this.find({ schoolId, isActive: true }).populate('assignedTeachers.teacherId', 'firstName lastName email');
};

// Instance method to add teacher
classSchema.methods.addTeacher = function(teacherId, role = 'primary') {
  const existingAssignment = this.assignedTeachers.find(
    assignment => assignment.teacherId.toString() === teacherId.toString()
  );
  
  if (!existingAssignment) {
    this.assignedTeachers.push({
      teacherId,
      role,
      assignedDate: new Date()
    });
  }
  
  return this.save();
};

// Instance method to remove teacher
classSchema.methods.removeTeacher = function(teacherId) {
  this.assignedTeachers = this.assignedTeachers.filter(
    assignment => assignment.teacherId.toString() !== teacherId.toString()
  );
  return this.save();
};

module.exports = mongoose.model('Class', classSchema); 