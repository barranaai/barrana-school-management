import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
  FormControlLabel, Grid, Switch, TextField, Typography,
} from '@mui/material';
import Lock from '@mui/icons-material/Lock';
import Notifications from '@mui/icons-material/Notifications';
import Person from '@mui/icons-material/Person';
import { useAuth } from '../../contexts/AuthContext';
import accountSettingsService, { NotificationPreferences } from '../../services/accountSettingsService';

const defaultNotifications: NotificationPreferences = {
  email: true,
  push: true,
  sms: false,
  whatsapp: false,
};

const messageFrom = (response: any, fallback: string) =>
  response?.error || response?.message || fallback;

const AccountSettings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; text: string } | null>(null);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '' });
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    let active = true;
    accountSettingsService.getCurrentUser().then(response => {
      if (!active) return;
      const loaded: any = response.data && ((response.data as any).user || response.data);
      if (!response.success || !loaded) throw new Error(messageFrom(response, 'Unable to load account settings'));
      setProfile({
        firstName: loaded.firstName || '', lastName: loaded.lastName || '', email: loaded.email || '',
        phone: loaded.phone || '', address: loaded.address || '',
      });
      setNotifications({ ...defaultNotifications, ...(loaded.preferences?.notifications || {}) });
    }).catch(error => active && setFeedback({ severity: 'error', text: error.message || 'Unable to load account settings' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const saveProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      return setFeedback({ severity: 'error', text: 'First name and last name are required.' });
    }
    if (profile.phone && !/^\+[1-9]\d{7,14}$/.test(profile.phone)) {
      return setFeedback({ severity: 'error', text: 'Use an international phone number such as +1234567890.' });
    }
    setSaving('profile'); setFeedback(null);
    const response = await accountSettingsService.updateProfile({
      firstName: profile.firstName.trim(), lastName: profile.lastName.trim(),
      phone: profile.phone.trim(), address: profile.address.trim(),
    });
    setSaving(null);
    if (!response.success) return setFeedback({ severity: 'error', text: messageFrom(response, 'Unable to update profile') });
    const updated: any = response.data && ((response.data as any).user || response.data);
    if (!updated) return setFeedback({ severity: 'error', text: 'Unable to update profile' });
    const authoritativeProfile = {
      firstName: updated.firstName || '',
      lastName: updated.lastName || '',
      phone: updated.phone || '',
      address: updated.address || '',
    };
    setProfile(current => ({ ...current, ...authoritativeProfile }));
    updateUser(authoritativeProfile);
    setFeedback({ severity: 'success', text: 'Profile updated.' });
  };

  const saveNotifications = async () => {
    setSaving('notifications'); setFeedback(null);
    const response = await accountSettingsService.updateNotifications(notifications);
    setSaving(null);
    if (!response.success) return setFeedback({ severity: 'error', text: messageFrom(response, 'Unable to update notifications') });
    updateUser({ preferences: { ...(user?.preferences || {}), notifications } as any });
    setFeedback({ severity: 'success', text: 'Notification preferences updated.' });
  };

  const changePassword = async () => {
    if (passwords.next.length < 8) return setFeedback({ severity: 'error', text: 'The new password must contain at least 8 characters.' });
    if (passwords.next !== passwords.confirm) return setFeedback({ severity: 'error', text: 'The new passwords do not match.' });
    setSaving('password'); setFeedback(null);
    const response = await accountSettingsService.changePassword(passwords.current, passwords.next);
    setSaving(null);
    if (!response.success) return setFeedback({ severity: 'error', text: messageFrom(response, 'Unable to change password') });
    setPasswords({ current: '', next: '', confirm: '' });
    setFeedback({ severity: 'success', text: 'Password changed successfully.' });
  };

  if (loading) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress aria-label="Loading account settings" /></Box>;

  return <Box sx={{ maxWidth: 900 }}>
    {feedback && <Alert severity={feedback.severity} sx={{ mb: 2 }}>{feedback.text}</Alert>}
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card><CardContent>
          <Typography variant="h6" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Person /> Profile</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Update your own contact information. Your email, role and organization are managed by an administrator.</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField fullWidth label="First name" value={profile.firstName} onChange={e => setProfile(v => ({ ...v, firstName: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Last name" value={profile.lastName} onChange={e => setProfile(v => ({ ...v, lastName: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Email" value={profile.email} disabled helperText="Contact an administrator to change your sign-in email." /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" value={profile.phone} placeholder="+1234567890" onChange={e => setProfile(v => ({ ...v, phone: e.target.value }))} /></Grid>
            <Grid item xs={12}><TextField fullWidth label="Address" value={profile.address} onChange={e => setProfile(v => ({ ...v, address: e.target.value }))} /></Grid>
          </Grid>
          <Button sx={{ mt: 2 }} variant="contained" onClick={saveProfile} disabled={saving === 'profile'}>{saving === 'profile' ? 'Saving…' : 'Save profile'}</Button>
        </CardContent></Card>
      </Grid>
      <Grid item xs={12}>
        <Card><CardContent>
          <Typography variant="h6" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Notifications /> Notifications</Typography>
          <Typography color="text.secondary">Choose the delivery channels Kidsible already supports for your account.</Typography>
          <Divider sx={{ my: 2 }} />
          {(['email', 'push', 'sms', 'whatsapp'] as const).map(channel =>
            <FormControlLabel key={channel} control={<Switch checked={notifications[channel]} onChange={e => setNotifications(v => ({ ...v, [channel]: e.target.checked }))} />} label={channel === 'whatsapp' ? 'WhatsApp notifications' : `${channel[0].toUpperCase()}${channel.slice(1)} notifications`} />
          )}
          <Box><Button variant="contained" onClick={saveNotifications} disabled={saving === 'notifications'}>{saving === 'notifications' ? 'Saving…' : 'Save notifications'}</Button></Box>
        </CardContent></Card>
      </Grid>
      <Grid item xs={12}>
        <Card><CardContent>
          <Typography variant="h6" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}><Lock /> Account security</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Confirm your current password before choosing a new one.</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}><TextField fullWidth type="password" label="Current password" autoComplete="current-password" value={passwords.current} onChange={e => setPasswords(v => ({ ...v, current: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="password" label="New password" autoComplete="new-password" value={passwords.next} onChange={e => setPasswords(v => ({ ...v, next: e.target.value }))} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth type="password" label="Confirm new password" autoComplete="new-password" value={passwords.confirm} onChange={e => setPasswords(v => ({ ...v, confirm: e.target.value }))} /></Grid>
          </Grid>
          <Button sx={{ mt: 2 }} variant="contained" onClick={changePassword} disabled={saving === 'password' || !passwords.current}>{saving === 'password' ? 'Changing…' : 'Change password'}</Button>
        </CardContent></Card>
      </Grid>
    </Grid>
  </Box>;
};

export default AccountSettings;
