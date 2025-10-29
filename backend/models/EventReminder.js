const mongoose = require('mongoose');

const eventReminderSchema = new mongoose.Schema({
  // Event Reference
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  
  // Reminder Type
  reminderType: {
    type: String,
    enum: ['immediate', 'twoDaysBefore', 'oneDayBefore', 'update', 'cancellation'],
    required: true
  },
  
  // Recipient Information
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientName: {
    type: String,
    required: true
  },
  recipientEmail: String,
  recipientPhone: String,
  
  // Delivery Channels
  channels: {
    email: {
      sent: { type: Boolean, default: false },
      status: { 
        type: String, 
        enum: ['pending', 'sent', 'failed', 'bounced'],
        default: 'pending'
      },
      sentAt: Date,
      error: String
    },
    sms: {
      sent: { type: Boolean, default: false },
      status: { 
        type: String, 
        enum: ['pending', 'sent', 'failed', 'delivered'],
        default: 'pending'
      },
      sentAt: Date,
      messageId: String,
      error: String
    },
    whatsapp: {
      sent: { type: Boolean, default: false },
      status: { 
        type: String, 
        enum: ['pending', 'sent', 'failed', 'delivered', 'read'],
        default: 'pending'
      },
      sentAt: Date,
      messageId: String,
      error: String
    }
  },
  
  // School Association
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  
  // Overall Status
  overallStatus: {
    type: String,
    enum: ['pending', 'partial', 'complete', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Indexes for performance
eventReminderSchema.index({ eventId: 1, reminderType: 1 });
eventReminderSchema.index({ schoolId: 1, createdAt: -1 });
eventReminderSchema.index({ recipientId: 1 });

// Method to update overall status based on channel statuses
eventReminderSchema.methods.updateOverallStatus = function() {
  const emailSent = this.channels.email.sent;
  const smsSent = this.channels.sms.sent;
  const whatsappSent = this.channels.whatsapp.sent;
  
  const sentCount = [emailSent, smsSent, whatsappSent].filter(Boolean).length;
  
  if (sentCount === 0) {
    this.overallStatus = 'failed';
  } else if (sentCount === 3) {
    this.overallStatus = 'complete';
  } else {
    this.overallStatus = 'partial';
  }
  
  return this.overallStatus;
};

module.exports = mongoose.model('EventReminder', eventReminderSchema);

