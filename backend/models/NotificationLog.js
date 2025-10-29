const mongoose = require('mongoose');

/**
 * NotificationLog Model
 * Comprehensive audit trail for all communications
 * Tracks every email, SMS, WhatsApp, and push notification
 */
const notificationLogSchema = new mongoose.Schema({
  // School reference
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  
  // Communication Details
  channel: {
    type: String,
    enum: ['email', 'sms', 'whatsapp', 'push', 'in_app'],
    required: true,
    index: true
  },
  
  type: {
    type: String,
    enum: ['report', 'event', 'reminder', 'welcome', 'system', 'announcement'],
    required: true,
    index: true
  },
  
  subType: {
    type: String,
    enum: ['immediate', '2days', '1day', 'update', 'cancellation', 'creation', 'daily', 'weekly', 'monthly'],
    default: 'immediate'
  },
  
  // Recipient Information
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  recipientName: {
    type: String,
    required: true,
    index: true
  },
  
  recipientEmail: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  
  recipientPhone: {
    type: String,
    trim: true,
    index: true
  },
  
  // Student/Class Context (for filtering)
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  studentName: String,
  
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    index: true
  },
  
  className: String,
  
  gradeLevel: {
    type: String,
    index: true
  },
  
  // Related Content
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event'
  },
  
  eventTitle: String,
  
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  
  reportTitle: String,
  
  // Message Content
  subject: {
    type: String,
    trim: true
  },
  
  messagePreview: {
    type: String,
    maxlength: 500,
    trim: true
  },
  
  // Status & Delivery
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending', 'queued', 'delivered', 'bounced', 'opened', 'clicked'],
    default: 'pending',
    required: true,
    index: true
  },
  
  sentAt: {
    type: Date,
    index: true
  },
  
  deliveredAt: Date,
  
  openedAt: Date,
  
  clickedAt: Date,
  
  // Error Handling
  error: {
    code: String,
    message: String,
    details: mongoose.Schema.Types.Mixed
  },
  
  retryCount: {
    type: Number,
    default: 0
  },
  
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Provider Information
  provider: {
    type: String,
    enum: ['nodemailer', 'twilio', 'firebase', 'custom'],
    default: 'nodemailer'
  },
  
  providerMessageId: String,
  
  providerResponse: mongoose.Schema.Types.Mixed,
  
  // Attachments
  hasAttachments: {
    type: Boolean,
    default: false
  },
  
  attachments: [{
    filename: String,
    size: Number,
    type: String
  }],
  
  // Cost Tracking (optional)
  estimatedCost: {
    type: Number,
    default: 0
  },
  
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Fallback Tracking
  isFallback: {
    type: Boolean,
    default: false
  },
  
  fallbackFrom: {
    type: String,
    enum: ['email', 'sms', 'whatsapp', 'push']
  },
  
  // Metadata
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String,
    timezone: String,
    additionalData: mongoose.Schema.Types.Mixed
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  createdByName: String,
  
  createdByRole: String

}, {
  timestamps: true,
  collection: 'notificationlogs'
});

// Indexes for efficient querying
notificationLogSchema.index({ schoolId: 1, createdAt: -1 });
notificationLogSchema.index({ schoolId: 1, channel: 1, status: 1 });
notificationLogSchema.index({ schoolId: 1, type: 1, createdAt: -1 });
notificationLogSchema.index({ schoolId: 1, recipientEmail: 1, createdAt: -1 });
notificationLogSchema.index({ schoolId: 1, recipientPhone: 1, createdAt: -1 });
notificationLogSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });
notificationLogSchema.index({ schoolId: 1, classId: 1, createdAt: -1 });
notificationLogSchema.index({ schoolId: 1, gradeLevel: 1, createdAt: -1 });
notificationLogSchema.index({ status: 1, sentAt: 1 });

// Text index for full-text search
notificationLogSchema.index({
  recipientName: 'text',
  recipientEmail: 'text',
  subject: 'text',
  messagePreview: 'text',
  eventTitle: 'text',
  reportTitle: 'text',
  studentName: 'text',
  className: 'text'
});

// Virtual for formatted date
notificationLogSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to mark as sent
notificationLogSchema.methods.markAsSent = function(messageId, response) {
  this.status = 'sent';
  this.sentAt = new Date();
  this.providerMessageId = messageId;
  this.providerResponse = response;
  return this.save();
};

// Method to mark as failed
notificationLogSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.error = {
    code: error.code,
    message: error.message,
    details: error
  };
  return this.save();
};

// Method to mark as delivered (for webhooks)
notificationLogSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

// Static method to get statistics
notificationLogSchema.statics.getStatistics = async function(schoolId, dateRange) {
  const matchQuery = { schoolId };
  
  if (dateRange && dateRange.from) {
    matchQuery.createdAt = { $gte: new Date(dateRange.from) };
  }
  if (dateRange && dateRange.to) {
    matchQuery.createdAt = { ...matchQuery.createdAt, $lte: new Date(dateRange.to) };
  }
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalNotifications: { $sum: 1 },
        sentCount: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
        failedCount: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        emailCount: { $sum: { $cond: [{ $eq: ['$channel', 'email'] }, 1, 0] } },
        smsCount: { $sum: { $cond: [{ $eq: ['$channel', 'sms'] }, 1, 0] } },
        whatsappCount: { $sum: { $cond: [{ $eq: ['$channel', 'whatsapp'] }, 1, 0] } },
        totalCost: { $sum: '$estimatedCost' }
      }
    }
  ]);
  
  return stats[0] || {
    totalNotifications: 0,
    sentCount: 0,
    failedCount: 0,
    emailCount: 0,
    smsCount: 0,
    whatsappCount: 0,
    totalCost: 0
  };
};

// Static method to get delivery rate
notificationLogSchema.statics.getDeliveryRate = async function(schoolId, channel, dateRange) {
  const matchQuery = { schoolId };
  
  if (channel) {
    matchQuery.channel = channel;
  }
  
  if (dateRange && dateRange.from) {
    matchQuery.createdAt = { $gte: new Date(dateRange.from) };
  }
  if (dateRange && dateRange.to) {
    matchQuery.createdAt = { ...matchQuery.createdAt, $lte: new Date(dateRange.to) };
  }
  
  const total = await this.countDocuments(matchQuery);
  const sent = await this.countDocuments({ ...matchQuery, status: { $in: ['sent', 'delivered'] } });
  
  return {
    total,
    sent,
    rate: total > 0 ? ((sent / total) * 100).toFixed(2) : 0
  };
};

module.exports = mongoose.model('NotificationLog', notificationLogSchema);

