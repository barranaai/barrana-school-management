import React, { useEffect, useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PasswordRecoveryLayout from './PasswordRecoveryLayout';
import { PasswordRecoveryError, passwordRecoveryService } from '../../services/passwordRecoveryService';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [success, setSuccess] = useState(false); const [error, setError] = useState('');
  useEffect(() => { window.history.replaceState({}, document.title, '/reset-password'); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!token) return setError('This password reset link is invalid or has expired. Request a new link.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try { await passwordRecoveryService.resetPassword(token, password); setPassword(''); setConfirm(''); setSuccess(true); }
    catch (reason) {
      const code = reason instanceof PasswordRecoveryError ? reason.code : 'REQUEST_FAILED';
      setError(code === 'INVALID_OR_EXPIRED' ? 'This password reset link is invalid or has expired. Request a new link.' : code === 'RATE_LIMITED' ? 'Too many requests. Please wait and try again.' : 'Unable to reset the password. Please try again.');
    } finally { setBusy(false); }
  }
  return <PasswordRecoveryLayout title="Choose a new password">{success ? <Stack spacing={2}><Alert severity="success">Your password has been reset successfully.</Alert><Button variant="contained" onClick={() => navigate('/login')}>Sign in</Button></Stack> : <Stack component="form" spacing={2} onSubmit={submit}>
    <Typography>Use at least eight characters. The reset link can be used only once.</Typography>{error && <Alert severity="error">{error}</Alert>}
    <TextField label="New password" type="password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
    <TextField label="Confirm new password" type="password" required value={confirm} onChange={event => setConfirm(event.target.value)} disabled={busy} />
    <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Resetting…' : 'Reset password'}</Button><Button onClick={() => navigate('/forgot-password')} disabled={busy}>Request a new link</Button>
  </Stack>}</PasswordRecoveryLayout>;
}
