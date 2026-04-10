import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  IconButton,
  Badge,
  CircularProgress,
  Paper,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Popover
} from '@mui/material';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import {
  Send,
  Search,
  MoreVert,
  AttachFile,
  EmojiEmotions,
  Add,
  Message as MessageIcon,
  CheckCircle,
  Circle,
  Description,
  Image as ImageIcon,
  VideoLibrary,
  InsertDriveFile,
  Download
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import messagingService from '../../services/messagingService';
import notificationService from '../../services/notificationService';

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  sentAt: string;
  tempId?: string;
  metadata?: {
    attachments?: Array<{
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
    }>;
  };
}

interface Conversation {
  _id: string;
  subject: string;
  lastMessage?: {
    content: string;
    sentAt: string;
    senderName: string;
  };
  unreadCount: number;
  otherParticipant?: {
    id: string;
    name: string;
    role: string;
  };
}

const CommunicationPage: React.FC = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [newConversationDialog, setNewConversationDialog] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState<HTMLElement | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Utility function to strip HTML tags for preview
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Show browser notification
  const showBrowserNotification = (payload: any) => {
    try {
      const title = payload.notification?.title || '💬 New Message';
      const body = payload.notification?.body || 'You have a new message';
      const conversationId = payload.data?.conversationId;

      // Check if browser supports notifications
      if (!('Notification' in window)) {
        console.warn('Browser does not support notifications');
        return;
      }

      // Only show if user has granted permission
      if (Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body: body,
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: `message-${conversationId}`,
          requireInteraction: false,
          silent: false
        });

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
          
          // If conversation ID exists, try to open that conversation
          if (conversationId && conversations.length > 0) {
            const conv = conversations.find(c => c._id === conversationId);
            if (conv) {
              handleSelectConversation(conv);
            }
          }
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
      }
    } catch (error) {
      console.error('Error showing browser notification:', error);
    }
  };

  // Initialize Socket.io and fetch initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setConnectionError(null);
        
        console.log('🔄 Connecting to messaging service...');
        
        // Connect to Socket.io
        await messagingService.connect();
        console.log('✅ Messaging service connected');

        // Initialize Firebase push notifications
        try {
          await notificationService.initializePushNotifications((payload) => {
            console.log('🔔 Push notification received in foreground:', payload);
            showBrowserNotification(payload);
          });
          console.log('✅ Push notifications initialized for messaging');
        } catch (notifError) {
          console.warn('Push notifications not available:', notifError);
        }

        // Fetch conversations
        await loadConversations();

        // Set up Socket.io listeners
        setupSocketListeners();
        
      } catch (error: any) {
        console.error('❌ Error initializing messaging:', error);
        setConnectionError(error?.message || 'Failed to connect to messaging service');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      initialize();
    }

    // Cleanup on unmount
    return () => {
      if (selectedConversation) {
        messagingService.leaveConversation(selectedConversation._id);
      }
      messagingService.removeAllListeners();
      messagingService.disconnect();
      notificationService.cleanup();
    };
  }, [user]);

  // Load conversations
  const loadConversations = async () => {
    try {
      const response = await messagingService.getConversations();
      if (response.success) {
        setConversations(response.data);
        console.log('📋 Loaded conversations:', response.data.length);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (conversationId: string) => {
    try {
      const response = await messagingService.getConversationMessages(conversationId);
      if (response.success) {
        setMessages(response.data);
        console.log('💬 Loaded messages:', response.data.length);
        
        // Scroll to bottom
        setTimeout(() => scrollToBottom(), 100);
        
        // Mark as read
        await messagingService.markConversationAsRead(conversationId);
        messagingService.markAsRead(conversationId);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  // Setup Socket.io listeners
  const setupSocketListeners = () => {
    // New message received
    messagingService.onNewMessage(async (message: Message) => {
      console.log('📨 New message received:', message);
      
      // Show browser notification if message is from someone else
      if (message.senderId !== user?._id) {
        const cleanContent = stripHtml(message.content);
        const notificationBody = cleanContent.length > 100 ? cleanContent.substring(0, 100) + '...' : cleanContent;
        
        showBrowserNotification({
          notification: {
            title: `💬 New Message from ${message.senderName}`,
            body: notificationBody
          },
          data: {
            conversationId: message.conversationId,
            senderId: message.senderId,
            senderName: message.senderName
          }
        });
      }
      
      // Add to messages if current conversation
      if (selectedConversation && message.conversationId === selectedConversation._id) {
        setMessages(prev => [...prev, message]);
        setTimeout(() => scrollToBottom(), 100);
        
        // Mark as read if not sender
        if (message.senderId !== user?._id) {
          messagingService.markAsRead(message.conversationId);
        }
      }
      
      // Reload conversations to get updated list
      const conversationsResult = await messagingService.getConversations();
      if (conversationsResult.success) {
        const updatedConversations = conversationsResult.data;
        setConversations(updatedConversations);
        
        // Check if this is a new conversation (not in current list and message is not from current user)
        const existingConv = conversations.find(conv => conv._id === message.conversationId);
        const isNewConversation = !existingConv && message.senderId !== user?._id;
        
        if (isNewConversation) {
          // Find the new conversation in updated list
          const newConversation = updatedConversations.find(conv => conv._id === message.conversationId);
          
          if (newConversation) {
            console.log('📬 New conversation thread detected, auto-opening:', newConversation);
            
            // Auto-open the new conversation
            setSelectedConversation(newConversation);
            messagingService.joinConversation(newConversation._id);
            
            // Load messages for the new conversation
            const messagesResult = await messagingService.getConversationMessages(newConversation._id);
            if (messagesResult.success) {
              setMessages(messagesResult.data);
              setTimeout(() => scrollToBottom(), 100);
              
              // Mark as read
              messagingService.markAsRead(newConversation._id);
            }
          }
        }
      }
    });

    // Typing indicators
    messagingService.onTypingStart((data) => {
      if (selectedConversation && data.conversationId === selectedConversation._id) {
        setTyping(data.userName);
      }
    });

    messagingService.onTypingStop((data) => {
      if (selectedConversation && data.conversationId === selectedConversation._id) {
        setTyping(null);
      }
    });

    // Message read
    messagingService.onMessageRead((data) => {
      console.log('✅ Messages marked as read:', data);
      // Update message read status in UI
      if (selectedConversation && data.conversationId === selectedConversation._id) {
        setMessages(prev => prev.map(msg => 
          msg.senderId === user?._id ? { ...msg, isRead: true } : msg
        ));
      }
    });

    // Error handling
    messagingService.onMessageError((error) => {
      console.error('❌ Message error:', error);
      alert('Failed to send message. Please try again.');
      setSending(false);
    });
  };

  // Handle conversation selection
  const handleSelectConversation = async (conversation: Conversation) => {
    // Leave previous conversation room
    if (selectedConversation) {
      messagingService.leaveConversation(selectedConversation._id);
    }

    setSelectedConversation(conversation);
    setMessages([]);
    
    // Join new conversation room
    messagingService.joinConversation(conversation._id);
    
    // Load messages
    await loadMessages(conversation._id);
  };

  // Emoji picker handler
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    setMessageInput(prev => prev + emoji);
    setEmojiPickerAnchor(null);
  };

  // Attachment handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setAttachments(prev => [...prev, ...fileArray]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle send message
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && attachments.length === 0) || !selectedConversation || sending) return;

    const tempId = `temp_${Date.now()}`;
    const content = messageInput.trim();
    setSending(true);

    try {
      // Upload attachments first
      let uploadedAttachments: any[] = [];
      if (attachments.length > 0) {
        uploadedAttachments = await messagingService.uploadAttachments(attachments);
      }

      // Optimistic UI update
      const tempMessage: Message = {
        _id: tempId,
        conversationId: selectedConversation._id,
        senderId: user?._id || '',
        senderName: `${user?.firstName} ${user?.lastName}`,
        content,
        isRead: false,
        sentAt: new Date().toISOString(),
        tempId,
        metadata: uploadedAttachments.length > 0 ? {
          attachments: uploadedAttachments
        } : undefined
      };

      setMessages(prev => [...prev, tempMessage]);
      setMessageInput('');
      setAttachments([]);

      // Send via Socket.io with attachments
      messagingService.sendMessage(selectedConversation._id, content, tempId, uploadedAttachments);
      
      // Stop typing indicator
      messagingService.stopTyping(selectedConversation._id);
      
      setTimeout(() => {
        scrollToBottom();
        setSending(false);
      }, 500);
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message');
      setSending(false);
    }
  };

  // Handle typing
  const handleTyping = (value: string) => {
    setMessageInput(value);

    if (!selectedConversation) return;

    // Send typing start
    messagingService.startTyping(selectedConversation._id);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      messagingService.stopTyping(selectedConversation._id);
    }, 2000);
  };

  // Handle new conversation
  const handleNewConversation = async () => {
    if (!selectedRecipient || !newMessageContent.trim()) {
      alert('Please select a recipient and enter a message');
      return;
    }

    try {
      setSending(true);
      const response = await messagingService.createConversation(
        selectedRecipient,
        newMessageContent.trim(),
        'New Conversation'
      );

      if (response.success) {
        setNewConversationDialog(false);
        setSelectedRecipient('');
        setNewMessageContent('');
        
        // Reload conversations
        await loadConversations();
        
        // Select the new conversation
        const newConv = conversations.find(c => c._id === response.data.conversation._id);
        if (newConv) {
          handleSelectConversation(newConv);
        }
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Failed to create conversation');
    } finally {
      setSending(false);
    }
  };

  // Load recipients for new conversation
  useEffect(() => {
    const loadRecipients = async () => {
      try {
        // Fetch admins if parent, or parents if admin
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/api/users?role=${user?.role === 'parent' ? 'school_admin' : 'parent'}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const data = await response.json();
        if (data.success) {
          setRecipients(data.data || []);
        }
      } catch (error) {
        console.error('Error loading recipients:', error);
      }
    };

    if (newConversationDialog) {
      loadRecipients();
    }
  }, [newConversationDialog, user?.role]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.otherParticipant?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.subject?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Connecting to messaging service...
        </Typography>
      </Box>
    );
  }

  if (connectionError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2, p: 3 }}>
        <MessageIcon sx={{ fontSize: 64, color: 'error.main', opacity: 0.5 }} />
        <Typography variant="h6" color="error">
          Connection Error
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {connectionError}
        </Typography>
        <Button 
          variant="contained" 
          onClick={() => window.location.reload()}
          sx={{ mt: 2 }}
        >
          Retry Connection
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column' }}>
      <Grid container spacing={0} sx={{ flexGrow: 1, height: '100%' }}>
        {/* Conversation List */}
        <Grid item xs={12} md={4} sx={{ height: '100%', borderRight: '1px solid', borderColor: 'divider' }}>
          <Card sx={{ height: '100%', borderRadius: 0, boxShadow: 'none' }}>
            <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Messages
                </Typography>
                <IconButton 
                  color="primary" 
                  onClick={() => setNewConversationDialog(true)}
                  size="small"
                >
                  <Add />
                </IconButton>
              </Box>

              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ mb: 2 }}
              />

              {/* Conversation List */}
              <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
                {filteredConversations.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    <MessageIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography variant="body2">
                      No conversations yet
                    </Typography>
                    <Button 
                      variant="contained" 
                      size="small" 
                      onClick={() => setNewConversationDialog(true)}
                      sx={{ mt: 2 }}
                    >
                      Start New Conversation
                    </Button>
                  </Box>
                ) : (
                  filteredConversations.map((conv) => (
                    <React.Fragment key={conv._id}>
                      <ListItem
                        button
                        selected={selectedConversation?._id === conv._id}
                        onClick={() => handleSelectConversation(conv)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&.Mui-selected': {
                            bgcolor: 'primary.light',
                            '&:hover': {
                              bgcolor: 'primary.light',
                            }
                          }
                        }}
                      >
                        <ListItemAvatar>
                          <Badge
                            badgeContent={conv.unreadCount}
                            color="error"
                            overlap="circular"
                          >
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                              {conv.otherParticipant?.name.charAt(0).toUpperCase()}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography 
                                variant="subtitle2" 
                                sx={{ 
                                  fontWeight: conv.unreadCount > 0 ? 700 : 400,
                                  textTransform: 'capitalize'
                                }}
                              >
                                {conv.otherParticipant?.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {conv.lastMessage && formatTime(conv.lastMessage.sentAt)}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                fontWeight: conv.unreadCount > 0 ? 600 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {conv.lastMessage?.content ? stripHtml(conv.lastMessage.content) : 'No messages yet'}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Message Thread */}
        <Grid item xs={12} md={8} sx={{ height: '100%' }}>
          {selectedConversation ? (
            <Card sx={{ height: '100%', borderRadius: 0, boxShadow: 'none', display: 'flex', flexDirection: 'column' }}>
              {/* Chat Header */}
              <Box sx={{ 
                p: 2, 
                borderBottom: '1px solid', 
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {selectedConversation.otherParticipant?.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {selectedConversation.otherParticipant?.name}
                    </Typography>
                    <Chip 
                      label={selectedConversation.otherParticipant?.role?.replace('_', ' ')}
                      size="small"
                      sx={{ textTransform: 'capitalize', height: 20 }}
                    />
                  </Box>
                </Box>
                <IconButton size="small">
                  <MoreVert />
                </IconButton>
              </Box>

              {/* Messages Area */}
              <Box sx={{ 
                flexGrow: 1, 
                overflow: 'auto', 
                p: 2,
                bgcolor: 'grey.50'
              }}>
                {messages.map((message, index) => {
                  const isOwn = message.senderId === user?._id;
                  const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

                  return (
                    <Box
                      key={message._id}
                      sx={{
                        display: 'flex',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        mb: 1,
                        alignItems: 'flex-end'
                      }}
                    >
                      {!isOwn && showAvatar && (
                        <Avatar 
                          sx={{ 
                            width: 32, 
                            height: 32, 
                            mr: 1,
                            bgcolor: 'primary.main',
                            fontSize: '0.875rem'
                          }}
                        >
                          {message.senderName.charAt(0).toUpperCase()}
                        </Avatar>
                      )}
                      {!isOwn && !showAvatar && <Box sx={{ width: 32, mr: 1 }} />}
                      
                      <Paper
                        elevation={1}
                        sx={{
                          p: 1.5,
                          maxWidth: '70%',
                          bgcolor: isOwn ? 'primary.main' : 'white',
                          color: isOwn ? 'white' : 'text.primary',
                          borderRadius: 2,
                          borderBottomRightRadius: isOwn ? 0 : 2,
                          borderBottomLeftRadius: isOwn ? 2 : 0
                        }}
                      >
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            wordBreak: 'break-word',
                            '& p': { margin: 0 },
                            '& ul, & ol': { marginTop: 0, marginBottom: 0, paddingLeft: '20px' },
                            '& strong': { fontWeight: 600 },
                            '& em': { fontStyle: 'italic' }
                          }}
                          dangerouslySetInnerHTML={{ __html: message.content }}
                        />
                        
                        {/* Attachments Display */}
                        {message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {message.metadata.attachments.map((attachment, idx) => {
                              const isImage = attachment.mimeType?.startsWith('image/');
                              const isVideo = attachment.mimeType?.startsWith('video/');
                              const isPDF = attachment.mimeType === 'application/pdf';
                              const attachmentUrl = `${process.env.REACT_APP_API_URL?.replace('/api', '')}${attachment.url}`;

                              // Show preview for images and videos
                              if (isImage) {
                                return (
                                  <Box key={idx}>
                                    <Box
                                      component="img"
                                      src={attachmentUrl}
                                      alt={attachment.originalName}
                                      sx={{
                                        maxWidth: '100%',
                                        maxHeight: 300,
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        display: 'block',
                                        '&:hover': {
                                          opacity: 0.9
                                        }
                                      }}
                                      onClick={() => window.open(attachmentUrl, '_blank')}
                                    />
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        color: isOwn ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                        fontSize: '0.7rem',
                                        mt: 0.5
                                      }}
                                    >
                                      {attachment.originalName} • {(attachment.size / 1024).toFixed(1)} KB
                                    </Typography>
                                  </Box>
                                );
                              }

                              if (isVideo) {
                                return (
                                  <Box key={idx}>
                                    <Box
                                      component="video"
                                      controls
                                      src={attachmentUrl}
                                      sx={{
                                        maxWidth: '100%',
                                        maxHeight: 300,
                                        borderRadius: 2,
                                        display: 'block',
                                      }}
                                    />
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        color: isOwn ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                        fontSize: '0.7rem',
                                        mt: 0.5
                                      }}
                                    >
                                      {attachment.originalName} • {(attachment.size / 1024).toFixed(1)} KB
                                    </Typography>
                                  </Box>
                                );
                              }

                              // For other files (PDFs, documents), show as card
                              return (
                                <Box
                                  key={idx}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    p: 1,
                                    bgcolor: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.08)',
                                    }
                                  }}
                                  onClick={() => window.open(attachmentUrl, '_blank')}
                                >
                                  {isPDF ? (
                                    <Description sx={{ fontSize: 20, color: isOwn ? 'white' : 'primary.main' }} />
                                  ) : (
                                    <InsertDriveFile sx={{ fontSize: 20, color: isOwn ? 'white' : 'primary.main' }} />
                                  )}
                                  <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        color: isOwn ? 'white' : 'text.primary',
                                        fontWeight: 500,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {attachment.originalName}
                                    </Typography>
                                    <Typography
                                      variant="caption"
                                      sx={{
                                        display: 'block',
                                        color: isOwn ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                        fontSize: '0.65rem'
                                      }}
                                    >
                                      {(attachment.size / 1024).toFixed(1)} KB
                                    </Typography>
                                  </Box>
                                  <Download sx={{ fontSize: 18, color: isOwn ? 'white' : 'primary.main' }} />
                                </Box>
                              );
                            })}
                          </Box>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: isOwn ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                              fontSize: '0.7rem'
                            }}
                          >
                            {formatTime(message.sentAt)}
                          </Typography>
                          {isOwn && (
                            <Box sx={{ ml: 1 }}>
                              {message.isRead ? (
                                <CheckCircle sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }} />
                              ) : (
                                <Circle sx={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }} />
                              )}
                            </Box>
                          )}
                        </Box>
                      </Paper>
                    </Box>
                  );
                })}
                
                {/* Typing Indicator */}
                {typing && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
                      {typing.charAt(0).toUpperCase()}
                    </Avatar>
                    <Paper elevation={1} sx={{ p: 1, px: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        {typing} is typing...
                      </Typography>
                    </Paper>
                  </Box>
                )}
                
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {attachments.map((file, index) => (
                      <Chip
                        key={index}
                        label={file.name}
                        onDelete={() => removeAttachment(index)}
                        size="small"
                        icon={<AttachFile />}
                      />
                    ))}
                  </Box>
                )}
                
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    style={{ display: 'none' }}
                  />
                  <IconButton
                    onClick={() => fileInputRef.current?.click()}
                    size="medium"
                    color="primary"
                  >
                    <AttachFile />
                  </IconButton>
                  
                  <IconButton
                    onClick={(e) => setEmojiPickerAnchor(e.currentTarget)}
                    size="medium"
                    color="primary"
                  >
                    <EmojiEmotions />
                  </IconButton>
                  
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={sending}
                    inputRef={messageInputRef}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        alignItems: 'center'
                      }
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendMessage}
                    disabled={(!messageInput.trim() && attachments.length === 0) || sending}
                    sx={{
                      minWidth: 'auto',
                      px: 3,
                      py: 1.5,
                      height: '56px',
                      bgcolor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.dark'
                      }
                    }}
                  >
                    {sending ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Send />}
                  </Button>
                </Box>
              </Box>
              
              {/* Emoji Picker Popover */}
              <Popover
                open={Boolean(emojiPickerAnchor)}
                anchorEl={emojiPickerAnchor}
                onClose={() => setEmojiPickerAnchor(null)}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'center',
                }}
                transformOrigin={{
                  vertical: 'bottom',
                  horizontal: 'center',
                }}
              >
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </Popover>
            </Card>
          ) : (
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              justifyContent: 'center', 
              alignItems: 'center',
              color: 'text.secondary'
            }}>
              <MessageIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography variant="h6" gutterBottom>
                Select a conversation
              </Typography>
              <Typography variant="body2">
                Choose a conversation from the list to start messaging
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      {/* New Conversation Dialog */}
      <Dialog open={newConversationDialog} onClose={() => setNewConversationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start New Conversation</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
            <InputLabel>Select Recipient</InputLabel>
            <Select
              value={selectedRecipient}
              onChange={(e) => setSelectedRecipient(e.target.value)}
              label="Select Recipient"
            >
              {recipients.map((recipient) => (
                <MenuItem key={recipient._id} value={recipient._id}>
                  {recipient.firstName} {recipient.lastName} ({recipient.role})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="Type your message..."
            value={newMessageContent}
            onChange={(e) => setNewMessageContent(e.target.value)}
            label="Message"
          />
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setNewConversationDialog(false)}
            sx={{
              borderColor: '#d32f2f',
              color: '#d32f2f',
              '&:hover': {
                borderColor: '#b71c1c',
                backgroundColor: 'rgba(211, 47, 47, 0.05)',
                color: '#b71c1c',
              },
              '&:active': {
                borderColor: '#c62828',
                backgroundColor: 'rgba(198, 40, 40, 0.1)',
                color: '#c62828',
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleNewConversation}
            disabled={!selectedRecipient || !newMessageContent.trim() || sending}
          >
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CommunicationPage;

