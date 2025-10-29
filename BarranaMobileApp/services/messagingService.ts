import { io, Socket } from 'socket.io-client';
import apiService from '../apiService';

export interface Conversation {
  _id: string;
  participants: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  }>;
  lastMessage?: {
    _id: string;
    content: string;
    sender: {
      _id: string;
      firstName: string;
      lastName: string;
    };
    timestamp: string;
  };
  lastMessageAt: string;
  subject?: string;
  unreadCount: Array<{
    user: string;
    count: number;
  }>;
}

export interface Message {
  _id: string;
  conversation: string;
  sender: {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  content: string;
  timestamp: string;
  readBy: string[];
  type: 'text' | 'notification' | 'announcement' | 'reminder';
  attachments?: string[];
}

class MessagingService {
  private socket: Socket | null = null;
  private baseUrl: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    // Socket.io connects to root URL, not /api endpoint
    let apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5050';
    // Remove /api suffix if present
    this.baseUrl = apiUrl.replace('/api', '');
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const token = apiService.getToken();
        if (!token) {
          throw new Error('No authentication token found');
        }

        console.log('🔌 Connecting to Socket.io:', this.baseUrl);

        this.socket = io(this.baseUrl, {
          auth: {
            token: token
          },
          transports: ['websocket'],
          timeout: 20000,
          forceNew: true
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket.io connected successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket.io connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 Socket.io disconnected:', reason);
          this.isConnected = false;
          
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, try to reconnect
            this.handleReconnect();
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log('🔄 Socket.io reconnected after', attemptNumber, 'attempts');
          this.isConnected = true;
          this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_error', (error) => {
          console.error('❌ Socket.io reconnection error:', error);
          this.handleReconnect();
        });

        this.socket.on('reconnect_failed', () => {
          console.error('❌ Socket.io reconnection failed after max attempts');
          this.isConnected = false;
        });

      } catch (error) {
        console.error('❌ Error initializing Socket.io:', error);
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        if (this.socket) {
          this.socket.connect();
        }
      }, 2000 * this.reconnectAttempts); // Exponential backoff
    }
  }

  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting Socket.io...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Conversation management
  async getConversations(): Promise<Conversation[]> {
    try {
      const response = await apiService.makeRequest<{ success: boolean; data: Conversation[] }>(
        '/messages/conversations'
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const response = await apiService.makeRequest<{ success: boolean; data: Message[] }>(
        `/messages/conversations/${conversationId}/messages`
      );
      return response.data || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  async markAsRead(conversationId: string): Promise<void> {
    try {
      await apiService.makeRequest(
        `/messages/conversations/${conversationId}/read`,
        {
          method: 'PATCH'
        }
      );
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Real-time messaging
  sendMessage(conversationId: string, content: string, tempId?: string, attachments?: any[]): void {
    if (!this.socket || !this.isConnected) {
      console.error('Socket not connected, cannot send message');
      return;
    }

    console.log('📤 Sending message:', { conversationId, content, tempId, attachments });
    this.socket.emit('send_message', {
      conversationId,
      content,
      tempId,
      attachments: attachments || []
    });
  }

  // File upload
  async uploadAttachments(attachments: any[]): Promise<any[]> {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Create FormData for React Native
      // FormData is a global in React Native
      const formData = new (global as any).FormData();

      attachments.forEach((attachment, index) => {
        // For React Native, we need to handle file URIs
        const fileUri = attachment.uri || attachment.path;
        const fileName = attachment.name || attachment.fileName || `file_${index}`;
        const fileType = attachment.mimeType || attachment.type || 'application/octet-stream';

        formData.append('files', {
          uri: fileUri,
          type: fileType,
          name: fileName,
        } as any);
      });

      const apiUrl = this.baseUrl.replace('/api', '');
      const response = await fetch(`${apiUrl}/api/messages/upload-attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - React Native will set it automatically with boundary
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload files');
      }

      console.log('✅ Files uploaded successfully:', data.files);
      return data.files || [];
    } catch (error: any) {
      console.error('❌ Error uploading attachments:', error);
      throw error;
    }
  }

  private async getToken(): Promise<string | null> {
    try {
      const SecureStore = require('expo-secure-store').default;
      return await SecureStore.getItemAsync('auth_token');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  // Event listeners
  onMessageReceived(callback: (data: { message: Message; tempId?: string }) => void): void {
    if (this.socket) {
      this.socket.on('receive_message', callback);
    }
  }

  onMessageError(callback: (data: { tempId?: string; error: string }) => void): void {
    if (this.socket) {
      this.socket.on('message_error', callback);
    }
  }

  onConversationUpdated(callback: (data: { conversation: Conversation }) => void): void {
    if (this.socket) {
      this.socket.on('conversation_updated', callback);
    }
  }

  onTypingStatus(callback: (data: { conversationId: string; userId: string; isTyping: boolean }) => void): void {
    if (this.socket) {
      this.socket.on('typing_status', callback);
    }
  }

  onMessagesRead(callback: (data: { conversationId: string; readerId: string }) => void): void {
    if (this.socket) {
      this.socket.on('messages_read', callback);
    }
  }

  // Typing indicators
  startTyping(conversationId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_start', { conversationId });
    }
  }

  stopTyping(conversationId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_stop', { conversationId });
    }
  }

  // Remove event listeners
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  removeListener(event: string, callback?: Function): void {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.removeAllListeners(event);
      }
    }
  }
}

export default new MessagingService();
