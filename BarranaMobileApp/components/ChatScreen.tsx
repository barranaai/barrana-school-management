import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import messagingService, { Message, Conversation } from '../services/messagingService';
import MessageBubble from './MessageBubble';

interface ChatScreenProps {
  conversation: Conversation;
  user: any;
  branding?: any;
  onBack: () => void;
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  conversation,
  user,
  branding,
  onBack,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';

  const otherParticipant = conversation.participants.find(p => p._id !== user._id);

  useEffect(() => {
    loadMessages();
    setupEventListeners();
    markAsRead();
    
    return () => {
      // Cleanup event listeners
      messagingService.removeListener('receive_message');
      messagingService.removeListener('typing_status');
      messagingService.removeListener('messages_read');
    };
  }, [conversation._id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await messagingService.getMessages(conversation._id);
      setMessages(data);
      
      // Scroll to bottom after messages load
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    // Listen for new messages
    messagingService.onMessageReceived(({ message, tempId }) => {
      if (message.conversation === conversation._id) {
        setMessages(prev => {
          // Remove temporary message if it exists
          const filtered = prev.filter(m => m._id !== tempId);
          return [...filtered, message];
        });
        
        // Scroll to bottom
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    });

    // Listen for typing status
    messagingService.onTypingStatus(({ conversationId, userId, isTyping }) => {
      if (conversationId === conversation._id && userId !== user._id) {
        setTypingUsers(prev => {
          if (isTyping) {
            return prev.includes(userId) ? prev : [...prev, userId];
          } else {
            return prev.filter(id => id !== userId);
          }
        });
      }
    });

    // Listen for read receipts
    messagingService.onMessagesRead(({ conversationId, readerId }) => {
      if (conversationId === conversation._id && readerId !== user._id) {
        // Update message read status if needed
        console.log('Messages read by:', readerId);
      }
    });
  };

  const markAsRead = async () => {
    try {
      await messagingService.markAsRead(conversation._id);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Emoji handler
  const commonEmojis = ['😀', '😂', '😍', '😊', '👍', '❤️', '🎉', '🙏', '😢', '🔥', '💯', '✨'];
  
  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Attachment handlers
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        setAttachments(prev => [...prev, ...result.assets]);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        setAttachments(prev => [...prev, ...result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || 'image.jpg',
          type: 'image',
        }))]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && attachments.length === 0) || sending) return;

    const messageContent = newMessage.trim();
    const tempId = `temp_${Date.now()}`;
    setSending(true);

    try {
      // Upload attachments first
      let uploadedAttachments: any[] = [];
      if (attachments.length > 0) {
        uploadedAttachments = await messagingService.uploadAttachments(attachments);
      }

      // Add temporary message for optimistic UI
      const tempMessage: Message = {
        _id: tempId,
        conversation: conversation._id,
        sender: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        content: messageContent,
        timestamp: new Date().toISOString(),
        readBy: [user._id],
        type: 'text',
        attachments: uploadedAttachments.map(att => att.url || att),
      };

      setMessages(prev => [...prev, tempMessage]);
      setNewMessage('');
      setAttachments([]);

      // Send message via Socket.io with attachments
      messagingService.sendMessage(conversation._id, messageContent, tempId, uploadedAttachments);

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    // Send typing indicator
    if (text.length > 0) {
      messagingService.startTyping(conversation._id);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        messagingService.stopTyping(conversation._id);
      }, 1000);
    } else {
      messagingService.stopTyping(conversation._id);
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    
    return (
      <View style={styles.typingContainer}>
        <View style={styles.typingBubble}>
          <Text style={styles.typingText}>
            {otherParticipant?.firstName} is typing...
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>
            {otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'Unknown'}
          </Text>
          <Text style={styles.headerRole}>
            {otherParticipant?.role === 'school_admin' ? 'School Admin' : otherParticipant?.role}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Ionicons name="call" size={20} color="white" />
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message, index) => {
          const isMe = message.sender._id === user._id;
          const showTime = index === messages.length - 1 || 
            new Date(message.timestamp).getTime() - new Date(messages[index + 1].timestamp).getTime() > 300000; // 5 minutes
          
          return (
            <View key={message._id}>
              <MessageBubble
                message={message}
                isMe={isMe}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
              />
              {showTime && (
                <Text style={styles.messageTime}>
                  {formatMessageTime(message.timestamp)}
                </Text>
              )}
            </View>
          );
        })}
        
        {renderTypingIndicator()}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <View style={styles.attachmentsPreview}>
            {attachments.map((attachment, index) => (
              <View key={index} style={styles.attachmentChip}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {attachment.name || 'File'}
                </Text>
                <TouchableOpacity
                  onPress={() => removeAttachment(index)}
                  style={styles.removeAttachment}
                >
                  <Ionicons name="close-circle" size={16} color="#999" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        
        <View style={styles.inputWrapper}>
          <TouchableOpacity
            onPress={handlePickImage}
            style={styles.actionButton}
          >
            <Ionicons name="image" size={24} color={primaryColor} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handlePickDocument}
            style={styles.actionButton}
          >
            <Ionicons name="document" size={24} color={primaryColor} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
            style={styles.actionButton}
          >
            <Ionicons name="happy" size={24} color={primaryColor} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: (newMessage.trim() || attachments.length > 0) ? primaryColor : '#ccc' }
            ]}
            onPress={handleSendMessage}
            disabled={(!newMessage.trim() && attachments.length === 0) || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="send" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <View style={styles.emojiPickerContainer}>
            <FlatList
              data={commonEmojis}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.emojiButton}
                  onPress={() => handleEmojiClick(item)}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              )}
              numColumns={6}
              keyExtractor={(item, index) => index.toString()}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRole: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  headerRight: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginVertical: 8,
  },
  typingContainer: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  typingBubble: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '80%',
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  inputContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f0f0f0',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  actionButton: {
    padding: 8,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  attachmentsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '45%',
  },
  attachmentName: {
    fontSize: 12,
    color: '#1976d2',
    flex: 1,
  },
  removeAttachment: {
    marginLeft: 8,
  },
  emojiPickerContainer: {
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingVertical: 8,
    maxHeight: 150,
  },
  emojiButton: {
    width: '16.66%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  emojiText: {
    fontSize: 24,
  },
});

export default ChatScreen;
