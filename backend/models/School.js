const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    maxlength: [100, 'School name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Contact Information
  contactPerson: {
    name: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      default: 'Administrator'
    }
  },
  
  // Address Information
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required']
    },
    city: {
      type: String,
      required: [true, 'City is required']
    },
    state: {
      type: String,
      required: [true, 'State is required']
    },
    zipCode: {
      type: String,
      required: [true, 'ZIP code is required']
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      default: 'Canada'
    }
  },
  
  // School Details
  schoolType: {
    type: String,
    enum: ['licensed_daycare', 'montessori_school', 'public_private_school'],
    required: [true, 'School type is required']
  },
  gradeLevels: {
    type: [String],
    default: []
  },
  estimatedStudents: {
    type: Number,
    required: [true, 'Estimated number of students is required'],
    min: [1, 'Must have at least 1 student']
  },
  
  // Subscription & Billing
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      required: [true, 'Subscription plan is required'],
      default: 'basic'
    },
    status: {
      type: String,
      enum: ['active', 'trial', 'suspended', 'cancelled'],
      default: 'trial'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    trialEndDate: {
      type: Date,
      default: function() {
        return new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days trial
      }
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String
  },
  
  // Onboarding Status
  onboardingStatus: {
    type: String,
    enum: ['pending', 'setup', 'live', 'completed'],
    default: 'pending'
  },
  onboardingSteps: {
    profileSetup: { type: Boolean, default: false },
    adminCreated: { type: Boolean, default: false },
    teachersInvited: { type: Boolean, default: false },
    studentsImported: { type: Boolean, default: false },
    firstReportGenerated: { type: Boolean, default: false }
  },
  
  // System Configuration
  settings: {
    timezone: {
      type: String,
      default: 'UTC'
    },
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'ar']
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    currency: {
      type: String,
      default: 'USD'
    },
    notifications: {
      emailReports: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
      systemUpdates: { type: Boolean, default: true }
    },
    // Report Frequency Configuration
    reportFrequencies: {
      Daily: {
        enabled: { type: Boolean, default: true },
        dueDay: { type: Number, default: 1, min: 1, max: 7 }, // 1 = Monday, 7 = Sunday (deprecated, use workingDays)
        workingDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // Array of working days (1=Monday, 7=Sunday)
        dueTime: { type: String, default: '17:00' }, // 24-hour format
        skipWeekends: { type: Boolean, default: true },
        skipHolidays: { type: Boolean, default: true }
      },
      Weekly: {
        enabled: { type: Boolean, default: true },
        dueDay: { type: Number, default: 5, min: 1, max: 7 }, // Friday
        dueTime: { type: String, default: '17:00' },
        skipWeekends: { type: Boolean, default: true },
        skipHolidays: { type: Boolean, default: true }
      },
      'Bi-Weekly': {
        enabled: { type: Boolean, default: true },
        dueTime: { type: String, default: '17:00' },
        skipWeekends: { type: Boolean, default: true },
        skipHolidays: { type: Boolean, default: true },
        rule: { type: String, default: 'alternateWeeks', enum: ['alternateWeeks', 'specificWeeks', 'nthWeekOfMonth'] },
        dueDay: { type: Number, default: 5, min: 1, max: 7 }, // Day of week (1=Monday, 7=Sunday)
        specificWeeks: [{ type: Number, min: 1, max: 5 }], // Array of week numbers (1-5)
        nthWeekOfMonth: {
          n: { type: Number, default: 1, min: -1, max: 4 }, // -1 for last, 1-4 for nth
          week: { type: Number, default: 3, min: 1, max: 5 } // Week number (1-5)
        }, // Only used if rule is 'nthWeekOfMonth'
        weekendPolicy: { type: String, default: 'nextWorkingDay', enum: ['nextWorkingDay', 'previousWorkingDay', 'nearestWorkingDay', 'none'] },
        startWeek: { type: Number, default: 1, min: 1, max: 2 } // Which week to start (1 or 2)
      },
      'Bi-Monthly': {
        enabled: { type: Boolean, default: true },
        dueTime: { type: String, default: '17:00' },
        skipWeekends: { type: Boolean, default: true },
        skipHolidays: { type: Boolean, default: true },
        rule: { type: String, default: 'lastWorkingDay', enum: ['specificDate', 'lastDay', 'lastWorkingDay', 'nthWeekday'] },
        specificDay: { type: Number, default: 28, min: 1, max: 31 }, // Only used if rule is 'specificDate'
        nthWeekday: {
          n: { type: Number, default: 1, min: -1, max: 4 }, // -1 for last, 1-4 for nth
          weekday: { type: Number, default: 5, min: 1, max: 7 } // 1=Monday, 7=Sunday
        }, // Only used if rule is 'nthWeekday'
        weekendPolicy: { type: String, default: 'nextWorkingDay', enum: ['nextWorkingDay', 'previousWorkingDay', 'nearestWorkingDay', 'none'] },
        startMonth: { type: Number, default: 9, min: 1, max: 12 } // September (1-based)
      },
      Monthly: {
        enabled: { type: Boolean, default: true },
        dueTime: { type: String, default: '17:00' },
        skipWeekends: { type: Boolean, default: true },
        skipHolidays: { type: Boolean, default: true },
        rule: { type: String, default: 'lastWorkingDay', enum: ['specificDate', 'lastDay', 'lastWorkingDay', 'nthWeekday'] },
        specificDay: { type: Number, default: 28, min: 1, max: 31 }, // Only used if rule is 'specificDate'
        nthWeekday: {
          n: { type: Number, default: 1, min: -1, max: 4 }, // -1 for last, 1-4 for nth
          weekday: { type: Number, default: 5, min: 1, max: 7 } // 1=Monday, 7=Sunday
        }, // Only used if rule is 'nthWeekday'
        weekendPolicy: { type: String, default: 'nextWorkingDay', enum: ['nextWorkingDay', 'previousWorkingDay', 'nearestWorkingDay', 'none'] }
      },
      Quarterly: {
        enabled: { type: Boolean, default: true },
        dueTime: { type: String, default: '17:00' },
        skipWeekends: { type: Boolean, default: true },
        skipHolidays: { type: Boolean, default: true },
        quarters: {
          q1: {
            enabled: { type: Boolean, default: true },
            month: { type: Number, default: 10, min: 1, max: 12 }, // October
            day: { type: Number, default: 30, min: 1, max: 31 }
          },
          q2: {
            enabled: { type: Boolean, default: true },
            month: { type: Number, default: 1, min: 1, max: 12 }, // January
            day: { type: Number, default: 15, min: 1, max: 31 }
          },
          q3: {
            enabled: { type: Boolean, default: true },
            month: { type: Number, default: 3, min: 1, max: 12 }, // March
            day: { type: Number, default: 30, min: 1, max: 31 }
          },
          q4: {
            enabled: { type: Boolean, default: true },
            month: { type: Number, default: 6, min: 1, max: 12 }, // June
            day: { type: Number, default: 10, min: 1, max: 31 }
          }
        }
      },
      Annually: {
        enabled: { type: Boolean, default: true },
        dueDay: { type: Number, default: 615, min: 100, max: 1231 }, // June 15th (6 * 100 + 15), format: MMDD
        dueTime: { type: String, default: '17:00' },
        skipWeekends: { type: Boolean, default: false }, // Not applicable for annual reports
        skipHolidays: { type: Boolean, default: false }  // Not applicable for annual reports
      }
    },
    // School Calendar Configuration
    calendar: {
      schoolYear: {
        startMonth: { type: Number, default: 9, min: 1, max: 12 }, // September
        startDay: { type: Number, default: 1, min: 1, max: 31 },
        endMonth: { type: Number, default: 6, min: 1, max: 12 }, // June
        endDay: { type: Number, default: 30, min: 1, max: 31 }
      },
      holidays: [{
        name: { type: String, required: true },
        date: { type: Date, required: true },
        isRecurring: { type: Boolean, default: false },
        description: String
      }],
      workingDays: {
        monday: { type: Boolean, default: true },
        tuesday: { type: Boolean, default: true },
        wednesday: { type: Boolean, default: true },
        thursday: { type: Boolean, default: true },
        friday: { type: Boolean, default: true },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false }
      }
    }
  },
  
  // Branding
  branding: {
    logo: String,
    primaryColor: {
      type: String,
      default: '#1976d2'
    },
    secondaryColor: {
      type: String,
      default: '#dc004e'
    },
    customDomain: String
  },
  
  // Communication Configuration
  communication: {
    whatsapp: {
      enabled: {
        type: Boolean,
        default: false
      },
      phoneNumber: {
        type: String,
        trim: true,
        validate: {
          validator: function(v) {
            if (!v) return true; // Allow empty
            return /^\+[1-9]\d{7,14}$/.test(v); // E.164 format
          },
          message: props => `${props.value} is not a valid WhatsApp number! Use E.164 format: +1234567890`
        }
      },
      twilioAccountSid: {
        type: String,
        trim: true
      },
      twilioAuthToken: {
        type: String,
        trim: true
      },
      displayName: {
        type: String,
        trim: true
      }
    },
    email: {
      enabled: {
        type: Boolean,
        default: true
      },
      fromName: {
        type: String,
        trim: true
      },
      fromEmail: {
        type: String,
        trim: true,
        lowercase: true
      },
      replyTo: {
        type: String,
        trim: true,
        lowercase: true
      }
    },
    sms: {
      enabled: {
        type: Boolean,
        default: false
      },
      phoneNumber: {
        type: String,
        trim: true,
        validate: {
          validator: function(v) {
            if (!v) return true; // Allow empty
            return /^\+[1-9]\d{7,14}$/.test(v); // E.164 format
          },
          message: props => `${props.value} is not a valid SMS number! Use E.164 format: +1234567890`
        }
      },
      twilioAccountSid: {
        type: String,
        trim: true
      },
      twilioAuthToken: {
        type: String,
        trim: true
      }
    }
  },
  
  // Usage Statistics
  usage: {
    totalStudents: {
      type: Number,
      default: 0
    },
    totalTeachers: {
      type: Number,
      default: 0
    },
    totalReports: {
      type: Number,
      default: 0
    },
    storageUsed: {
      type: Number,
      default: 0 // in MB
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Notes (for Barrana.ai staff)
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full address
schoolSchema.virtual('fullAddress').get(function() {
  const addr = this.address;
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
});

// Virtual for subscription status
schoolSchema.virtual('isSubscriptionActive').get(function() {
  if (this.subscription.status === 'trial') {
    return this.subscription.trialEndDate > new Date();
  }
  return this.subscription.status === 'active';
});

// Virtual for onboarding progress
schoolSchema.virtual('onboardingProgress').get(function() {
  const steps = Object.values(this.onboardingSteps);
  const completed = steps.filter(step => step).length;
  return Math.round((completed / steps.length) * 100);
});

// Indexes for performance
schoolSchema.index({ slug: 1 });
schoolSchema.index({ 'contactPerson.email': 1 });
schoolSchema.index({ 'subscription.status': 1 });
schoolSchema.index({ isActive: 1 });
schoolSchema.index({ 'subscription.plan': 1 });

// Pre-save middleware to generate slug
schoolSchema.pre('save', function(next) {
  if (!this.isModified('name')) return next();
  
  this.slug = this.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
    
  next();
});

// Static method to find active schools
schoolSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find schools by subscription status
schoolSchema.statics.findBySubscriptionStatus = function(status) {
  return this.find({ 'subscription.status': status });
};

// Instance method to update usage statistics
schoolSchema.methods.updateUsageStats = function() {
  return this.model('User').countDocuments({ 
    schoolId: this._id, 
    isActive: true 
  }).then(userCount => {
    return this.model('Student').countDocuments({ 
      schoolId: this._id, 
      isActive: true 
    }).then(studentCount => {
      return this.model('Report').countDocuments({ 
        schoolId: this._id 
      }).then(reportCount => {
        this.usage.totalStudents = studentCount;
        this.usage.totalTeachers = userCount;
        this.usage.totalReports = reportCount;
        this.usage.lastActivity = new Date();
        return this.save();
      });
    });
  });
};

module.exports = mongoose.model('School', schoolSchema); 