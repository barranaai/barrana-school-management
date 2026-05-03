const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Added for password reset token generation

const userSchema = new mongoose.Schema({
  // Basic Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: function() {
      // Email not required for students
      return this.role !== 'student';
    },
    unique: true,
    sparse: true, // Allow multiple null values
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true, // All users need password to login
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Role and Permissions
  role: {
    type: String,
    enum: ['super_admin', 'school_admin', 'teacher', 'parent', 'student'],
    required: true,
    default: 'student'
  },
  
  // School Association (for multi-tenancy)
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: function() {
      return this.role !== 'super_admin';
    }
  },
  
  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty phone numbers
        if (!v) return true;
        // E.164 format: +[country code][subscriber number]
        // Should be between 8 and 15 digits after the +
        return /^\+[1-9]\d{7,14}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number! Use international format: +1234567890`
    }
  },
  phoneNumber: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        // Allow empty phone numbers
        if (!v) return true;
        // E.164 format: +[country code][subscriber number]
        // Should be between 8 and 15 digits after the +
        return /^\+[1-9]\d{7,14}$/.test(v);
      },
      message: props => `${props.value} is not a valid phone number! Use international format: +1234567890`
    }
  },
  address: {
    type: String,
    trim: true
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Password Reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Last Activity
  lastLogin: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  // Preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'ar']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false }
    }
  },
  
  // Firebase Cloud Messaging Tokens (for push notifications)
  fcmTokens: [{
    token: {
      type: String,
      required: true
    },
    device: {
      type: String,
      enum: ['web', 'ios', 'android'],
      default: 'web'
    },
    deviceInfo: {
      userAgent: String,
      platform: String,
      appVersion: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Teacher-specific fields
  grade: {
    type: String,
    required: function() {
      return this.role === 'teacher';
    }
  },
  specialization: {
    type: String,
    trim: true
  },
  qualifications: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  hireDate: {
    type: Date
  },
  subjects: [{
    type: String,
    trim: true
  }],
  performanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  trainingCompleted: [{
    type: String
  }],
  reportsGenerated: {
    type: Number,
    default: 0
  },
  avgTimePerReport: {
    type: Number,
    default: 0
  },
  efficiency: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  students: {
    type: Number,
    default: 0
  },

  // Teacher permissions (legacy field)
  canEmailReports: {
    type: Boolean,
    default: false
  },

  // Student-specific fields
  studentId: {
    type: String,
    required: function() {
      return this.role === 'student'; // Required for student role
    },
    unique: true,
    sparse: true, // Allow null for non-students
    trim: true,
    uppercase: true
  },
  studentGrade: {
    type: String,
    required: function() {
      return this.role === 'student'; // Required for student role
    }
  },
  studentClass: {
    type: String,
    trim: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: false
  },
  dateOfBirth: {
    type: Date
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  assignedTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Not required for students, will be auto-assigned via class
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to parent user account
    required: false
  },
  parentName: {
    type: String,
    trim: true
  },
  parentEmail: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  parentPhone: {
    type: String,
    trim: true
  },
  emergencyContact: {
    type: String,
    trim: true
  },
  medicalInfo: {
    allergies: [String],
    conditions: [String],
    medications: [String],
    dietaryRestrictions: [String]
  },
  academicLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  notifications: [{
    id: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['report', 'message', 'system', 'alert'],
      default: 'report'
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    data: {
      type: mongoose.Schema.Types.Mixed
    },
    isRead: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    readAt: {
      type: Date
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for display name
userSchema.virtual('displayName').get(function() {
  return this.fullName;
});

// Indexes for performance
// Sparse index on email - only applies to non-null emails, allowing multiple null emails
userSchema.index({ email: 1 }, { sparse: true });
userSchema.index({ schoolId: 1, role: 1 });
userSchema.index({ isActive: 1 });
// Index for student ID for fast lookups
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    schoolId: this.schoolId
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Instance method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
    
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Instance method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
    
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users by school
userSchema.statics.findActiveBySchool = function(schoolId) {
  return this.find({ schoolId, isActive: true });
};

module.exports = mongoose.model('User', userSchema); 