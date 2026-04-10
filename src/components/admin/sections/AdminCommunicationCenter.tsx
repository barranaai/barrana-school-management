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
  Tabs,
  Tab,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Alert,
  Snackbar,
  Popover,
  Checkbox
} from '@mui/material';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import moment from 'moment-timezone';
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
  Person,
  Email as EmailIcon,
  School,
  Group,
  Close,
  Description,
  Image as ImageIcon,
  VideoLibrary,
  InsertDriveFile,
  Download
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import messagingService from '../../../services/messagingService';
import notificationService from '../../../services/notificationService';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';
import RichTextEditor from '../../common/RichTextEditor';

interface AdminCommunicationCenterProps {
  schoolBranding?: any;
}

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  sentAt: string;
  tempId?: string;
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
    email?: string;
  };
  metadata?: {
    studentName?: string;
  };
}

const AdminCommunicationCenter: React.FC<AdminCommunicationCenterProps> = ({ schoolBranding }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0); // 0 = Messages, 1 = Bulk Communications (coming soon)
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typing, setTyping] = useState<string | null>(null);
  const [newConversationDialog, setNewConversationDialog] = useState(false);
  const [parents, setParents] = useState<any[]>([]);
  const [selectedParent, setSelectedParent] = useState('');
  const [newMessageContent, setNewMessageContent] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'notification' | 'announcement' | 'reminder' | 'personal'>('personal');
  const [messageTitle, setMessageTitle] = useState('');
  const [messagePriority, setMessagePriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [reminderDate, setReminderDate] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'selected' | 'grade' | 'class' | 'group'>('selected');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [parentGroups, setParentGroups] = useState<any[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'success'
  });
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState<HTMLElement | null>(null);
  const [chatEmojiPickerAnchor, setChatEmojiPickerAnchor] = useState<HTMLElement | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [chatAttachments, setChatAttachments] = useState<File[]>([]);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get branding colors
  const getBrandingColors = () => {
    const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';
    const secondaryColor = schoolBranding?.branding?.secondaryColor || schoolBranding?.secondaryColor || '#764ba2';
    return { primaryColor, secondaryColor };
  };

  const { primaryColor, secondaryColor } = getBrandingColors();
  const brandingGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
  const brandingGradientHover = `linear-gradient(135deg, ${primaryColor}dd 0%, ${secondaryColor}dd 100%)`;

  // Get school timezone
  const getSchoolTimezone = (): string => {
    return schoolBranding?.settings?.timezone || 'UTC';
  };

  // Helper function to convert scheduled date/time in school timezone to UTC
  const convertScheduleToUTC = (date: string, time: string): string => {
    const schoolTimezone = getSchoolTimezone();
    // Combine date and time, then parse in school timezone
    const scheduledDateTime = moment.tz(`${date} ${time}`, 'YYYY-MM-DD HH:mm', schoolTimezone);
    // Convert to UTC ISO string
    return scheduledDateTime.utc().toISOString();
  };

  // Helper function to get current time in school timezone
  const getCurrentTimeInSchoolTimezone = (): moment.Moment => {
    const schoolTimezone = getSchoolTimezone();
    return moment().tz(schoolTimezone);
  };

  // Helper function to strip HTML tags for previews
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

  // Helper function to show snackbar
  const showSnackbar = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity
    });
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Initialize Socket.io and fetch initial data
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        setConnectionError(null);
        
        console.log('🔄 Admin connecting to messaging service...');
        
        // Connect to Socket.io
        await messagingService.connect();
        console.log('✅ Admin messaging service connected');

        // Initialize Firebase push notifications
        try {
          await notificationService.initializePushNotifications((payload) => {
            console.log('🔔 Admin push notification received in foreground:', payload);
            showBrowserNotification(payload);
          });
          console.log('✅ Push notifications initialized for admin messaging');
        } catch (notifError) {
          console.warn('Push notifications not available:', notifError);
        }

        // Fetch conversations
        await loadConversations();

        // Set up Socket.io listeners
        setupSocketListeners();
        
      } catch (error: any) {
        console.error('❌ Error initializing admin messaging:', error);
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
        console.log('📋 Admin loaded conversations:', response.data.length);
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
    messagingService.onNewMessage((message: Message) => {
      console.log('📨 Admin received new message:', message);
      
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
      
      // Update conversations list
      loadConversations();
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
      if (selectedConversation && data.conversationId === selectedConversation._id) {
        setMessages(prev => prev.map(msg => 
          msg.senderId === user?._id ? { ...msg, isRead: true } : msg
        ));
      }
    });

    // Error handling
    messagingService.onMessageError((error) => {
      console.error('❌ Message error:', error);
      showSnackbar('Failed to send message. Please try again.', 'error');
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

  // Emoji picker handlers
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    setMessageInput(prev => prev + emoji);
    setChatEmojiPickerAnchor(null);
  };

  const handleNewConversationEmojiClick = (emojiData: EmojiClickData) => {
    const emoji = emojiData.emoji;
    setNewMessageContent(prev => prev + emoji);
    setEmojiPickerAnchor(null);
  };

  // Attachment handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setChatAttachments(prev => [...prev, ...fileArray]);
    }
    // Reset input
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  const handleNewConversationFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    setChatAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewConversationAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Handle send message
  const handleSendMessage = async () => {
    if ((!messageInput.trim() && chatAttachments.length === 0) || !selectedConversation || sending) return;

    const tempId = `temp_${Date.now()}`;
    const content = messageInput.trim();

    setSending(true);

    try {
      // Upload attachments first
      let uploadedAttachments: any[] = [];
      if (chatAttachments.length > 0) {
        uploadedAttachments = await messagingService.uploadAttachments(chatAttachments);
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
        attachments: uploadedAttachments
      };

      setMessages(prev => [...prev, tempMessage]);
      setMessageInput('');
      setChatAttachments([]);

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
      showSnackbar(error.message || 'Failed to send message', 'error');
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
    // Validate required fields based on message type
    if (messageType !== 'personal' && !messageTitle.trim()) {
      showSnackbar('Please enter a title for this message', 'warning');
      return;
    }

    if (messageType === 'reminder' && !reminderDate) {
      showSnackbar('Please select a reminder date and time', 'warning');
      return;
    }

    // Validate scheduling
    if (isScheduled && (!scheduledDate || !scheduledTime)) {
      showSnackbar('Please select both date and time for scheduling', 'warning');
      return;
    }

    // Validate scheduled date/time is in the future
    if (isScheduled && scheduledDate && scheduledTime) {
      const schoolTimezone = getSchoolTimezone();
      const scheduledDateTime = moment.tz(`${scheduledDate} ${scheduledTime}`, 'YYYY-MM-DD HH:mm', schoolTimezone);
      const nowInSchoolTimezone = getCurrentTimeInSchoolTimezone();
      
      if (scheduledDateTime.isSameOrBefore(nowInSchoolTimezone)) {
        showSnackbar('Scheduled date and time must be in the future', 'warning');
        return;
      }
    }

    // Validate recipients
    if (recipientType === 'selected' && selectedRecipients.length === 0) {
      showSnackbar('Please select at least one parent', 'warning');
      return;
    }

    if (recipientType === 'grade' && selectedRecipients.length === 0) {
      showSnackbar('Please select at least one grade', 'warning');
      return;
    }

    if (recipientType === 'class' && selectedRecipients.length === 0) {
      showSnackbar('Please select at least one class', 'warning');
      return;
    }

    if (recipientType === 'group' && selectedRecipients.length === 0) {
      showSnackbar('Please select at least one parent group', 'warning');
      return;
    }

    try {
      setSending(true);

      // Format message based on type
      let formattedMessage = '';
      let subject = '';

      // Helper to escape HTML in titles to prevent XSS
      const escapeHtml = (text: string): string => {
        const map: { [key: string]: string } = {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
      };

      // Ensure content is properly trimmed
      const content = newMessageContent.trim();
      const safeTitle = escapeHtml(messageTitle.trim());

      switch (messageType) {
        case 'notification':
          subject = messageTitle.trim();
          // Format: Title as heading, then content with preserved HTML formatting
          formattedMessage = `<h3 style="margin: 0 0 12px 0; font-size: 1.1rem; font-weight: 600; color: #1a1a1a;">${safeTitle}</h3>${content}`;
          break;

        case 'announcement':
          subject = messageTitle.trim();
          // Format: Title as heading, then content with preserved HTML formatting
          formattedMessage = `<h3 style="margin: 0 0 12px 0; font-size: 1.1rem; font-weight: 600; color: #1a1a1a;">${safeTitle}</h3>${content}`;
          break;

        case 'reminder':
          subject = messageTitle.trim();
          const reminderDateObj = new Date(reminderDate);
          const formattedReminderDate = reminderDateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          // Format: Title as heading, due date as paragraph, then content with preserved HTML formatting
          formattedMessage = `<h3 style="margin: 0 0 12px 0; font-size: 1.1rem; font-weight: 600; color: #1a1a1a;">${safeTitle}</h3><p style="margin: 0 0 12px 0; color: #666; font-size: 0.95rem;"><strong>Due Date:</strong> ${escapeHtml(formattedReminderDate)}</p>${content}`;
          break;

        case 'personal':
        default:
          subject = 'Message from School Administration';
          // For personal messages, just use the content with preserved HTML formatting
          formattedMessage = content;
          break;
      }

      // Determine which parents to send to
      let targetParentIds: string[] = [];
      
      console.log('Recipient type:', recipientType);
      console.log('Selected recipients:', selectedRecipients);
      console.log('Parents data:', parents);
      
      if (recipientType === 'all') {
        // Send to all parents
        targetParentIds = parents.map(p => p._id);
        console.log('All parents selected - sending to:', targetParentIds.length, 'parents');
      } else if (recipientType === 'selected') {
        // Send to selected parents
        targetParentIds = selectedRecipients;
        console.log('Selected parents:', targetParentIds.length);
      } else {
        // For grade/class/group, we'd need to find parents of students in those grades/classes/groups
        // For now, use all parents as fallback
        targetParentIds = parents.map(p => p._id);
        console.log('Other type - using all parents:', targetParentIds.length);
      }

      if (!targetParentIds || targetParentIds.length === 0) {
        showSnackbar('No valid recipients found', 'error');
        setSending(false);
        return;
      }

      // Upload attachments first if any
      let uploadedAttachments: any[] = [];
      if (attachments.length > 0) {
        try {
          uploadedAttachments = await messagingService.uploadAttachments(attachments);
          console.log('Attachments uploaded:', uploadedAttachments);
        } catch (error) {
          console.error('Error uploading attachments:', error);
          showSnackbar('Failed to upload attachments', 'error');
          setSending(false);
          return;
        }
      }

      // Send message to each parent (create separate conversations)
      let successCount = 0;
      let failCount = 0;
      
      for (const parentId of targetParentIds) {
        try {
          const response = await messagingService.createConversation(
            parentId,
            formattedMessage,
            subject,
            undefined, // studentId
            isScheduled ? {
              scheduledDate: scheduledDate,
              scheduledTime: scheduledTime,
              scheduledDateTime: convertScheduleToUTC(scheduledDate, scheduledTime),
              timezone: getSchoolTimezone()
            } : undefined,
            true, // forceNewThread - always create a new conversation thread
            uploadedAttachments // pass attachments
          );
          
          if (response.success) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error('Error sending to parent:', parentId, error);
          failCount++;
        }
      }

      console.log(`Messages sent: ${successCount} success, ${failCount} failed`);

      // Reset all fields
      setNewConversationDialog(false);
      setSelectedParent('');
      setNewMessageContent('');
      setMessageTitle('');
      setMessageType('personal');
      setReminderDate('');
      setMessagePriority('medium');
      setRecipientType('selected');
      setSelectedRecipients([]);
      setParentGroups([]);
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
      setAttachments([]);
      setChatAttachments([]);
      
      // Reload conversations
      await loadConversations();
      
      // Show success message with counts
      if (successCount > 0) {
        if (failCount > 0) {
          showSnackbar(`Messages sent to ${successCount} parent(s). ${failCount} failed.`, 'warning');
        } else {
          showSnackbar(`Messages sent successfully to ${successCount} parent(s)!`, 'success');
        }
      } else {
        showSnackbar('Failed to send messages to any parent', 'error');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      showSnackbar('Failed to create conversation', 'error');
    } finally {
      setSending(false);
    }
  };

  // Load parents for new conversation
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all parents directly (more efficient than querying by email)
        const parentsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/users?role=parent`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const parentsData = await parentsResponse.json();
        if (parentsData.success) {
          console.log('Loaded all parent users:', parentsData.data);
          setParents(parentsData.data);
        }

        // Load grades and classes
        const classesResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/classes`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const classesData = await classesResponse.json();
        if (classesData.success) {
          // Extract unique grades
          const uniqueGrades = [...new Set(classesData.data.map((cls: any) => cls.grade).filter(Boolean))].sort();
          setGrades(uniqueGrades);
          
          // Set classes
          setClasses(classesData.data);
        }

        // Load parent groups
        const groupsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/parent-groups`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const groupsData = await groupsResponse.json();
        if (groupsData.success) {
          setParentGroups(groupsData.data);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    if (newConversationDialog) {
      loadData();
    }
  }, [newConversationDialog, user?.schoolId]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.otherParticipant?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.metadata?.studentName?.toLowerCase().includes(searchQuery.toLowerCase())
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
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Communication Center
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', gap: 2, p: 3 }}>
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
      </Box>
    );
  }

  const getRandomCardColor = (index: number) => {
    return themeColors.cardColors[index % themeColors.cardColors.length];
  };

  return (
    <Box>
      {schoolBranding && (
        <Paper
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a'} 100%)`,
            borderRadius: 4,
            p: 3,
            mb: 4,
            mt: 0,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={9}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {schoolBranding.name || 'School Name'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                {schoolBranding.established && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📅 Est. {schoolBranding.established}
                  </Typography>
                )}
                {schoolBranding.address && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📍 {typeof schoolBranding.address === 'string' 
                      ? schoolBranding.address 
                      : `${schoolBranding.address.street}, ${schoolBranding.address.city}, ${schoolBranding.address.state}`}
                  </Typography>
                )}
                {schoolBranding.email && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    ✉️ {schoolBranding.email}
                  </Typography>
                )}
                {schoolBranding.phone && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📞 {schoolBranding.phone}
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              {(schoolBranding.logo || schoolBranding.branding?.logo) && (() => {
                const logoPath = schoolBranding.logo || schoolBranding.branding?.logo || '';
                const logoUrl = logoPath.startsWith('http://') || logoPath.startsWith('https://') 
                  ? logoPath 
                  : `${(process.env.REACT_APP_API_URL || 'http://localhost:5050').replace('/api', '')}${logoPath.startsWith('/') ? logoPath : '/' + logoPath}`;
                return (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.95)',
                      borderRadius: 3,
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <img 
                        src={logoUrl} 
                        alt={schoolBranding.name}
                        style={{ 
                          maxWidth: '120px',
                          maxHeight: '120px',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  </Box>
                );
              })()}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 600,
            background: schoolBranding 
              ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Communication Center
        </Typography>
        <NotificationIcon />
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Direct Messages" />
        <Tab label="Bulk Communications" disabled />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
          <Grid container spacing={0} sx={{ flexGrow: 1, height: '100%' }}>
            {/* Conversation List */}
            <Grid item xs={12} md={4} sx={{ height: '100%', borderRight: '1px solid', borderColor: 'divider' }}>
              <Card sx={{ height: '100%', borderRadius: 0, boxShadow: 'none' }}>
                <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Parent Messages
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
                                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                                  <Person />
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
                                <>
                                  {conv.metadata?.studentName && (
                                    <Chip 
                                      label={`Re: ${conv.metadata.studentName}`}
                                      size="small"
                                      sx={{ height: 18, fontSize: '0.7rem', mb: 0.5, textTransform: 'capitalize' }}
                                    />
                                  )}
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
                                </>
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
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>
                        <Person />
                      </Avatar>
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {selectedConversation.otherParticipant?.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip 
                            label="Parent"
                            size="small"
                            sx={{ textTransform: 'capitalize', height: 20 }}
                          />
                          {selectedConversation.metadata?.studentName && (
                            <Chip 
                              label={`Student: ${selectedConversation.metadata.studentName}`}
                              size="small"
                              variant="outlined"
                              sx={{ textTransform: 'capitalize', height: 20 }}
                            />
                          )}
                        </Box>
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
                                bgcolor: 'secondary.main',
                                fontSize: '0.875rem'
                              }}
                            >
                              <Person sx={{ fontSize: '1rem' }} />
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
                            <Box
                              component="div"
                              dangerouslySetInnerHTML={{ __html: message.content }}
                              sx={{
                                fontSize: '0.875rem',
                                wordBreak: 'break-word',
                                '& p': {
                                  margin: 0,
                                  marginBottom: '0.5rem',
                                  '&:last-child': {
                                    marginBottom: 0,
                                  },
                                },
                                '& ul, & ol': {
                                  margin: '0.5rem 0',
                                  paddingLeft: '1.5rem',
                                },
                                '& h1, & h2, & h3': {
                                  margin: '0.5rem 0',
                                  fontWeight: 600,
                                },
                                '& a': {
                                  color: isOwn ? 'rgba(255,255,255,0.9)' : primaryColor,
                                  textDecoration: 'underline',
                                  '&:hover': {
                                    textDecoration: 'none',
                                  },
                                },
                                '& img': {
                                  maxWidth: '100%',
                                  height: 'auto',
                                  borderRadius: 1,
                                  marginTop: '0.5rem',
                                },
                              }}
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
                                        <Description sx={{ fontSize: 20, color: isOwn ? 'white' : primaryColor }} />
                                      ) : (
                                        <InsertDriveFile sx={{ fontSize: 20, color: isOwn ? 'white' : primaryColor }} />
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
                                      <Download sx={{ fontSize: 18, color: isOwn ? 'white' : primaryColor }} />
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
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.main', fontSize: '0.75rem' }}>
                          <Person sx={{ fontSize: '0.875rem' }} />
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
                    {chatAttachments.length > 0 && (
                      <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {chatAttachments.map((file, index) => (
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
                        ref={chatFileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        style={{ display: 'none' }}
                      />
                      <IconButton
                        onClick={() => chatFileInputRef.current?.click()}
                        size="medium"
                        sx={{ 
                          color: primaryColor,
                          '&:hover': {
                            bgcolor: `${primaryColor}15`
                          }
                        }}
                      >
                        <AttachFile />
                      </IconButton>
                      
                      <IconButton
                        onClick={(e) => setChatEmojiPickerAnchor(e.currentTarget)}
                        size="medium"
                        sx={{ 
                          color: primaryColor,
                          '&:hover': {
                            bgcolor: `${primaryColor}15`
                          }
                        }}
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
                        disabled={(!messageInput.trim() && chatAttachments.length === 0) || sending}
                        sx={{
                          minWidth: 'auto',
                          px: 3,
                          py: 1.5,
                          height: '56px',
                          background: brandingGradient,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`,
                            opacity: 0.9
                          }
                        }}
                      >
                        {sending ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <Send />}
                      </Button>
                    </Box>
                  </Box>
                  
                  {/* Emoji Picker Popover */}
                  <Popover
                    open={Boolean(chatEmojiPickerAnchor)}
                    anchorEl={chatEmojiPickerAnchor}
                    onClose={() => setChatEmojiPickerAnchor(null)}
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
          <Dialog 
            open={newConversationDialog} 
            onClose={() => setNewConversationDialog(false)} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 4,
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                overflow: 'hidden',
              }
            }}
          >
            <DialogTitle sx={{ 
              background: brandingGradient,
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 3,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MessageIcon sx={{ fontSize: 28 }} />
                <Typography variant="h6" fontWeight={600}>
                  New Communication
                </Typography>
              </Box>
              <IconButton 
                onClick={() => setNewConversationDialog(false)} 
                sx={{ 
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  }
                }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ p: 3, pt: '24px !important' }}>
              {/* Message Type Selection */}
              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <FormLabel component="legend" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                  Message Type
                </FormLabel>
                <RadioGroup
                  row
                  value={messageType}
                  onChange={(e) => {
                    setMessageType(e.target.value as any);
                    // Reset fields when changing type
                    setMessageTitle('');
                    setNewMessageContent('');
                    setReminderDate('');
                  }}
                >
                  <FormControlLabel 
                    value="notification" 
                    control={<Radio />} 
                    label="Notification" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="announcement" 
                    control={<Radio />} 
                    label="Announcement" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="reminder" 
                    control={<Radio />} 
                    label="Reminder" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="personal" 
                    control={<Radio />} 
                    label="Personal Message" 
                  />
                </RadioGroup>
              </FormControl>

              {/* Type-specific help text */}
              <Alert severity="info" sx={{ mb: 2 }}>
                {messageType === 'notification' && 'Send an important notification that requires attention.'}
                {messageType === 'announcement' && 'Broadcast an announcement to inform parents about school updates.'}
                {messageType === 'reminder' && 'Send a reminder about upcoming events, deadlines, or tasks.'}
                {messageType === 'personal' && 'Send a personal message for direct communication.'}
              </Alert>

              {/* Recipient Type Selection */}
              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <FormLabel component="legend" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
                  Recipients
                </FormLabel>
                <RadioGroup
                  row
                  value={recipientType}
                  onChange={(e) => {
                    setRecipientType(e.target.value as any);
                    setSelectedRecipients([]);
                    setSelectedParent('');
                  }}
                >
                  <FormControlLabel 
                    value="all" 
                    control={<Radio />} 
                    label="All Parents" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="selected" 
                    control={<Radio />} 
                    label="Selected Parents" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="grade" 
                    control={<Radio />} 
                    label="Selected Grade" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="class" 
                    control={<Radio />} 
                    label="Selected Class" 
                    sx={{ mr: 2 }}
                  />
                  <FormControlLabel 
                    value="group" 
                    control={<Radio />} 
                    label="Selected Group(s)" 
                  />
                </RadioGroup>
              </FormControl>

              {/* Recipient-specific help text */}
              <Alert severity="info" sx={{ mb: 2 }}>
                {recipientType === 'all' && 'Message will be sent to all parents in the school.'}
                {recipientType === 'selected' && 'Select specific parents to receive this message.'}
                {recipientType === 'grade' && 'Select grades to send message to all parents of students in those grades.'}
                {recipientType === 'class' && 'Select classes to send message to all parents of students in those classes.'}
                {recipientType === 'group' && 'Select parent groups to send message to all members of those groups.'}
              </Alert>

              {/* Recipient Selection */}
              {recipientType === 'all' && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Group />
                    <Typography variant="body2">
                      This message will be sent to all {parents.length} parents in the school.
                    </Typography>
                  </Box>
                </Alert>
              )}

              {recipientType === 'selected' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Parents</InputLabel>
                  <Select
                    multiple
                    value={selectedRecipients}
                    onChange={(e) => setSelectedRecipients(e.target.value as string[])}
                    label="Select Parents"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const parent = parents.find(p => p._id === value);
                          return (
                            <Chip 
                              key={value} 
                              label={`${parent?.firstName} ${parent?.lastName}`}
                              size="small"
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {parents.length === 0 ? (
                      <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                          No parents found. Please add students with parent emails first.
                        </Typography>
                      </MenuItem>
                    ) : (
                      parents.map((parent) => (
                        <MenuItem key={parent._id} value={parent._id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Person sx={{ fontSize: 16 }} />
                            <Box>
                              <Typography variant="body2">
                                {parent.firstName} {parent.lastName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {parent.email}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {parents.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      No parents available. Make sure students have parent emails assigned.
                    </Typography>
                  )}
                </FormControl>
              )}

              {recipientType === 'grade' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Grades</InputLabel>
                  <Select
                    multiple
                    value={selectedRecipients}
                    onChange={(e) => setSelectedRecipients(e.target.value as string[])}
                    label="Select Grades"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip 
                            key={value} 
                            label={`Grade ${value}`}
                            size="small"
                            color="primary"
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {grades.length === 0 ? (
                      <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                          No grades found. Please add classes first.
                        </Typography>
                      </MenuItem>
                    ) : (
                      grades.map((grade) => (
                        <MenuItem key={grade} value={grade}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <School sx={{ fontSize: 16 }} />
                            <Typography variant="body2">
                              Grade {grade}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {grades.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      No grades available. Make sure classes are created with grade information.
                    </Typography>
                  )}
                </FormControl>
              )}

              {recipientType === 'class' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Classes</InputLabel>
                  <Select
                    multiple
                    value={selectedRecipients}
                    onChange={(e) => setSelectedRecipients(e.target.value as string[])}
                    label="Select Classes"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const classInfo = classes.find(c => c._id === value);
                          return (
                            <Chip 
                              key={value} 
                              label={`${classInfo?.name} (Grade ${classInfo?.grade})`}
                              size="small"
                              color="secondary"
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {classes.length === 0 ? (
                      <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                          No classes found. Please add classes first.
                        </Typography>
                      </MenuItem>
                    ) : (
                      classes.map((classInfo) => (
                        <MenuItem key={classInfo._id} value={classInfo._id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Group sx={{ fontSize: 16 }} />
                            <Box>
                              <Typography variant="body2">
                                {classInfo.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Grade {classInfo.grade}
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {classes.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      No classes available. Please create classes first.
                    </Typography>
                  )}
                </FormControl>
              )}

              {recipientType === 'group' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Parent Groups</InputLabel>
                  <Select
                    multiple
                    value={selectedRecipients}
                    onChange={(e) => setSelectedRecipients(e.target.value as string[])}
                    label="Select Parent Groups"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => {
                          const groupInfo = parentGroups.find(g => g._id === value);
                          return (
                            <Chip 
                              key={value} 
                              label={`${groupInfo?.name} (${groupInfo?.members?.length || 0} members)`}
                              size="small"
                              color="success"
                            />
                          );
                        })}
                      </Box>
                    )}
                  >
                    {parentGroups.length === 0 ? (
                      <MenuItem disabled>
                        <Typography variant="body2" color="text.secondary">
                          No parent groups found. Please create parent groups first.
                        </Typography>
                      </MenuItem>
                    ) : (
                      parentGroups.map((groupInfo) => (
                        <MenuItem key={groupInfo._id} value={groupInfo._id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Group sx={{ fontSize: 16 }} />
                            <Box>
                              <Typography variant="body2">
                                {groupInfo.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {groupInfo.members?.length || 0} members
                              </Typography>
                            </Box>
                          </Box>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {parentGroups.length === 0 && (
                    <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                      No parent groups available. Please create parent groups first.
                    </Typography>
                  )}
                </FormControl>
              )}

              {/* Subject/Title - for all types except personal */}
              {messageType !== 'personal' && (
                <TextField
                  fullWidth
                  label={messageType === 'notification' ? 'Notification Title' : 
                         messageType === 'announcement' ? 'Announcement Title' : 
                         'Reminder Title'}
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder={messageType === 'notification' ? 'e.g., Urgent: School Closure Tomorrow' : 
                               messageType === 'announcement' ? 'e.g., New School Policy Update' :
                               'e.g., Field Trip Permission Due Tomorrow'}
                  sx={{ mb: 2 }}
                  required
                />
              )}

              {/* Priority - for notifications and reminders */}
              {(messageType === 'notification' || messageType === 'reminder') && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={messagePriority}
                    onChange={(e) => setMessagePriority(e.target.value as any)}
                    label="Priority"
                  >
                    <MenuItem value="low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Circle sx={{ fontSize: 12, color: 'success.main' }} />
                        Low
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Circle sx={{ fontSize: 12, color: 'warning.main' }} />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Circle sx={{ fontSize: 12, color: 'error.main' }} />
                        High
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Due Date - for reminders only */}
              {messageType === 'reminder' && (
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Reminder Date & Time"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  sx={{ mb: 2 }}
                  helperText="When should the parent be reminded?"
                />
              )}

              {/* Message Content */}
              <Box sx={{ mb: 2 }}>
                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {attachments.map((file, index) => (
                      <Chip
                        key={index}
                        label={file.name}
                        onDelete={() => removeNewConversationAttachment(index)}
                        size="small"
                        icon={<AttachFile />}
                      />
                    ))}
                  </Box>
                )}
                
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'text.secondary' }}>
                  Message Content <span style={{ color: 'red' }}>*</span>
                </Typography>
                
                {/* Attachment and Emoji Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleNewConversationFileSelect}
                    multiple
                    style={{ display: 'none' }}
                  />
                  <IconButton
                    onClick={() => fileInputRef.current?.click()}
                    size="small"
                    color="primary"
                    title="Attach file"
                  >
                    <AttachFile />
                  </IconButton>
                  <IconButton
                    onClick={(e) => setEmojiPickerAnchor(e.currentTarget)}
                    size="small"
                    color="primary"
                    title="Add emoji"
                  >
                    <EmojiEmotions />
                  </IconButton>
                </Box>
                
                <RichTextEditor
                  value={newMessageContent}
                  onChange={(value) => setNewMessageContent(value)}
                  placeholder={
                    messageType === 'notification' ? 'Enter the notification details...' :
                    messageType === 'announcement' ? 'Enter the announcement details...' :
                    messageType === 'reminder' ? 'Enter reminder details and what action is needed...' :
                    'Type your personal message...'
                  }
                  minHeight={messageType === 'personal' ? 200 : 150}
                />
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
                <EmojiPicker onEmojiClick={handleNewConversationEmojiClick} />
              </Popover>

              {/* Schedule Option */}
              <Box sx={{ mt: 2, mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isScheduled}
                      onChange={(e) => setIsScheduled(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Schedule this message"
                />
                {isScheduled && (
                  <>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Schedule Date"
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          required={isScheduled}
                          inputProps={{
                            min: getCurrentTimeInSchoolTimezone().format('YYYY-MM-DD')
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Schedule Time"
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          required={isScheduled}
                        />
                      </Grid>
                    </Grid>
                    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>⏰</span>
                        <span>
                          Time will be scheduled in school timezone: <strong>{getSchoolTimezone()}</strong>
                          {scheduledDate && scheduledTime && (
                            <> • Scheduled for: {moment.tz(`${scheduledDate} ${scheduledTime}`, 'YYYY-MM-DD HH:mm', getSchoolTimezone()).format('MMM DD, YYYY [at] h:mm A z')}</>
                          )}
                        </span>
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setNewConversationDialog(false);
                  setMessageType('personal');
                  setMessageTitle('');
                  setNewMessageContent('');
                  setSelectedParent('');
                  setReminderDate('');
                  setMessagePriority('medium');
                  setRecipientType('selected');
                  setSelectedRecipients([]);
                  setParentGroups([]);
                  setAttachments([]);
                  setEmojiPickerAnchor(null);
                  setIsScheduled(false);
                  setScheduledDate('');
                  setScheduledTime('');
                }}
                sx={{
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  borderColor: '#d32f2f',
                  color: '#d32f2f',
                  '&:hover': {
                    borderColor: '#b71c1c',
                    background: 'rgba(211, 47, 47, 0.05)',
                    color: '#b71c1c',
                    transform: 'translateY(-2px)',
                  },
                  '&:active': {
                    borderColor: '#c62828',
                    background: 'rgba(198, 40, 40, 0.1)',
                    color: '#c62828',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleNewConversation}
                startIcon={<Send />}
                disabled={
                  (!newMessageContent.trim() && attachments.length === 0) || 
                  (messageType !== 'personal' && !messageTitle.trim()) ||
                  (messageType === 'reminder' && !reminderDate) ||
                  (recipientType === 'selected' && selectedRecipients.length === 0) ||
                  (recipientType === 'grade' && selectedRecipients.length === 0) ||
                  (recipientType === 'class' && selectedRecipients.length === 0) ||
                  (recipientType === 'group' && selectedRecipients.length === 0) ||
                  (isScheduled && (!scheduledDate || !scheduledTime)) ||
                  sending
                }
                sx={{
                  background: brandingGradient,
                  borderRadius: 3,
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    background: brandingGradientHover,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                  },
                  '&:disabled': {
                    background: '#e0e0e0',
                    color: '#9e9e9e',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {sending ? 'Sending...' : (isScheduled ? 'Schedule Message' : 'Send Message')}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <EmailIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3, color: 'text.secondary' }} />
          <Typography variant="h6" gutterBottom color="text.secondary">
            Bulk Communications
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Send emails to multiple parents at once - Coming Soon
          </Typography>
        </Box>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminCommunicationCenter;

