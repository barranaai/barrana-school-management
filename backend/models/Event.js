const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  
  // Date Information
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required'],
    validate: {
      validator: function(value) {
        // During updates, this.startDate might be a getter, so we need to handle both cases
        const startDate = this.startDate || this._update?.$set?.startDate;
        if (!startDate) return true; // If no startDate, skip validation
        
        // Compare only dates, ignoring time
        const endDateOnly = new Date(value).setHours(0, 0, 0, 0);
        const startDateOnly = new Date(startDate).setHours(0, 0, 0, 0);
        
        return endDateOnly >= startDateOnly;
      },
      message: 'End date must be after or equal to start date'
    }
  },
  isMultiDay: {
    type: Boolean,
    default: false
  },
  
  // Time Information
  reminderTime: {
    type: String, // Format: "HH:MM" (e.g., "09:00")
    required: [true, 'Reminder time is required'],
    default: '09:00'
  },
  
  // Event Category
  category: {
    type: String,
    enum: ['holiday', 'meeting', 'field_trip', 'sports_day', 'exam', 'parent_teacher_conference', 'workshop', 'ceremony', 'other'],
    default: 'other'
  },
  
  // Location
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  
  // Target Audience
  targetType: {
    type: String,
    enum: ['all', 'grade', 'class', 'group'],
    required: true,
    default: 'all'
  },
  targetGrade: {
    type: String,
    required: function() {
      return this.targetType === 'grade';
    }
  },
  targetClass: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: function() {
      return this.targetType === 'class';
    }
  },
  targetGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParentGroup',
    required: function() {
      return this.targetType === 'group';
    }
  },
  
  // Recurring Event Settings
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    type: String,
    enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly', 'custom'],
    default: 'none'
  },
  recurrenceInterval: {
    type: Number,
    default: 1,
    min: 1
  },
  recurrenceDays: {
    type: [Number], // 0 = Sunday, 1 = Monday, etc.
    default: []
  },
  recurrenceEndDate: {
    type: Date
  },
  recurrenceCount: {
    type: Number, // Maximum number of occurrences
    min: 1
  },
  parentEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event' // Reference to the parent recurring event
  },
  isRecurringInstance: {
    type: Boolean,
    default: false
  },
  recurringExceptions: {
    type: [Date], // Dates to skip in the recurring series
    default: []
  },
  
  // Reminder Status
  reminders: {
    immediate: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      recipientCount: { type: Number, default: 0 }
    },
    twoDaysBefore: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      recipientCount: { type: Number, default: 0 }
    },
    oneDayBefore: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      recipientCount: { type: Number, default: 0 }
    }
  },
  
  // Attachments (PDFs, images, videos)
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isCancelled: {
    type: Boolean,
    default: false
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
eventSchema.index({ schoolId: 1, startDate: 1 });
eventSchema.index({ schoolId: 1, category: 1 });
eventSchema.index({ startDate: 1, isActive: 1 });

// Virtual for checking if event is past
eventSchema.virtual('isPast').get(function() {
  return this.endDate < new Date();
});

// Virtual for checking if event is upcoming
eventSchema.virtual('isUpcoming').get(function() {
  return this.startDate > new Date();
});

// Virtual for checking if event is ongoing
eventSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
});

// Method to check if a reminder should be sent
eventSchema.methods.shouldSendReminder = function(reminderType) {
  const now = new Date();
  const eventStart = new Date(this.startDate);
  
  // Extract hours and minutes from reminderTime (format: "HH:MM")
  const [hours, minutes] = this.reminderTime.split(':').map(Number);
  
  switch(reminderType) {
    case 'immediate':
      return !this.reminders.immediate.sent;
      
    case 'twoDaysBefore':
      if (this.reminders.twoDaysBefore.sent) return false;
      const twoDaysBefore = new Date(eventStart);
      twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
      twoDaysBefore.setHours(hours, minutes, 0, 0);
      return now >= twoDaysBefore && now < eventStart;
      
    case 'oneDayBefore':
      if (this.reminders.oneDayBefore.sent) return false;
      const oneDayBefore = new Date(eventStart);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);
      oneDayBefore.setHours(hours, minutes, 0, 0);
      return now >= oneDayBefore && now < eventStart;
      
    default:
      return false;
  }
};

module.exports = mongoose.model('Event', eventSchema);

