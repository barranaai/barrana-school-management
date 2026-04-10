const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Report title is required'],
    trim: true,
    maxlength: [100, 'Report title cannot exceed 100 characters']
  },
  
  // Associations
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student ID is required']
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required']
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: [true, 'Template ID is required']
  },
  
  // Report Content
  content: {
    type: String,
    required: [true, 'Report content is required'],
    maxlength: [10000, 'Report content cannot exceed 10000 characters']
  },
  
  // Custom Field Values (from template)
  customFieldValues: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // Report Metadata
  reportType: {
    type: String,
    enum: ['progress', 'behavior', 'academic', 'development', 'general'],
    default: 'progress'
  },
  reportPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'sent', 'archived'],
    default: 'draft'
  },
  
  // Voice Recording Data
  voiceRecording: {
    hasRecording: {
      type: Boolean,
      default: false
    },
    recordings: [{
      url: String,
      duration: Number,
      transcription: String,
    }],
    // Legacy fields for backward compatibility
    recordingUrl: String, 
    recordingDuration: Number,
    transcription: String,
    isTranscribed: {
      type: Boolean,
      default: false
    }
  },
  
  // AI Generation Data
  aiGenerated: {
    isAiGenerated: {
      type: Boolean,
      default: false
    },
    originalTranscription: String,
    generationModel: String,
    generationPrompt: String,
    generatedAt: Date
  },
  
  // Approval Workflow
  approvals: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['teacher', 'school_admin', 'super_admin'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comments: String,
    approvedAt: Date
  }],
  
  // Parent Communication
  parentCommunication: {
    isSent: {
      type: Boolean,
      default: false
    },
    sentAt: Date,
    sentTo: [{
      parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      email: String,
      method: {
        type: String,
        enum: ['email', 'portal', 'both'],
        default: 'email'
      }
    }],
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: Date,
    parentFeedback: String
  },
  
  // Attachments and Media
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // PDF URL for generated report
  pdfUrl: {
    type: String,
    default: null
  },
  
  // Version Control
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    versionNumber: Number,
    content: String,
    customFieldValues: Map,
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    modifiedAt: {
      type: Date,
      default: Date.now
    },
    changeReason: String
  }],
  
  // Analytics and Tracking
  analytics: {
    viewCount: {
      type: Number,
      default: 0
    },
    lastViewed: Date,
    downloadCount: {
      type: Number,
      default: 0
    },
    shareCount: {
      type: Number,
      default: 0
    }
  },
  
  // Tags and Categories
  tags: [String],
  categories: [String],
  
  // Reminder and Follow-up
  followUp: {
    isRequired: {
      type: Boolean,
      default: false
    },
    dueDate: Date,
    dueDateTimezone: {
      type: String,
      default: 'UTC'
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date
  },
  
  // Notes (internal)
  internalNotes: {
    type: String,
    maxlength: [1000, 'Internal notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
reportSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });
reportSchema.index({ teacherId: 1, status: 1 });
reportSchema.index({ schoolId: 1, status: 1, createdAt: -1 });
reportSchema.index({ templateId: 1 });
reportSchema.index({ 'reportPeriod.startDate': 1, 'reportPeriod.endDate': 1 });

// Virtual for student name
reportSchema.virtual('studentName', {
  ref: 'User',
  localField: 'studentId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'firstName lastName' }
});

// Virtual for teacher name
reportSchema.virtual('teacherName', {
  ref: 'User',
  localField: 'teacherId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'firstName lastName' }
});

// Virtual for template name
reportSchema.virtual('templateName', {
  ref: 'ReportTemplate',
  localField: 'templateId',
  foreignField: '_id',
  justOne: true,
  options: { select: 'name' }
});

// Virtual for report period duration
reportSchema.virtual('reportDuration').get(function() {
  if (this.reportPeriod.startDate && this.reportPeriod.endDate) {
    const diffTime = Math.abs(this.reportPeriod.endDate - this.reportPeriod.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
  return 0;
});

// Pre-save middleware to update version
reportSchema.pre('save', function(next) {
  if (this.isModified('content') || this.isModified('customFieldValues')) {
    // Store previous version if content changed
    if (!this.isNew && (this.isModified('content') || this.isModified('customFieldValues'))) {
      this.previousVersions.push({
        versionNumber: this.version,
        content: this.content,
        customFieldValues: this.customFieldValues,
        modifiedAt: new Date()
      });
      this.version += 1;
    }
  }
  next();
});

// Static method to find reports by school
reportSchema.statics.findBySchool = function(schoolId, options = {}) {
  const query = { schoolId };
  if (options.status) query.status = options.status;
  if (options.teacherId) query.teacherId = options.teacherId;
  if (options.studentId) query.studentId = options.studentId;
  
  return this.find(query)
    .populate('studentId', 'firstName lastName grade')
    .populate('teacherId', 'firstName lastName')
    .populate('templateId', 'name reportFrequency')
    .sort({ createdAt: -1 });
};

// Static method to find reports by teacher
reportSchema.statics.findByTeacher = function(teacherId, options = {}) {
  const query = { teacherId };
  if (options.status) query.status = options.status;
  if (options.studentId) query.studentId = options.studentId;
  
  return this.find(query)
    .populate('studentId', 'firstName lastName grade')
    .populate('templateId', 'name reportFrequency')
    .sort({ createdAt: -1 });
};

// Static method to find reports by student
reportSchema.statics.findByStudent = function(studentId, options = {}) {
  const query = { studentId };
  if (options.status) query.status = options.status;
  
  return this.find(query)
    .populate('teacherId', 'firstName lastName')
    .populate('templateId', 'name reportFrequency')
    .sort({ createdAt: -1 });
};

// Instance method to approve report
reportSchema.methods.approve = function(userId, role, comments) {
  this.approvals.push({
    userId,
    role,
    status: 'approved',
    comments,
    approvedAt: new Date()
  });
  
  // If teacher approval, mark as approved
  if (role === 'teacher') {
    this.status = 'approved';
  }
  
  return this.save();
};

// Instance method to send to parents
reportSchema.methods.sendToParents = function(parentEmails) {
  this.parentCommunication.isSent = true;
  this.parentCommunication.sentAt = new Date();
  this.parentCommunication.sentTo = parentEmails.map(email => ({
    email,
    method: 'email'
  }));
  this.status = 'sent';
  
  return this.save();
};

// Instance method to increment view count
reportSchema.methods.incrementViewCount = function() {
  this.analytics.viewCount += 1;
  this.analytics.lastViewed = new Date();
  return this.save();
};

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;