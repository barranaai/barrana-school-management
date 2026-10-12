import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItemButton, ListItemText, MenuItem, Paper, Select, TextField, Typography } from '@mui/material';
import { Send } from '@mui/icons-material';
import messagingService, { Conversation, Message, TeacherCommunicationRecipient } from '../../../services/messagingService';

export interface CommunicationCenterProps { schoolBranding?: any }

const CommunicationCenter: React.FC<CommunicationCenterProps> = ({ schoolBranding }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recipients, setRecipients] = useState<TeacherCommunicationRecipient[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [recipientKey, setRecipientKey] = useState('');
  const [subject, setSubject] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [conversationResult, recipientResult] = await Promise.all([messagingService.getConversations(), messagingService.getTeacherRecipients()]);
      setConversations(conversationResult.data || []); setRecipients(recipientResult.data || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load communication'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openConversation = async (conversation: Conversation) => {
    setSelected(conversation); setError('');
    try {
      const result = await messagingService.getConversationMessages(conversation._id);
      setMessages(result.data || []); await messagingService.markConversationAsRead(conversation._id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load messages'); }
  };

  const send = async () => {
    if (!selected || !message.trim()) return;
    setSending(true); setError('');
    try {
      const result = await messagingService.sendMessageREST(selected._id, message.trim());
      setMessages(current => [...current, result.data]); setMessage(''); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Message could not be sent'); }
    finally { setSending(false); }
  };

  const startConversation = async () => {
    const recipient = recipients.find(item => `${item.guardianId}:${item.participantId}` === recipientKey);
    if (!recipient || !message.trim()) return;
    setSending(true); setError('');
    try {
      const result = await messagingService.createConversation(recipient.guardianId, message.trim(), subject.trim() || `About ${recipient.participantName}`, recipient.participantId);
      setComposeOpen(false); setMessage(''); setSubject(''); setRecipientKey(''); await load(); await openConversation(result.data.conversation);
    } catch (err) { setError(err instanceof Error ? err.message : 'Conversation could not be started'); }
    finally { setSending(false); }
  };

  const primary = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';
  return <Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Box><Typography variant="h4" fontWeight={700} color={primary}>Communication</Typography><Typography color="text.secondary">Messages with authorized parents and guardians</Typography></Box>
      <Button variant="contained" onClick={() => { setSelected(null); setMessages([]); setMessage(''); setComposeOpen(true); }} disabled={!recipients.length}>New message</Button>
    </Box>
    {error && <Alert severity="error" action={<Button color="inherit" onClick={() => void load()}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
    {loading ? <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /><Typography>Loading communication…</Typography></Box> :
      <Paper sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, minHeight: 460, overflow: 'hidden' }}>
        <Box sx={{ borderRight: { md: '1px solid' }, borderColor: 'divider' }}><Typography fontWeight={700} sx={{ p: 2 }}>Conversations</Typography><Divider />
          {!conversations.length ? <Typography color="text.secondary" sx={{ p: 3 }}>No conversations yet.</Typography> : <List>{conversations.map(item => <ListItemButton key={item._id} selected={selected?._id === item._id} onClick={() => void openConversation(item)}><ListItemText primary={item.otherParticipant?.name || 'Guardian'} secondary={item.subject || item.lastMessage?.content} />{item.unreadCount > 0 && <Typography aria-label={`${item.unreadCount} unread`} color="primary">{item.unreadCount}</Typography>}</ListItemButton>)}</List>}
        </Box>
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
          {!selected ? <Typography color="text.secondary" sx={{ m: 'auto' }}>Select a conversation or start a new message.</Typography> : <><Typography variant="h6">{selected.otherParticipant?.name || 'Guardian'}</Typography><Typography variant="caption" color="text.secondary">{selected.subject}</Typography><Divider sx={{ my: 2 }} /><Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>{messages.length ? messages.map(item => <Box key={item._id} sx={{ mb: 2 }}><Typography fontWeight={600}>{item.senderName}</Typography><Typography>{item.content}</Typography></Box>) : <Typography color="text.secondary">No messages yet.</Typography>}</Box><Box sx={{ display: 'flex', gap: 1 }}><TextField fullWidth value={message} onChange={event => setMessage(event.target.value)} label="Message" multiline maxRows={4} /><Button aria-label="Send message" variant="contained" disabled={sending || !message.trim()} onClick={() => void send()}><Send /></Button></Box></>}
        </Box>
      </Paper>}
    {!loading && !recipients.length && <Alert severity="info" sx={{ mt: 2 }}>No authorized parent or guardian contacts are currently available.</Alert>}
    <Dialog open={composeOpen} onClose={() => !sending && setComposeOpen(false)} fullWidth maxWidth="sm"><DialogTitle>New message</DialogTitle><DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}><Select displayEmpty value={recipientKey} onChange={event => setRecipientKey(event.target.value)} aria-label="Parent or guardian"><MenuItem value="" disabled>Select parent or guardian</MenuItem>{recipients.map(item => <MenuItem key={`${item.guardianId}:${item.participantId}`} value={`${item.guardianId}:${item.participantId}`}>{item.guardianName} — {item.participantName}</MenuItem>)}</Select><TextField label="Subject" value={subject} onChange={event => setSubject(event.target.value)} /><TextField label="Message" multiline minRows={4} value={message} onChange={event => setMessage(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setComposeOpen(false)}>Cancel</Button><Button variant="contained" disabled={sending || !recipientKey || !message.trim()} onClick={() => void startConversation()}>Send</Button></DialogActions></Dialog>
  </Box>;
};

export default CommunicationCenter;
