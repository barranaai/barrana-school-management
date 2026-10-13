import { apiService } from './apiService';

export interface AccountProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
}

const accountSettingsService = {
  getCurrentUser: () => apiService.getCurrentUser(),

  updateProfile: (profile: AccountProfileInput) =>
    apiService.makeRequest<any>('/auth/me/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }),

  updateNotifications: (notifications: NotificationPreferences) =>
    apiService.makeRequest<{ notifications: NotificationPreferences }>('/auth/me/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifications),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiService.makeRequest<void>('/auth/me/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export default accountSettingsService;
