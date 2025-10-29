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
  Person,
  Email as EmailIcon,
  School,
  Group
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import messagingService from '../../../services/messagingService';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      switch (messageType) {
        case 'notification':
          subject = `🔔 ${messageTitle}`;
          formattedMessage = `**NOTIFICATION** ${messagePriority === 'high' ? '⚠️ HIGH PRIORITY' : messagePriority === 'medium' ? '📌 MEDIUM PRIORITY' : '✓ LOW PRIORITY'}\n\n`;
          formattedMessage += `**${messageTitle}**\n\n`;
          formattedMessage += newMessageContent.trim();
          formattedMessage += `\n\n---\nSent by: ${user?.firstName} ${user?.lastName}\nDate: ${new Date().toLocaleString()}`;
          break;

        case 'announcement':
          subject = `📢 ${messageTitle}`;
          formattedMessage = `**ANNOUNCEMENT**\n\n`;
          formattedMessage += `**${messageTitle}**\n\n`;
          formattedMessage += newMessageContent.trim();
          formattedMessage += `\n\n---\nSent by: ${user?.firstName} ${user?.lastName}\nDate: ${new Date().toLocaleString()}`;
          break;

        case 'reminder':
          subject = `⏰ ${messageTitle}`;
          const reminderDateObj = new Date(reminderDate);
          formattedMessage = `**REMINDER** ${messagePriority === 'high' ? '⚠️ HIGH PRIORITY' : messagePriority === 'medium' ? '📌 MEDIUM PRIORITY' : '✓ LOW PRIORITY'}\n\n`;
          formattedMessage += `**${messageTitle}**\n\n`;
          formattedMessage += `📅 Due: ${reminderDateObj.toLocaleString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}\n\n`;
          formattedMessage += newMessageContent.trim();
          formattedMessage += `\n\n---\nSent by: ${user?.firstName} ${user?.lastName}`;
          break;

        case 'personal':
        default:
          subject = 'Personal Message from Admin';
          formattedMessage = newMessageContent.trim();
          break;
      }

      // Add recipient information to the message
      let recipientInfo = '';
      switch (recipientType) {
        case 'all':
          recipientInfo = `\n\n📢 Sent to: All Parents (${parents.length} recipients)`;
          break;
        case 'selected':
          recipientInfo = `\n\n📢 Sent to: ${selectedRecipients.length} selected parent(s)`;
          break;
        case 'grade':
          recipientInfo = `\n\n📢 Sent to: Parents of Grade ${selectedRecipients.join(', ')}`;
          break;
        case 'class':
          const classNames = selectedRecipients.map(id => {
            const classInfo = classes.find(c => c._id === id);
            return classInfo ? `${classInfo.name} (Grade ${classInfo.grade})` : id;
          });
          recipientInfo = `\n\n📢 Sent to: Parents of ${classNames.join(', ')}`;
          break;
        case 'group':
          const groupNames = selectedRecipients.map(id => {
            const groupInfo = parentGroups.find(g => g._id === id);
            return groupInfo ? `${groupInfo.name} (${groupInfo.members?.length || 0} members)` : id;
          });
          recipientInfo = `\n\n📢 Sent to: Parent Groups: ${groupNames.join(', ')}`;
          break;
      }
      formattedMessage += recipientInfo;

      // For now, we'll create a single conversation with the first parent
      // In a full implementation, this would create multiple conversations
      let targetParentId = '';
      
      console.log('Recipient type:', recipientType);
      console.log('Selected recipients:', selectedRecipients);
      console.log('Parents data:', parents);
      
      if (recipientType === 'all') {
        // Use first parent as representative for demo
        targetParentId = parents[0]?._id;
        console.log('All parents - using first parent:', targetParentId);
      } else if (recipientType === 'selected') {
        targetParentId = selectedRecipients[0];
        console.log('Selected parents - using first selected:', targetParentId);
      } else {
        // For grade/class/group, we'd need to find parents of students in those grades/classes/groups
        // For now, use first parent as demo
        targetParentId = parents[0]?._id;
        console.log('Other type - using first parent:', targetParentId);
      }

      console.log('Final target parent ID:', targetParentId);

      if (!targetParentId) {
        showSnackbar('No valid recipients found', 'error');
        return;
      }

      const response = await messagingService.createConversation(
        targetParentId,
        formattedMessage,
        subject
      );

      if (response.success) {
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
        
        // Reload conversations
        await loadConversations();
        
        // Select the new conversation
        const newConv = conversations.find(c => c._id === response.data.conversation._id);
        if (newConv) {
          handleSelectConversation(newConv);
        }

        // Show success message with recipient count
        let recipientCount = 0;
        switch (recipientType) {
          case 'all':
            recipientCount = parents.length;
            break;
          case 'selected':
            recipientCount = selectedRecipients.length;
            break;
          case 'grade':
            // In real implementation, count parents of students in selected grades
            recipientCount = selectedRecipients.length;
            break;
        case 'class':
          // In real implementation, count parents of students in selected classes
          recipientCount = selectedRecipients.length;
          break;
        case 'group':
          // In real implementation, count all members in selected groups
          recipientCount = selectedRecipients.reduce((total, groupId) => {
            const group = parentGroups.find(g => g._id === groupId);
            return total + (group?.members?.length || 0);
          }, 0);
          break;
        }

        showSnackbar(`Message sent successfully to ${recipientCount} recipient(s)!`, 'success');
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
        // Load parents
        const parentsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/students`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const parentsData = await parentsResponse.json();
        if (parentsData.success) {
          // Get unique parents by email and find their actual parent user records
          const studentsWithParents = parentsData.data.filter((student: any) => student.parentEmail);
          console.log('Students with parent emails:', studentsWithParents);
          
          // For each unique parent email, find the actual parent user record
          const uniqueParentEmails = [...new Set(studentsWithParents.map((student: any) => student.parentEmail))];
          console.log('Unique parent emails:', uniqueParentEmails);
          
          const parentPromises = uniqueParentEmails.map(async (email: string) => {
            try {
              const parentResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/users?email=${email}&role=parent`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              });
              const parentData = await parentResponse.json();
              if (parentData.success && parentData.data.length > 0) {
                return parentData.data[0]; // Return the parent user record
              }
              return null;
            } catch (error) {
              console.error('Error fetching parent:', error);
              return null;
            }
          });
          
          const parentUsers = (await Promise.all(parentPromises)).filter(Boolean);
          console.log('Found parent users:', parentUsers);
          setParents(parentUsers);
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
                                    {conv.lastMessage?.content || 'No messages yet'}
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
                            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                              {message.content}
                            </Typography>
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
                    
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                      <input
                        type="file"
                        ref={chatFileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        style={{ display: 'none' }}
                      />
                      <IconButton
                        onClick={() => chatFileInputRef.current?.click()}
                        size="small"
                        color="primary"
                      >
                        <AttachFile />
                      </IconButton>
                      
                      <IconButton
                        onClick={(e) => setChatEmojiPickerAnchor(e.currentTarget)}
                        size="small"
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
                      />
                      <Button
                        variant="contained"
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && chatAttachments.length === 0) || sending}
                        sx={{
                          minWidth: 'auto',
                          px: 3,
                          py: 1.5,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
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
          <Dialog open={newConversationDialog} onClose={() => setNewConversationDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>New Communication</DialogTitle>
            <DialogContent>
              {/* Message Type Selection */}
              <FormControl component="fieldset" sx={{ mt: 2, mb: 3 }}>
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
                
                <TextField
                  fullWidth
                  multiline
                  rows={messageType === 'personal' ? 6 : 4}
                  placeholder={
                    messageType === 'notification' ? 'Enter the notification details...' :
                    messageType === 'announcement' ? 'Enter the announcement details...' :
                    messageType === 'reminder' ? 'Enter reminder details and what action is needed...' :
                    'Type your personal message...'
                  }
                  value={newMessageContent}
                  onChange={(e) => setNewMessageContent(e.target.value)}
                  label="Message Content"
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
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
                        >
                          <AttachFile />
                        </IconButton>
                        <IconButton
                          onClick={(e) => setEmojiPickerAnchor(e.currentTarget)}
                          size="small"
                          color="primary"
                        >
                          <EmojiEmotions />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
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
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => {
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
              }}>
                Cancel
              </Button>
              <Button 
                variant="contained" 
                onClick={handleNewConversation}
                disabled={
                  (!newMessageContent.trim() && attachments.length === 0) || 
                  (messageType !== 'personal' && !messageTitle.trim()) ||
                  (messageType === 'reminder' && !reminderDate) ||
                  (recipientType === 'selected' && selectedRecipients.length === 0) ||
                  (recipientType === 'grade' && selectedRecipients.length === 0) ||
                  (recipientType === 'class' && selectedRecipients.length === 0) ||
                  (recipientType === 'group' && selectedRecipients.length === 0) ||
                  sending
                }
                startIcon={<Send />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                {sending ? 'Sending...' : 'Send Message'}
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

