import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../services/messagingService';

interface MessageBubbleProps {
  message: Message;
  isMe: boolean;
  primaryColor?: string;
  secondaryColor?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  primaryColor = '#667eea',
  secondaryColor = '#764ba2',
}) => {
  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'notification':
        return 'notifications';
      case 'announcement':
        return 'megaphone';
      case 'reminder':
        return 'time';
      default:
        return null;
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'notification':
        return '#FF9800';
      case 'announcement':
        return '#4CAF50';
      case 'reminder':
        return '#2196F3';
      default:
        return primaryColor;
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageContent = () => {
    if (message.type === 'text') {
      return (
        <Text style={[
          styles.messageText,
          { color: isMe ? 'white' : '#333' }
        ]}>
          {message.content}
        </Text>
      );
    }

    // Special message types
    const iconName = getMessageTypeIcon(message.type);
    const typeColor = getMessageTypeColor(message.type);
    
    return (
      <View style={styles.specialMessage}>
        {iconName && (
          <Ionicons 
            name={iconName as any} 
            size={16} 
            color={typeColor} 
            style={styles.messageIcon}
          />
        )}
        <Text style={[
          styles.messageText,
          { color: isMe ? 'white' : '#333' }
        ]}>
          {message.content}
        </Text>
      </View>
    );
  };

  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) {
      return null;
    }

    // Handle both URL strings and attachment objects
    const attachmentList = message.attachments.map((att: any) => {
      if (typeof att === 'string') {
        return { url: att, originalName: 'File', mimeType: 'application/octet-stream' };
      }
      return att;
    });

    return (
      <View style={styles.attachmentsContainer}>
        {attachmentList.map((attachment: any, index: number) => {
          const attachmentUrl = attachment.url || attachment;
          const fileName = attachment.originalName || attachment.name || `File ${index + 1}`;
          const isImage = attachment.mimeType?.startsWith('image/') || 
                         fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
          const isPdf = attachment.mimeType === 'application/pdf' || 
                       fileName.match(/\.(pdf)$/i);
          
          return (
            <TouchableOpacity
              key={index}
              style={styles.attachmentItem}
              onPress={() => {
                // Handle attachment tap - open URL
                const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5050';
                const fullUrl = attachmentUrl.startsWith('http') 
                  ? attachmentUrl 
                  : `${baseUrl.replace('/api', '')}${attachmentUrl}`;
                console.log('Opening attachment:', fullUrl);
                // In a real app, you might use Linking.openURL or a WebView
              }}
            >
              <Ionicons 
                name={isImage ? 'image' : isPdf ? 'document-text' : 'document'} 
                size={16} 
                color={isMe ? 'white' : primaryColor} 
              />
              <Text 
                style={[
                  styles.attachmentText,
                  { color: isMe ? 'white' : primaryColor }
                ]}
                numberOfLines={1}
              >
                {fileName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[
      styles.messageContainer,
      isMe ? styles.messageContainerRight : styles.messageContainerLeft
    ]}>
      <View style={[
        styles.messageBubble,
        {
          backgroundColor: isMe ? primaryColor : 'white',
          borderBottomLeftRadius: isMe ? 18 : 4,
          borderBottomRightRadius: isMe ? 4 : 18,
        }
      ]}>
        {renderMessageContent()}
        {renderAttachments()}
        
        <View style={styles.messageFooter}>
          <Text style={[
            styles.messageTime,
            { color: isMe ? 'rgba(255, 255, 255, 0.7)' : '#999' }
          ]}>
            {formatMessageTime(message.timestamp)}
          </Text>
          
          {isMe && (
            <View style={styles.readStatus}>
              {message.readBy.length > 1 ? (
                <Ionicons name="checkmark-done" size={12} color="rgba(255, 255, 255, 0.7)" />
              ) : (
                <Ionicons name="checkmark" size={12} color="rgba(255, 255, 255, 0.7)" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginVertical: 2,
    paddingHorizontal: 16,
  },
  messageContainerLeft: {
    alignItems: 'flex-start',
  },
  messageContainerRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  specialMessage: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageIcon: {
    marginRight: 8,
  },
  attachmentsContainer: {
    marginTop: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  attachmentText: {
    fontSize: 14,
    marginLeft: 8,
    textDecorationLine: 'underline',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
  },
  readStatus: {
    marginLeft: 4,
  },
});

export default MessageBubble;
