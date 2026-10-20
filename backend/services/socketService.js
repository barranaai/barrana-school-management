const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const School = require('../models/School');
const firebaseService = require('./firebaseService');
const { logger } = require('../utils/logger');
const { userCanUseConversation, conversationCanDeliver } = require('./guardianCommunicationService');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:5050',
          process.env.FRONTEND_URL,
          process.env.BASE_URL
        ].filter(Boolean),
        credentials: true,
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: Token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('firstName lastName email role schoolId isActive');
        
        if (!user || user.isActive === false) {
          return next(new Error('Authentication error: User not found'));
        }

        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication failed', { category: error?.name || 'Error' });
        next(new Error('Authentication error'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('✅ Socket.io initialized');
    return this.io;
  }

  handleConnection(socket) {
    const user = socket.user;
    logger.info('Socket user connected');

    // Store user connection
    this.connectedUsers.set(user._id.toString(), socket.id);

    // Emit user online status to relevant conversations
    this.broadcastUserStatus(user._id, 'online');

    // Join user's personal room
    socket.join(`user:${user._id}`);

    // Join all conversation rooms
    this.joinUserConversations(socket, user._id);

    // Handle events
    socket.on('join_conversation', (conversationId) => this.handleJoinConversation(socket, conversationId));
    socket.on('leave_conversation', (conversationId) => this.handleLeaveConversation(socket, conversationId));
    socket.on('send_message', (data) => this.handleSendMessage(socket, data));
    socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
    socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
    socket.on('mark_read', (data) => this.handleMarkRead(socket, data));

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('Socket user disconnected');
      this.connectedUsers.delete(user._id.toString());
      this.broadcastUserStatus(user._id, 'offline');
    });
  }

  async joinUserConversations(socket, userId) {
    try {
      const conversations = await Conversation.find({
        'participants.userId': userId,
        isActive: true
      });

      let joined = 0;
      for (const conv of conversations) {
        if (await userCanUseConversation(socket.user, conv)) {
          socket.join(`conversation:${conv._id}`);
          joined += 1;
        }
      }

      logger.info('Socket conversation rooms joined', { count: joined });
    } catch (error) {
      logger.error('Unable to join socket conversation rooms', { category: error?.name || 'Error' });
    }
  }

  async handleJoinConversation(socket, conversationId) {
    const conversation = await Conversation.findById(conversationId);
    const isParticipant = conversation?.participants?.some(item => item.userId.toString() === socket.user._id.toString());
    if (!conversation || !isParticipant || !(await userCanUseConversation(socket.user, conversation))) {
      socket.emit('message_error', { error: 'Conversation not found' });
      return;
    }
    socket.join(`conversation:${conversationId}`);
  }

  handleLeaveConversation(socket, conversationId) {
    socket.leave(`conversation:${conversationId}`);
    logger.info('Socket conversation room left');
  }

  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content, tempId, attachments } = data;
      const user = socket.user;

      const activeOrganization = user.schoolId
        ? await School.findOne({ _id: user.schoolId, isActive: { $ne: false } }).select('_id')
        : null;
      if (!activeOrganization) {
        socket.emit('message_error', { tempId, error: 'Organization is unavailable' });
        return;
      }

      // Verify conversation and participation
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        socket.emit('message_error', {
          tempId,
          error: 'Conversation not found'
        });
        return;
      }

      const isParticipant = conversation.participants.some(
        p => p.userId.toString() === user._id.toString()
      );

      if (!isParticipant || !(await userCanUseConversation(user, conversation)) || !(await conversationCanDeliver(conversation))) {
        socket.emit('message_error', {
          tempId,
          error: 'Not authorized to send messages in this conversation'
        });
        return;
      }

      // Get recipient
      const recipient = conversation.participants.find(
        p => p.userId.toString() !== user._id.toString()
      );

      // Create message with attachments
      const messageAttachments = attachments || [];
      const message = await Message.create({
        conversationId: conversation._id,
        senderId: user._id,
        senderRole: user.role,
        senderName: `${user.firstName} ${user.lastName}`,
        recipientId: recipient.userId,
        recipientRole: recipient.role,
        recipientName: recipient.name,
        content,
        type: 'text',
        schoolId: user.schoolId,
        metadata: {
          ...conversation.metadata,
          attachments: messageAttachments
        }
      });

      // Update conversation
      await conversation.updateLastMessage(message);
      await conversation.incrementUnread(recipient.role);

      // Send to conversation room
      this.io.to(`conversation:${conversationId}`).emit('new_message', {
        ...message.toObject(),
        tempId
      });

      // Create in-app notification for recipient
      try {
        const recipientUser = await User.findById(recipient.userId);
        if (recipientUser) {
          recipientUser.notifications.push({
            id: `message_${message._id}_${Date.now()}`,
            type: 'message',
            title: 'New Message',
            message: `${user.firstName} ${user.lastName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
            data: {
              messageId: message._id.toString(),
              conversationId: conversationId,
              senderId: user._id.toString(),
              senderName: `${user.firstName} ${user.lastName}`
            },
            isRead: false,
            createdAt: new Date()
          });
          await recipientUser.save();
        }

        // Always send push notification for new messages
        await this.sendMessagePushNotification(recipientUser, user, content, conversationId);
      } catch (notifError) {
        logger.error('Unable to create message notification', { category: notifError?.name || 'Error' });
      }

      logger.info('Conversation message accepted');
    } catch (error) {
      logger.error('Unable to handle conversation message', { category: error?.name || 'Error' });
      socket.emit('message_error', {
        tempId: data.tempId,
        error: error.message
      });
    }
  }

  handleTypingStart(socket, { conversationId }) {
    socket.to(`conversation:${conversationId}`).emit('typing_start', {
      conversationId,
      userId: socket.user._id,
      userName: `${socket.user.firstName} ${socket.user.lastName}`
    });
  }

  handleTypingStop(socket, { conversationId }) {
    socket.to(`conversation:${conversationId}`).emit('typing_stop', {
      conversationId,
      userId: socket.user._id
    });
  }

  async handleMarkRead(socket, { conversationId }) {
    try {
      const user = socket.user;

      const conversation = await Conversation.findById(conversationId);
      const isParticipant = conversation?.participants?.some(item => item.userId.toString() === user._id.toString());
      if (!conversation || !isParticipant || !(await userCanUseConversation(user, conversation))) return;

      // Mark messages as read
      await Message.updateMany(
        {
          conversationId,
          recipientId: user._id,
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );

      // Update conversation
      if (conversation) {
        await conversation.resetUnread(user.role);
        
        // Update last read timestamp
        const participantIndex = conversation.participants.findIndex(
          p => p.userId.toString() === user._id.toString()
        );
        
        if (participantIndex !== -1) {
          conversation.participants[participantIndex].lastRead = new Date();
          await conversation.save();
        }
      }

      // Remove message notifications for this conversation from user's notification array
      await User.findByIdAndUpdate(user._id, {
        $pull: {
          notifications: {
            type: 'message',
            'data.conversationId': conversationId
          }
        }
      });
      
      logger.info('Conversation message notifications removed');

      // Notify other participants
      socket.to(`conversation:${conversationId}`).emit('messages_read', {
        conversationId,
        userId: user._id,
        readAt: new Date()
      });

      logger.info('Conversation messages marked as read');
    } catch (error) {
      logger.error('Unable to mark conversation messages as read', { category: error?.name || 'Error' });
    }
  }

  async sendMessagePushNotification(recipient, sender, content, conversationId) {
    try {
      if (recipient && recipient.fcmTokens && recipient.fcmTokens.length > 0) {
        // Strip HTML tags from content for clean notification
        const stripHtml = (html) => {
          return html.replace(/<[^>]*>/g, '').trim();
        };
        
        const cleanContent = stripHtml(content);
        const notificationBody = cleanContent.length > 100 ? cleanContent.substring(0, 100) + '...' : cleanContent;
        
        await firebaseService.sendNotificationToUser(
          recipient,
          {
            title: `💬 New Message from ${sender.firstName} ${sender.lastName}`,
            body: notificationBody,
            type: 'new_message',
            priority: 'high',
            clickAction: '/communication'
          },
          {
            conversationId: conversationId,
            senderId: sender._id.toString(),
            senderName: `${sender.firstName} ${sender.lastName}`,
            action: 'open_conversation'
          }
        );

        logger.info('Message push notification accepted', { channel: 'push' });
      }
    } catch (error) {
      logger.error('Unable to send message push notification', { category: error?.name || 'Error' });
    }
  }

  broadcastUserStatus(userId, status) {
    this.io.to(`user:${userId}`).emit('user_status', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId.toString());
  }

  isUserInConversation(userId, conversationId) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (!socketId) return false;
    
    const socket = this.io.sockets.sockets.get(socketId);
    return socket && socket.rooms.has(`conversation:${conversationId}`);
  }

  // Utility method to send notification to specific user
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  // Utility method to send to all users in a conversation
  sendToConversation(conversationId, event, data) {
    this.io.to(`conversation:${conversationId}`).emit(event, data);
  }

  getIO() {
    return this.io;
  }

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }
}

// Export singleton instance
const socketService = new SocketService();
module.exports = socketService;

