import { io, Socket } from 'socket.io-client';

interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  recipientId: string;
  recipientRole: string;
  recipientName: string;
  content: string;
  type: string;
  isRead: boolean;
  readAt?: Date;
  sentAt: Date;
  tempId?: string;
}

interface Conversation {
  _id: string;
  participants: Array<{
    userId: string;
    role: string;
    name: string;
    lastRead: Date;
  }>;
  subject: string;
  lastMessage?: {
    content: string;
    sentAt: Date;
    senderId: string;
    senderName: string;
  };
  unreadCount: number;
  otherParticipant?: {
    id: string;
    name: string;
    role: string;
    email: string;
  };
}

class MessagingService {
  private socket: Socket | null = null;
  private baseUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    // Socket.io connects to root URL, not /api endpoint
    let apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5050';
    // Remove /api suffix if present
    this.baseUrl = apiUrl.replace('/api', '');
  }

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // Socket.io Connection Management
  connect(token?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        const authToken = token || localStorage.getItem('token');
        
        if (!authToken) {
          reject(new Error('No authentication token found'));
          return;
        }

        // Disconnect existing socket if any
        if (this.socket && this.socket.connected) {
          this.socket.disconnect();
        }

        // Create new socket connection
        this.socket = io(this.baseUrl, {
          auth: {
            token: authToken
          },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 20000
        });

        this.socket.on('connect', () => {
          console.log('✅ Socket.io connected');
          this.reconnectAttempts = 0;
          resolve(this.socket!);
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Socket.io connection error:', error);
          this.reconnectAttempts++;
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(error);
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 Socket.io disconnected:', reason);
          
          if (reason === 'io server disconnect') {
            // Server initiated disconnect, try to reconnect manually
            setTimeout(() => this.socket?.connect(), 1000);
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`🔄 Socket.io reconnected after ${attemptNumber} attempts`);
          this.reconnectAttempts = 0;
        });

      } catch (error) {
        console.error('Error creating socket connection:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('🔌 Socket.io manually disconnected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // Event Listeners
  onNewMessage(callback: (message: Message) => void): void {
    this.socket?.on('new_message', callback);
  }

  onMessageRead(callback: (data: any) => void): void {
    this.socket?.on('messages_read', callback);
  }

  onTypingStart(callback: (data: any) => void): void {
    this.socket?.on('typing_start', callback);
  }

  onTypingStop(callback: (data: any) => void): void {
    this.socket?.on('typing_stop', callback);
  }

  onUserStatus(callback: (data: any) => void): void {
    this.socket?.on('user_status', callback);
  }

  onMessageError(callback: (error: any) => void): void {
    this.socket?.on('message_error', callback);
  }

  // Event Emitters
  joinConversation(conversationId: string): void {
    this.socket?.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId: string): void {
    this.socket?.emit('leave_conversation', conversationId);
  }

  sendMessage(conversationId: string, content: string, tempId: string, attachments?: any[]): void {
    this.socket?.emit('send_message', {
      conversationId,
      content,
      tempId,
      attachments: attachments || []
    });
  }

  async uploadAttachments(files: File[]): Promise<any[]> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(`${this.baseUrl}/api/messages/upload-attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to upload files');
      }
      
      return data.files || [];
    } catch (error) {
      console.error('Error uploading attachments:', error);
      throw error;
    }
  }

  startTyping(conversationId: string): void {
    this.socket?.emit('typing_start', { conversationId });
  }

  stopTyping(conversationId: string): void {
    this.socket?.emit('typing_stop', { conversationId });
  }

  markAsRead(conversationId: string): void {
    this.socket?.emit('mark_read', { conversationId });
  }

  // REST API Calls
  async getConversations(): Promise<{ success: boolean; data: Conversation[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/messages/conversations`, {
        headers: this.getHeaders()
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch conversations');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  async getConversationMessages(
    conversationId: string, 
    limit: number = 50, 
    before?: string
  ): Promise<{ success: boolean; data: Message[]; hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(before && { before })
      });

      const response = await fetch(
        `${this.baseUrl}/api/messages/conversation/${conversationId}?${params}`,
        { headers: this.getHeaders() }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch messages');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      throw error;
    }
  }

  async createConversation(
    recipientId: string, 
    initialMessage: string, 
    subject?: string,
    studentId?: string
  ): Promise<{ success: boolean; data: { conversation: Conversation; message: Message } }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/messages/conversation`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          recipientId,
          initialMessage,
          subject,
          studentId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create conversation');
      }
      
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async sendMessageREST(
    conversationId: string, 
    content: string
  ): Promise<{ success: boolean; data: Message }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/messages/send`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          conversationId,
          content
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message');
      }
      
      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async markConversationAsRead(
    conversationId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/messages/conversation/${conversationId}/read`,
        {
          method: 'PATCH',
          headers: this.getHeaders()
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to mark as read');
      }
      
      return data;
    } catch (error) {
      console.error('Error marking conversation as read:', error);
      throw error;
    }
  }

  async getUnreadCount(): Promise<{ success: boolean; data: { unreadCount: number; conversationsWithUnread: number } }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/messages/unread-count`, {
        headers: this.getHeaders()
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch unread count');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  // Cleanup
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.off('new_message');
      this.socket.off('messages_read');
      this.socket.off('typing_start');
      this.socket.off('typing_stop');
      this.socket.off('user_status');
      this.socket.off('message_error');
    }
  }
}

// Export singleton instance
const messagingService = new MessagingService();
export default messagingService;

