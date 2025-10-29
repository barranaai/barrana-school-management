import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import messagingService, { Conversation } from '../services/messagingService';
import ConversationList from '../components/ConversationList';
import ChatScreen from '../components/ChatScreen';

interface CommunicationScreenProps {
  user: any;
  branding?: any;
}

const { width: screenWidth } = Dimensions.get('window');

const CommunicationScreen: React.FC<CommunicationScreenProps> = ({ 
  user, 
  branding 
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';

  useEffect(() => {
    initializeMessaging();
    return () => {
      // Cleanup on unmount
      messagingService.removeAllListeners();
    };
  }, []);

  const initializeMessaging = async () => {
    try {
      setLoading(true);
      setConnectionError(null);
      setConnectionStatus('connecting');
      
      console.log('🔄 Connecting to messaging service...');
      
      // Connect to Socket.io
      await messagingService.connect();
      console.log('✅ Messaging service connected');
      setConnectionStatus('connected');
      
      // Set up event listeners
      setupEventListeners();
      
      // Load initial conversations
      await loadConversations();
      
    } catch (error: any) {
      console.error('❌ Error initializing messaging:', error);
      setConnectionError(error?.message || 'Failed to connect to messaging service');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    // Listen for new messages
    messagingService.onMessageReceived(({ message, tempId }) => {
      console.log('📨 Message received:', message);
      
      // Update conversations list
      setConversations(prev => {
        return prev.map(conv => {
          if (conv._id === message.conversation) {
            return {
              ...conv,
              lastMessage: {
                _id: message._id,
                content: message.content,
                sender: message.sender,
                timestamp: message.timestamp
              },
              lastMessageAt: message.timestamp
            };
          }
          return conv;
        });
      });
    });

    // Listen for conversation updates
    messagingService.onConversationUpdated(({ conversation }) => {
      console.log('🔄 Conversation updated:', conversation);
      setConversations(prev => {
        const existingIndex = prev.findIndex(c => c._id === conversation._id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = conversation;
          return updated;
        } else {
          return [conversation, ...prev];
        }
      });
    });

    // Listen for typing status
    messagingService.onTypingStatus(({ conversationId, userId, isTyping }) => {
      console.log('⌨️ Typing status:', { conversationId, userId, isTyping });
      // Handle typing indicators if needed
    });

    // Listen for read receipts
    messagingService.onMessagesRead(({ conversationId, readerId }) => {
      console.log('👁️ Messages read:', { conversationId, readerId });
      // Update unread counts if needed
    });
  };

  const loadConversations = async () => {
    try {
      const data = await messagingService.getConversations();
      setConversations(data);
      console.log('📋 Loaded conversations:', data.length);
    } catch (error) {
      console.error('Error loading conversations:', error);
      Alert.alert('Error', 'Failed to load conversations');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  const handleRetryConnection = () => {
    initializeMessaging();
  };

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(p => p._id !== user._id);
  };

  const getUnreadCount = (conversation: Conversation) => {
    const unreadData = conversation.unreadCount.find(uc => uc.user === user._id);
    return unreadData?.count || 0;
  };

  const formatLastMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Connecting to messaging service...</Text>
      </View>
    );
  }

  if (connectionError) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="chatbubbles-outline" size={64} color="#999" />
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMessage}>{connectionError}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: primaryColor }]}
          onPress={handleRetryConnection}
        >
          <Text style={styles.retryButtonText}>Retry Connection</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (selectedConversation) {
    return (
      <ChatScreen
        conversation={selectedConversation}
        user={user}
        branding={branding}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Messages</Text>
          <View style={styles.headerRight}>
            <View style={[
              styles.connectionIndicator, 
              { backgroundColor: connectionStatus === 'connected' ? '#4CAF50' : '#FF9800' }
            ]} />
            <Text style={styles.connectionText}>
              {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
            </Text>
          </View>
        </View>
      </View>

      {/* Conversations List */}
      <ScrollView
        style={styles.conversationsContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primaryColor]}
            tintColor={primaryColor}
          />
        }
      >
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#999" />
            <Text style={styles.emptyTitle}>No Messages Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your conversations with school administrators will appear here.
            </Text>
          </View>
        ) : (
          conversations.map((conversation) => {
            const otherParticipant = getOtherParticipant(conversation);
            const unreadCount = getUnreadCount(conversation);
            
            return (
              <TouchableOpacity
                key={conversation._id}
                style={styles.conversationItem}
                onPress={() => handleConversationSelect(conversation)}
                activeOpacity={0.7}
              >
                <View style={styles.conversationContent}>
                  <View style={styles.conversationLeft}>
                    <View style={[styles.avatar, { backgroundColor: secondaryColor }]}>
                      <Text style={styles.avatarText}>
                        {otherParticipant?.firstName?.[0]?.toUpperCase() || 'A'}
                      </Text>
                    </View>
                    <View style={styles.conversationInfo}>
                      <Text style={styles.conversationName}>
                        {otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'Unknown'}
                      </Text>
                      <Text style={styles.conversationRole}>
                        {otherParticipant?.role === 'school_admin' ? 'School Admin' : otherParticipant?.role}
                      </Text>
                      {conversation.lastMessage && (
                        <Text style={styles.lastMessage} numberOfLines={1}>
                          {conversation.lastMessage.content}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.conversationRight}>
                    {conversation.lastMessage && (
                      <Text style={styles.lastMessageTime}>
                        {formatLastMessageTime(conversation.lastMessageAt)}
                      </Text>
                    )}
                    {unreadCount > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: primaryColor }]}>
                        <Text style={styles.unreadText}>{unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  conversationsContainer: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  conversationItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  conversationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  conversationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  conversationRole: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  conversationRight: {
    alignItems: 'flex-end',
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default CommunicationScreen;
