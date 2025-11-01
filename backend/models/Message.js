const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Conversation reference
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },

  // Sender information
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  senderRole: {
    type: String,
    enum: ['parent', 'school_admin', 'super_admin'],
    required: true
  },

  senderName: {
    type: String,
    required: true
  },

  // Recipient information
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  recipientRole: {
    type: String,
    enum: ['parent', 'school_admin', 'super_admin'],
    required: true
  },

  recipientName: {
    type: String,
    required: true
  },

  // Message content
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },

  type: {
    type: String,
    enum: ['text', 'system'],
    default: 'text'
  },

  // Read status
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: {
    type: Date
  },

  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Scheduling fields
  isScheduled: {
    type: Boolean,
    default: false
  },

  scheduledDateTime: {
    type: Date,
    index: true
  },

  scheduledDate: {
    type: String
  },

  scheduledTime: {
    type: String
  },

  timezone: {
    type: String,
    default: 'UTC'
  },

  // Metadata
  metadata: {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    studentName: String,
    attachments: [{
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String
    }]
  },

  // School reference
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
messageSchema.index({ conversationId: 1, sentAt: -1 });
messageSchema.index({ senderId: 1, recipientId: 1, sentAt: -1 });
messageSchema.index({ conversationId: 1, isRead: 1 });
messageSchema.index({ schoolId: 1, sentAt: -1 });
messageSchema.index({ isScheduled: 1, scheduledDateTime: 1, sentAt: 1 });

// Virtual for time ago
messageSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.sentAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return this.sentAt.toLocaleDateString();
});

// Method to mark as read
messageSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
};

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;

