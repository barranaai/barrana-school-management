const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  // Participants
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['parent', 'school_admin', 'super_admin'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    lastRead: {
      type: Date,
      default: Date.now
    },
    _id: false
  }],

  // School reference
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },

  // Conversation subject/title
  subject: {
    type: String,
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },

  // Last message info (for quick display)
  lastMessage: {
    content: {
      type: String,
      maxlength: 500
    },
    sentAt: {
      type: Date
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    senderName: String
  },

  // Unread message counts
  unreadCount: {
    parent: {
      type: Number,
      default: 0
    },
    admin: {
      type: Number,
      default: 0
    }
  },

  // Metadata
  metadata: {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    studentName: String,
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    initiatedByRole: String
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
conversationSchema.index({ 'participants.userId': 1, schoolId: 1 });
conversationSchema.index({ schoolId: 1, 'lastMessage.sentAt': -1 });
conversationSchema.index({ 'participants.userId': 1, isActive: 1, 'lastMessage.sentAt': -1 });

// Method to get unread count for a specific role
conversationSchema.methods.getUnreadCount = function(role) {
  if (role === 'parent') {
    return this.unreadCount.parent || 0;
  } else if (role === 'school_admin' || role === 'super_admin') {
    return this.unreadCount.admin || 0;
  }
  return 0;
};

// Method to increment unread count
conversationSchema.methods.incrementUnread = async function(recipientRole) {
  if (recipientRole === 'parent') {
    this.unreadCount.parent = (this.unreadCount.parent || 0) + 1;
  } else if (recipientRole === 'school_admin' || recipientRole === 'super_admin') {
    this.unreadCount.admin = (this.unreadCount.admin || 0) + 1;
  }
  await this.save();
};

// Method to reset unread count
conversationSchema.methods.resetUnread = async function(role) {
  if (role === 'parent') {
    this.unreadCount.parent = 0;
  } else if (role === 'school_admin' || role === 'super_admin') {
    this.unreadCount.admin = 0;
  }
  await this.save();
};

// Method to update last message
conversationSchema.methods.updateLastMessage = async function(message) {
  this.lastMessage = {
    content: message.content.length > 100 ? message.content.substring(0, 100) + '...' : message.content,
    sentAt: message.sentAt || new Date(),
    senderId: message.senderId,
    senderName: message.senderName
  };
  await this.save();
};

// Method to get participant by role
conversationSchema.methods.getParticipantByRole = function(role) {
  return this.participants.find(p => p.role === role);
};

// Method to get other participant (not the current user)
conversationSchema.methods.getOtherParticipant = function(userId) {
  return this.participants.find(p => p.userId.toString() !== userId.toString());
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;

