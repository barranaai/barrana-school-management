const mongoose = require('mongoose');

const reportTemplateSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: [true, 'School ID is required']
  },
  
  // Grade Level
  grade: {
    type: String,
    required: [true, 'Grade is required'],
    trim: true
  },
  

  
  // Report Frequency
  reportFrequency: {
    type: String,
    enum: ['Daily', 'Weekly', 'Bi-Weekly', 'Bi-Monthly', 'Monthly', 'Quarterly', 'Annually'],
    required: [true, 'Report frequency is required'],
    default: 'Monthly'
  },
  
  // Template Content
  content: {
    type: String,
    trim: true,
    maxlength: [5000, 'Template content cannot exceed 5000 characters']
  },
  
  // AI Prompt for Dynamic Report Generation
  aiPrompt: {
    type: String,
    trim: true,
    maxlength: [10000, 'AI prompt cannot exceed 10000 characters'],
    default: null, // Optional field - will use static template if not provided
    validate: {
      validator: function(v) {
        // Allow null/undefined (optional field) or non-empty string
        return v === null || v === undefined || (typeof v === 'string' && v.trim().length > 0);
      },
      message: 'AI prompt must be a non-empty string if provided'
    }
  },
  
  // Custom Fields
  customFields: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'rating', 'percentage', 'checkbox'],
      required: true
    },
    isRequired: {
      type: Boolean,
      default: false
    },
    options: [String], // For dropdown or checkbox options
    defaultValue: String
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  },
  
  // Last Modified
  lastModified: {
    type: Date,
    default: Date.now
  },
  
  // Usage Statistics
  usage: {
    totalReportsGenerated: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    }
  },
  
  // Template Settings
  settings: {
    includeStudentPhoto: {
      type: Boolean,
      default: true
    },
    includeTeacherSignature: {
      type: Boolean,
      default: true
    },
    includeSchoolLogo: {
      type: Boolean,
      default: true
    },
    autoSendToParents: {
      type: Boolean,
      default: false
    },
    requireTeacherApproval: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
reportTemplateSchema.index({ schoolId: 1, grade: 1, isActive: 1 });
reportTemplateSchema.index({ schoolId: 1, reportFrequency: 1 });

// Virtual for full template name
reportTemplateSchema.virtual('fullName').get(function() {
  return `${this.name} - ${this.grade}`;
});

// Pre-save middleware to update lastModified
reportTemplateSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

// Static method to get templates by school and grade
reportTemplateSchema.statics.findBySchoolAndGrade = function(schoolId, grade) {
  return this.find({ schoolId, grade, isActive: true });
};

// Static method to get templates by frequency
reportTemplateSchema.statics.findByFrequency = function(schoolId, frequency) {
  return this.find({ schoolId, reportFrequency: frequency, isActive: true });
};

// Instance method to increment usage
reportTemplateSchema.methods.incrementUsage = function() {
  this.usage.totalReportsGenerated += 1;
  this.usage.lastUsed = new Date();
  return this.save();
};

const ReportTemplate = mongoose.model('ReportTemplate', reportTemplateSchema);

module.exports = ReportTemplate; 