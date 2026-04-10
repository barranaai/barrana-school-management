const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const firebaseService = require('../services/firebaseService');

// Configure Multer for message attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/message-attachments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `message-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow all file types
  cb(null, true);
};

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files per upload
  },
  fileFilter: fileFilter
});

// @desc    Upload message attachments
// @route   POST /api/messages/upload-attachments
// @access  Private (parent, school_admin, super_admin)
router.post('/upload-attachments', protect, authorize('parent', 'school_admin', 'super_admin'), upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/message-attachments/${file.filename}`
    }));

    logger.info(`Uploaded ${uploadedFiles.length} attachment(s) for user ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    logger.error('Error uploading message attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading files',
      error: error.message
    });
  }
});

// @desc    Get all conversations for current user
// @route   GET /api/messages/conversations
// @access  Private (parent, school_admin, super_admin)
router.get('/conversations', protect, authorize('parent', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const conversations = await Conversation.find({
      'participants.userId': req.user._id,
      isActive: true
    })
      .populate('participants.userId', 'firstName lastName email role')
      .sort({ 'lastMessage.sentAt': -1 })
      .lean();

    // Format conversations for response
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(
        p => p.userId._id.toString() !== req.user._id.toString()
      );

      return {
        ...conv,
        otherParticipant: otherParticipant ? {
          id: otherParticipant.userId._id,
          name: otherParticipant.name || `${otherParticipant.userId.firstName} ${otherParticipant.userId.lastName}`,
          role: otherParticipant.role,
          email: otherParticipant.userId.email
        } : null,
        unreadCount: req.user.role === 'parent' ? conv.unreadCount.parent : conv.unreadCount.admin
      };
    });

    res.json({
      success: true,
      data: formattedConversations
    });
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
});

// @desc    Get messages in a conversation
// @route   GET /api/messages/conversation/:conversationId
// @access  Private (participants only)
router.get('/conversation/:conversationId', protect, authorize('parent', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify user is part of conversation
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this conversation'
      });
    }

    // Build query
    const query = { conversationId };
    if (before) {
      query.sentAt = { $lt: new Date(before) };
    }

    // Fetch messages
    const messages = await Message.find(query)
      .sort({ sentAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Reverse to show oldest first
    messages.reverse();

    res.json({
      success: true,
      data: messages,
      hasMore: messages.length === parseInt(limit)
    });
  } catch (error) {
    logger.error('Error fetching conversation messages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
});

// @desc    Create a new conversation
// @route   POST /api/messages/conversation
// @access  Private (parent, school_admin, super_admin)
router.post('/conversation', protect, authorize('parent', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { recipientId, subject, initialMessage, studentId, forceNewThread } = req.body;

    if (!recipientId || !initialMessage) {
      return res.status(400).json({
        success: false,
        message: 'Recipient ID and initial message are required'
      });
    }

    // Get recipient details
    const recipient = await User.findById(recipientId).select('firstName lastName email role');
    
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Verify recipient is admin if sender is parent, or vice versa
    const senderIsParent = req.user.role === 'parent';
    const recipientIsAdmin = ['school_admin', 'super_admin'].includes(recipient.role);
    const recipientIsParent = recipient.role === 'parent';
    const senderIsAdmin = ['school_admin', 'super_admin'].includes(req.user.role);

    if ((senderIsParent && !recipientIsAdmin) || (senderIsAdmin && !recipientIsParent)) {
      return res.status(400).json({
        success: false,
        message: 'Conversations can only be between parents and admins'
      });
    }

    let conversation = null;

    // Check if conversation already exists (only if not forcing new thread)
    if (!forceNewThread) {
      conversation = await Conversation.findOne({
        schoolId: req.user.schoolId,
        'participants.userId': { $all: [req.user._id, recipientId] },
        isActive: true
      });
    }

    // Create new conversation if doesn't exist or if forcing new thread
    if (!conversation) {
      let studentData = null;
      if (studentId) {
        const student = await User.findById(studentId).select('firstName lastName');
        if (student) {
          studentData = {
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`
          };
        }
      }

      conversation = await Conversation.create({
        participants: [
          {
            userId: req.user._id,
            role: req.user.role,
            name: `${req.user.firstName} ${req.user.lastName}`,
            lastRead: new Date()
          },
          {
            userId: recipient._id,
            role: recipient.role,
            name: `${recipient.firstName} ${recipient.lastName}`,
            lastRead: null
          }
        ],
        schoolId: req.user.schoolId,
        subject: subject || `Conversation about ${studentData?.studentName || 'general topic'}`,
        metadata: {
          ...studentData,
          initiatedBy: req.user._id,
          initiatedByRole: req.user.role
        }
      });

      logger.info(`New conversation created: ${conversation._id}`);
    }

    // Create initial message with attachments
    const attachments = req.body.attachments || [];
    const schedulingData = req.body.schedulingData || {};
    const isScheduled = schedulingData.scheduledDateTime && new Date(schedulingData.scheduledDateTime) > new Date();
    
    // Prepare metadata with attachments
    const messageMetadata = {
      ...conversation.metadata
    };
    
    // Add attachments to metadata if present
    if (attachments && attachments.length > 0) {
      messageMetadata.attachments = attachments;
    }
    
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: req.user.role,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      recipientId: recipient._id,
      recipientRole: recipient.role,
      recipientName: `${recipient.firstName} ${recipient.lastName}`,
      content: initialMessage,
      type: 'text',
      schoolId: req.user.schoolId,
      isScheduled: isScheduled,
      scheduledDateTime: isScheduled ? new Date(schedulingData.scheduledDateTime) : undefined,
      scheduledDate: isScheduled ? schedulingData.scheduledDate : undefined,
      scheduledTime: isScheduled ? schedulingData.scheduledTime : undefined,
      timezone: isScheduled ? (schedulingData.timezone || 'UTC') : undefined,
      sentAt: isScheduled ? null : new Date(), // Set to null for scheduled messages to prevent default
      metadata: messageMetadata
    });

    // Only update conversation and create notifications if NOT scheduled
    if (!isScheduled) {
      // Update conversation
      await conversation.updateLastMessage(message);
      await conversation.incrementUnread(recipient.role);

      // Create notification for recipient
    try {
      const recipientUser = await User.findById(recipient._id);
      if (recipientUser) {
        const notification = {
          id: `message_${message._id}_${Date.now()}`,
          type: 'message',
          title: 'New Message',
          message: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
          data: {
            messageId: message._id.toString(),
            conversationId: conversation._id.toString(),
            senderId: req.user._id.toString(),
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            senderRole: req.user.role
          },
          isRead: false,
          createdAt: new Date()
        };

        recipientUser.notifications.push(notification);
        await recipientUser.save();

        logger.info(`Created in-app notification for recipient ${recipient._id}`);

        // Send push notification
        try {
          const pushNotification = {
            title: 'New Message',
            body: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
            icon: 'ic_notification',
            sound: 'default'
          };

          const pushData = {
            type: 'message',
            conversationId: conversation._id,
            senderId: req.user._id,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            senderRole: req.user.role
          };

          await firebaseService.sendNotificationToUser(recipientUser, pushNotification, pushData);
          logger.info(`Push notification sent to recipient ${recipient._id}`);
        } catch (pushError) {
          logger.error('Error sending push notification:', pushError);
          // Don't fail the entire request if push notification fails
        }
      }
    } catch (notifError) {
      logger.error('Error creating notification:', notifError);
      // Don't fail the entire request if notification creation fails
    }

      logger.info(`Message sent in conversation ${conversation._id}`);
    } else {
      logger.info(`Message scheduled for ${message.scheduledDateTime} in conversation ${conversation._id}`);
    }

    res.status(201).json({
      success: true,
      data: {
        conversation,
        message,
        isScheduled: isScheduled
      }
    });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating conversation',
      error: error.message
    });
  }
});

// @desc    Send a message (REST fallback)
// @route   POST /api/messages/send
// @access  Private (participants only)
router.post('/send', protect, authorize('parent', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID and content are required'
      });
    }

    // Verify conversation and participation
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this conversation'
      });
    }

    // Get recipient
    const recipient = conversation.participants.find(
      p => p.userId.toString() !== req.user._id.toString()
    );

    // Create message with attachments
    const attachments = req.body.attachments || [];
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: req.user.role,
      senderName: `${req.user.firstName} ${req.user.lastName}`,
      recipientId: recipient.userId,
      recipientRole: recipient.role,
      recipientName: recipient.name,
      content,
      type: 'text',
      schoolId: req.user.schoolId,
      metadata: {
        ...conversation.metadata,
        attachments: attachments
      }
    });

    // Update conversation
    await conversation.updateLastMessage(message);
    await conversation.incrementUnread(recipient.role);

    // Create notification for recipient
    try {
      const recipientUser = await User.findById(recipient.userId);
      if (recipientUser) {
        const notification = {
          type: 'message',
          title: 'New Message',
          message: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
          data: {
            conversationId: conversation._id,
            senderId: req.user._id,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            senderRole: req.user.role
          },
          isRead: false,
          createdAt: new Date()
        };

        recipientUser.notifications.push(notification);
        await recipientUser.save();

        logger.info(`Created notification for recipient ${recipient.userId}`);

        // Send push notification
        try {
          const pushNotification = {
            title: 'New Message',
            body: `You have a new message from ${req.user.firstName} ${req.user.lastName}`,
            icon: 'ic_notification',
            sound: 'default'
          };

          const pushData = {
            type: 'message',
            conversationId: conversation._id,
            senderId: req.user._id,
            senderName: `${req.user.firstName} ${req.user.lastName}`,
            senderRole: req.user.role
          };

          await firebaseService.sendNotificationToUser(recipientUser, pushNotification, pushData);
          logger.info(`Push notification sent to recipient ${recipient.userId}`);
        } catch (pushError) {
          logger.error('Error sending push notification:', pushError);
          // Don't fail the entire request if push notification fails
        }
      }
    } catch (notifError) {
      logger.error('Error creating notification:', notifError);
      // Don't fail the entire request if notification creation fails
    }

    logger.info(`Message sent in conversation ${conversation._id}`);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    logger.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
});

// @desc    Mark messages as read
// @route   PATCH /api/messages/conversation/:conversationId/read
// @access  Private (participants only)
router.patch('/conversation/:conversationId/read', protect, authorize('parent', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify conversation and participation
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const isParticipant = conversation.participants.some(
      p => p.userId.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this conversation'
      });
    }

    // Mark all unread messages as read
    await Message.updateMany(
      {
        conversationId,
        recipientId: req.user._id,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    // Reset unread count
    await conversation.resetUnread(req.user.role);

    // Update last read timestamp
    const participantIndex = conversation.participants.findIndex(
      p => p.userId.toString() === req.user._id.toString()
    );
    
    if (participantIndex !== -1) {
      conversation.participants[participantIndex].lastRead = new Date();
      await conversation.save();
    }

    logger.info(`Messages marked as read in conversation ${conversationId}`);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
});

// @desc    Get unread message count
// @route   GET /api/messages/unread-count
// @access  Private (parent, school_admin, super_admin)
router.get('/unread-count', protect, authorize('parent', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const conversations = await Conversation.find({
      'participants.userId': req.user._id,
      isActive: true
    });

    let totalUnread = 0;
    conversations.forEach(conv => {
      if (req.user.role === 'parent') {
        totalUnread += conv.unreadCount.parent || 0;
      } else {
        totalUnread += conv.unreadCount.admin || 0;
      }
    });

    res.json({
      success: true,
      data: {
        unreadCount: totalUnread,
        conversationsWithUnread: conversations.filter(conv => {
          const count = req.user.role === 'parent' ? conv.unreadCount.parent : conv.unreadCount.admin;
          return count > 0;
        }).length
      }
    });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
});

module.exports = router;

