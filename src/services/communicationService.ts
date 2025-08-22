import axios from 'axios';

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  subject: string;
  content: string;
  attachments?: string[];
  status: 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
  readAt?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'report' | 'message' | 'system' | 'alert';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
  category: 'report' | 'notification' | 'announcement' | 'reminder';
}

export interface CommunicationStats {
  totalMessages: number;
  unreadMessages: number;
  totalNotifications: number;
  unreadNotifications: number;
  emailDeliveryRate: number;
  averageResponseTime: number;
}

class CommunicationService {
  private baseURL = 'http://localhost:5050/api';

  // Send message
  async sendMessage(message: Omit<Message, 'id' | 'status' | 'createdAt'>): Promise<Message> {
    try {
      const response = await axios.post(`${this.baseURL}/communication/messages`, {
        ...message,
        timestamp: new Date().toISOString()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Get messages
  async getMessages(filters: {
    userId?: string;
    conversationId?: string;
    unreadOnly?: boolean;
    limit?: number;
  } = {}): Promise<Message[]> {
    try {
      const response = await axios.get(`${this.baseURL}/communication/messages`, {
        params: filters
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Mark message as read
  async markMessageAsRead(messageId: string): Promise<void> {
    try {
      await axios.patch(`${this.baseURL}/communication/messages/${messageId}/read`);
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw new Error('Failed to mark message as read');
    }
  }

  // Get notifications
  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    try {
      const response = await axios.get(`${this.baseURL}/communication/notifications`, {
        params: { userId, unreadOnly }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await axios.patch(`${this.baseURL}/communication/notifications/${notificationId}/read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw new Error('Failed to mark notification as read');
    }
  }

  // Send email
  async sendEmail(template: string, recipients: string[], data: any = {}): Promise<{
    success: boolean;
    messageId: string;
    deliveredCount: number;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/communication/email`, {
        template,
        recipients,
        data,
        timestamp: new Date().toISOString()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  // Get email templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    try {
      const response = await axios.get(`${this.baseURL}/communication/email-templates`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching email templates:', error);
      return [];
    }
  }

  // Create email template
  async createEmailTemplate(template: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> {
    try {
      const response = await axios.post(`${this.baseURL}/communication/email-templates`, template);
      return response.data.data;
    } catch (error) {
      console.error('Error creating email template:', error);
      throw new Error('Failed to create email template');
    }
  }

  // Get communication statistics
  async getCommunicationStats(userId: string): Promise<CommunicationStats> {
    try {
      const response = await axios.get(`${this.baseURL}/communication/stats`, {
        params: { userId }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching communication stats:', error);
      return {
        totalMessages: 0,
        unreadMessages: 0,
        totalNotifications: 0,
        unreadNotifications: 0,
        emailDeliveryRate: 0,
        averageResponseTime: 0
      };
    }
  }

  // Send bulk notification
  async sendBulkNotification(
    recipients: string[],
    notification: Omit<Notification, 'id' | 'userId' | 'isRead' | 'createdAt'>
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/communication/bulk-notification`, {
        recipients,
        notification,
        timestamp: new Date().toISOString()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error sending bulk notification:', error);
      throw new Error('Failed to send bulk notification');
    }
  }

  // Send notification to school admins for report approval
  async sendReportApprovalNotification(
    schoolId: string,
    reportData: {
      reportId: string;
      studentName: string;
      teacherName: string;
      reportTitle: string;
      createdAt: string;
    }
  ): Promise<{
    success: boolean;
    sentCount: number;
    failedCount: number;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/communication/report-approval-notification`, {
        schoolId,
        reportData,
        timestamp: new Date().toISOString()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error sending report approval notification:', error);
      throw new Error('Failed to send report approval notification');
    }
  }

  // Get conversation history
  async getConversationHistory(participant1: string, participant2: string): Promise<Message[]> {
    try {
      const response = await axios.get(`${this.baseURL}/communication/conversation`, {
        params: { participant1, participant2 }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      throw new Error('Failed to fetch conversation history');
    }
  }

  // Delete message
  async deleteMessage(messageId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/communication/messages/${messageId}`);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw new Error('Failed to delete message');
    }
  }

  // Get real-time updates (WebSocket simulation)
  async subscribeToUpdates(userId: string, callback: (update: any) => void): Promise<() => void> {
    // In a real implementation, this would use WebSocket
    // For now, we'll simulate with polling
    const interval = setInterval(async () => {
      try {
        const notifications = await this.getNotifications(userId, true);
        if (notifications.length > 0) {
          callback({ type: 'notification', data: notifications });
        }
      } catch (error) {
        console.error('Error polling for updates:', error);
      }
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }
}

export const communicationService = new CommunicationService();
export default communicationService; 