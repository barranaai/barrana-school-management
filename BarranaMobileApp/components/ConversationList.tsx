import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../services/messagingService';

interface ConversationListProps {
  conversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
  currentUserId: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onConversationSelect,
  currentUserId,
  primaryColor = '#667eea',
  secondaryColor = '#764ba2',
}) => {
  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find(p => p._id !== currentUserId);
  };

  const getUnreadCount = (conversation: Conversation) => {
    const unreadData = conversation.unreadCount.find(uc => uc.user === currentUserId);
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

  const renderConversation = ({ item: conversation }: { item: Conversation }) => {
    const otherParticipant = getOtherParticipant(conversation);
    const unreadCount = getUnreadCount(conversation);
    
    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => onConversationSelect(conversation)}
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
  };

  return (
    <FlatList
      data={conversations}
      renderItem={renderConversation}
      keyExtractor={(item) => item._id}
      style={styles.container}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

export default ConversationList;
