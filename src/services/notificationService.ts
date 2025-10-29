import apiService from './apiService';
import { requestFirebaseNotificationPermission, onMessageListener, areNotificationsSupported } from '../config/firebase';

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
  private fcmToken: string | null = null;
  private foregroundListenerUnsubscribe: (() => void) | null = null;

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

  /**
   * Initialize Firebase Cloud Messaging for push notifications
   * @param {Function} onNewNotification - Callback for foreground notifications
   * @returns {Promise<boolean>} Success status
   */
  async initializePushNotifications(onNewNotification?: (payload: any) => void): Promise<boolean> {
    try {
      if (!areNotificationsSupported()) {
        console.warn('Push notifications not supported in this browser');
        return false;
      }

      // Request permission and get FCM token
      const token = await requestFirebaseNotificationPermission();
      
      if (!token) {
        console.warn('Failed to get FCM token');
        return false;
      }

      this.fcmToken = token;

      // Register token with backend
      await this.registerFCMToken(token, 'web');

      // Listen for foreground messages
      if (onNewNotification) {
        this.foregroundListenerUnsubscribe = onMessageListener((payload) => {
          console.log('🔔 Foreground notification received:', payload);
          onNewNotification(payload);
        });
      }

      console.log('✅ Push notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      return false;
    }
  }

  /**
   * Register FCM token with backend
   * @param {string} token - FCM token
   * @param {string} device - Device type (web, ios, android)
   * @returns {Promise<boolean>} Success status
   */
  private async registerFCMToken(token: string, device: string = 'web'): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}${this.baseUrl}/fcm/register`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          token,
          device,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            appVersion: '1.0.0'
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ FCM token registered with backend');
      return true;
    } catch (error) {
      console.error('Error registering FCM token with backend:', error);
      return false;
    }
  }

  /**
   * Unregister FCM token from backend
   * @returns {Promise<boolean>} Success status
   */
  async unregisterFCMToken(): Promise<boolean> {
    try {
      if (!this.fcmToken) {
        return true; // Nothing to unregister
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}${this.baseUrl}/fcm/unregister`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({ token: this.fcmToken })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      this.fcmToken = null;
      console.log('✅ FCM token unregistered');
      return true;
    } catch (error) {
      console.error('Error unregistering FCM token:', error);
      return false;
    }
  }

  /**
   * Send test push notification
   * @returns {Promise<boolean>} Success status
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}${this.baseUrl}/fcm/test`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }

  /**
   * Cleanup on logout or component unmount
   */
  cleanup(): void {
    if (this.foregroundListenerUnsubscribe) {
      this.foregroundListenerUnsubscribe();
      this.foregroundListenerUnsubscribe = null;
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
