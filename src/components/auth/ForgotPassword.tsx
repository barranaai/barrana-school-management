import React, { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PasswordRecoveryLayout from './PasswordRecoveryLayout';
import { PasswordRecoveryError, passwordRecoveryService } from '../../services/passwordRecoveryService';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await passwordRecoveryService.forgotPassword(email); setNotice('If an account with that email exists, a password reset link has been sent.'); }
    catch (reason) {
      const code = reason instanceof PasswordRecoveryError ? reason.code : 'REQUEST_FAILED';
      setError(code === 'DELIVERY_UNAVAILABLE' ? 'Password reset email is currently unavailable. Contact your administrator.' : code === 'RATE_LIMITED' ? 'Too many requests. Please wait and try again.' : 'Unable to request a password reset. Please try again.');
    } finally { setBusy(false); }
  }
  return <PasswordRecoveryLayout title="Reset your password"><Stack component="form" spacing={2} onSubmit={submit}>
    <Typography>Enter your account email. For privacy, the result is the same whether or not the address is registered.</Typography>
    {notice && <Alert severity="success">{notice}</Alert>}{error && <Alert severity="error">{error}</Alert>}
    <TextField label="Email" type="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
    <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Requesting…' : 'Send reset link'}</Button>
    <Button onClick={() => navigate('/login')} disabled={busy}>Back to sign in</Button>
  </Stack></PasswordRecoveryLayout>;
}
