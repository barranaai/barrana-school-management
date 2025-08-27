import apiService from './apiService';

export interface Notification {
  id: string;
  type: 'report_approval' | 'due_report' | 'system' | 'general';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  data?: any;
}

export interface NotificationResponse {
  success: boolean;
  data: Notification[];
  message?: string;
  error?: string;
}

class NotificationService {
  private baseUrl = '/communication';

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async getNotifications(): Promise<NotificationResponse> {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}${this.baseUrl}/notifications`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}${this.baseUrl}/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const notifications = await this.getNotifications();
      const unreadNotifications = notifications.data.filter(n => !n.isRead);
      
      // Mark all unread notifications as read
      const promises = unreadNotifications.map(n => this.markAsRead(n.id));
      await Promise.all(promises);

      return { success: true, message: 'All notifications marked as read' };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  getUnreadCount(notifications: Notification[]): number {
    return notifications.filter(n => !n.isRead).length;
  }

  formatNotificationTime(timestamp: string): string {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - notificationTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return notificationTime.toLocaleDateString();
  }
}

const notificationService = new NotificationService();
export default notificationService;
