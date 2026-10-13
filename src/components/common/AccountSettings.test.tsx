import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import AccountSettings from './AccountSettings';
import accountSettingsService from '../../services/accountSettingsService';

const mockUpdateUser = jest.fn();
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { preferences: { language: 'en', timezone: 'UTC', notifications: { email: true, push: true, sms: false } } },
    updateUser: mockUpdateUser,
  }),
}));
jest.mock('../../services/accountSettingsService', () => ({
  __esModule: true,
  default: {
    getCurrentUser: jest.fn(), updateProfile: jest.fn(), updateNotifications: jest.fn(), changePassword: jest.fn(),
  },
}));

const service = accountSettingsService as jest.Mocked<typeof accountSettingsService>;
let host: HTMLDivElement;
let root: Root;
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const input = (text: string) => {
  const label = Array.from(document.querySelectorAll('label')).find(element => element.textContent?.includes(text));
  return document.getElementById(label?.htmlFor || '') as HTMLInputElement;
};
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(element => element.textContent === text)!;

beforeEach(() => {
  jest.clearAllMocks();
  service.getCurrentUser.mockResolvedValue({
    success: true,
    data: { user: { firstName: 'Taylor', lastName: 'Teacher', email: 'teacher@example.invalid', phone: '+12345678901', address: 'Home', preferences: { notifications: { email: true, push: true, sms: false, whatsapp: false } } } } as any,
  });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

test('loads account data and saves only editable profile fields', async () => {
  service.updateProfile.mockResolvedValue({
    success: true,
    data: {
      firstName: 'Authoritative', lastName: 'Name', email: 'teacher@example.invalid',
      phone: '+10987654321', address: 'Saved address',
    } as any,
  });
  root.render(<AccountSettings />); await settle();
  expect(input('First name')).toHaveValue('Taylor');
  expect(input('Email')).toBeDisabled();
  await act(async () => { Simulate.change(input('First name'), { target: { value: 'Updated' } }); });
  await act(async () => { Simulate.click(button('Save profile')); }); await settle();
  expect(service.updateProfile).toHaveBeenCalledWith({ firstName: 'Updated', lastName: 'Teacher', phone: '+12345678901', address: 'Home' });
  expect(mockUpdateUser).toHaveBeenCalledWith({
    firstName: 'Authoritative', lastName: 'Name', phone: '+10987654321', address: 'Saved address',
  });
  expect(input('First name')).toHaveValue('Authoritative');
  expect(input('Phone')).toHaveValue('+10987654321');
  expect(input('Address')).toHaveValue('Saved address');
  expect(document.body).toHaveTextContent('Profile updated.');
});

test('updates supported notifications in AuthContext', async () => {
  service.updateNotifications.mockResolvedValue({ success: true, data: { notifications: { email: true, push: true, sms: false, whatsapp: false } } });
  root.render(<AccountSettings />); await settle();
  await act(async () => { Simulate.click(button('Save notifications')); }); await settle();
  expect(mockUpdateUser).toHaveBeenCalledWith({
    preferences: {
      language: 'en', timezone: 'UTC',
      notifications: { email: true, push: true, sms: false, whatsapp: false },
    },
  });
  expect(document.body).toHaveTextContent('Notification preferences updated.');
});

test('shows notification update failures', async () => {
  service.updateNotifications.mockResolvedValue({ success: false, error: 'Could not save preferences' });
  root.render(<AccountSettings />); await settle();
  await act(async () => { Simulate.click(button('Save notifications')); }); await settle();
  expect(document.body).toHaveTextContent('Could not save preferences');
  expect(mockUpdateUser).not.toHaveBeenCalled();
});

test('validates password confirmation before calling the backend', async () => {
  root.render(<AccountSettings />); await settle();
  await act(async () => {
    Simulate.change(input('Current password'), { target: { value: 'current-password' } });
    Simulate.change(input('New password'), { target: { value: 'new-password-123' } });
    Simulate.change(input('Confirm new password'), { target: { value: 'different-password' } });
  });
  await act(async () => { Simulate.click(button('Change password')); });
  expect(document.body).toHaveTextContent('The new passwords do not match.');
  expect(service.changePassword).not.toHaveBeenCalled();
});

test('changes the password successfully and clears password fields', async () => {
  service.changePassword.mockResolvedValue({ success: true });
  root.render(<AccountSettings />); await settle();
  await act(async () => {
    Simulate.change(input('Current password'), { target: { value: 'current-password' } });
    Simulate.change(input('New password'), { target: { value: 'new-password-123' } });
    Simulate.change(input('Confirm new password'), { target: { value: 'new-password-123' } });
  });
  await act(async () => { Simulate.click(button('Change password')); }); await settle();
  expect(service.changePassword).toHaveBeenCalledWith('current-password', 'new-password-123');
  expect(document.body).toHaveTextContent('Password changed successfully.');
  expect(input('Current password')).toHaveValue('');
  expect(input('New password')).toHaveValue('');
});

test('shows wrong-current-password feedback returned by the backend', async () => {
  service.changePassword.mockResolvedValue({ success: false, error: 'Current password is incorrect' });
  root.render(<AccountSettings />); await settle();
  await act(async () => {
    Simulate.change(input('Current password'), { target: { value: 'wrong-password' } });
    Simulate.change(input('New password'), { target: { value: 'new-password-123' } });
    Simulate.change(input('Confirm new password'), { target: { value: 'new-password-123' } });
  });
  await act(async () => { Simulate.click(button('Change password')); }); await settle();
  expect(document.body).toHaveTextContent('Current password is incorrect');
});

test('shows an initial settings-load failure', async () => {
  service.getCurrentUser.mockResolvedValue({ success: false, error: 'Unable to load account settings' });
  root.render(<AccountSettings />); await settle();
  expect(document.body).toHaveTextContent('Unable to load account settings');
});
