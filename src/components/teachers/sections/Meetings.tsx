/**
 * Meetings (Teacher)
 *
 * Two tabs:
 *   - Availability: publish open slots, see booked/published/cancelled,
 *     remove unbooked slots
 *   - My Meetings: upcoming + past, with complete/no-show/cancel actions
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  Add,
  Refresh,
  CalendarMonth,
  AccessTime,
  LocationOn,
  Videocam,
  Phone,
  Person,
  Delete as DeleteIcon,
  CheckCircle,
  PersonOff,
  Cancel,
  Note,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type AvailabilitySlot,
  type Meeting,
  type MeetingFormat,
} from '../../../services/apiService';

interface Props {
  schoolBranding?: any;
}

const FORMAT_META: Record<MeetingFormat, { label: string; icon: React.ReactElement }> = {
  in_person: { label: 'In person', icon: <LocationOn fontSize="small" /> },
  virtual: { label: 'Virtual', icon: <Videocam fontSize="small" /> },
  phone: { label: 'Phone', icon: <Phone fontSize="small" /> },
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#1976d2',
  cancelled: '#9e9e9e',
  completed: '#2e7d32',
  no_show: '#c62828',
  rescheduled: '#7b1fa2',
};

function userLabel(u: any): string {
  if (!u) return '—';
  if (typeof u === 'string') return u;
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—';
}

function formatRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const t = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${dateStr} • ${t(s)} – ${t(e)}`;
}

function toLocalDateTimeInput(d: Date): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

const Meetings: React.FC<Props> = ({ schoolBranding }) => {
  const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';

  const [tab, setTab] = useState(0);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [slotsRes, meetingsRes] = await Promise.all([
        apiService.getAvailability({ from: new Date().toISOString() }),
        apiService.getMeetings({}),
      ]);
      if (slotsRes.success && Array.isArray(slotsRes.data)) setSlots(slotsRes.data);
      if (meetingsRes.success && Array.isArray(meetingsRes.data)) setMeetings(meetingsRes.data);
    } catch (err) {
      console.error('Teacher: load meetings error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upcomingSlots = useMemo(
    () => slots.filter((s) => s.status === 'published' || s.status === 'booked'),
    [slots]
  );

  const upcomingMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.status === 'confirmed' && new Date(m.startsAt) >= new Date())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [meetings]
  );

  const pastMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.status !== 'confirmed' || new Date(m.startsAt) < new Date())
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    [meetings]
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${primaryColor} 0%, #4facfe 100%)`,
          color: '#fff',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <EventIcon sx={{ fontSize: 36 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Parent-Teacher Meetings
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Publish your availability and parents can book directly. Auto-confirmed.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <StatChip label="Open slots" value={upcomingSlots.filter((s) => s.status === 'published').length} />
              <StatChip label="Upcoming" value={upcomingMeetings.length} />
              <StatChip label="Past" value={pastMeetings.length} />
            </Stack>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: '#fff', color: primaryColor, fontWeight: 700, px: 3, '&:hover': { bgcolor: '#f5f5f5' } }}
            >
              Add Availability
            </Button>
            <IconButton onClick={load} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }} title="Refresh">
              <Refresh />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Availability (${upcomingSlots.length})`} />
        <Tab label={`Upcoming meetings (${upcomingMeetings.length})`} />
        <Tab label={`Past meetings (${pastMeetings.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {tab === 0 && (
            <AvailabilityList
              slots={upcomingSlots}
              onChanged={load}
              onAdd={() => setCreateOpen(true)}
              primaryColor={primaryColor}
            />
          )}
          {tab === 1 && (
            <MeetingsList meetings={upcomingMeetings} onClick={setDetailMeeting} emptyText="No upcoming meetings." />
          )}
          {tab === 2 && (
            <MeetingsList meetings={pastMeetings} onClick={setDetailMeeting} emptyText="No past meetings yet." />
          )}
        </>
      )}

      {createOpen && (
        <CreateAvailabilityDialog onClose={() => setCreateOpen(false)} onCreated={load} />
      )}
      {detailMeeting && (
        <TeacherMeetingDetailDialog
          meeting={detailMeeting}
          onClose={() => setDetailMeeting(null)}
          onChanged={(next) => {
            setDetailMeeting(next);
            setMeetings((prev) => prev.map((m) => (m._id === next._id ? next : m)));
          }}
        />
      )}
    </Box>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────

const StatChip: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Box sx={{ px: 2, py: 0.75, borderRadius: 2, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', textAlign: 'center', minWidth: 88 }}>
    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
      {value}
    </Typography>
    <Typography variant="caption" sx={{ opacity: 0.85 }}>
      {label}
    </Typography>
  </Box>
);

const AvailabilityList: React.FC<{
  slots: AvailabilitySlot[];
  onChanged: () => void;
  onAdd: () => void;
  primaryColor: string;
}> = ({ slots, onChanged, onAdd, primaryColor }) => {
  if (slots.length === 0) {
    return (
      <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
        <CardContent>
          <EventIcon sx={{ fontSize: 56, color: primaryColor, mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            No availability published yet.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Publish open time slots and parents will be able to book directly.
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={onAdd}>
            Add availability
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Group slots by date
  const groups: Record<string, AvailabilitySlot[]> = {};
  slots.forEach((s) => {
    const date = new Date(s.startsAt).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    (groups[date] = groups[date] || []).push(s);
  });

  const handleDelete = async (slot: AvailabilitySlot) => {
    if (slot.status === 'booked') {
      toast.error('Booked slots can only be removed by cancelling the meeting.');
      return;
    }
    if (!window.confirm('Remove this availability slot?')) return;
    const res = await apiService.deleteAvailability(slot._id);
    if (res.success) {
      toast.success('Slot removed.');
      onChanged();
    } else {
      toast.error(res.error || 'Failed to remove');
    }
  };

  return (
    <Stack spacing={2}>
      {Object.entries(groups).map(([date, daySlots]) => (
        <Box key={date}>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            {date}
          </Typography>
          <Stack spacing={1} sx={{ mt: 0.5 }}>
            {daySlots.map((s) => (
              <Paper
                key={s._id}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
              >
                <AccessTime fontSize="small" color="action" />
                <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 120 }}>
                  {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                  {new Date(s.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Typography>
                <Chip size="small" icon={FORMAT_META[s.format].icon} label={FORMAT_META[s.format].label} />
                {s.location && (
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<LocationOn fontSize="small" />}
                    label={s.location}
                  />
                )}
                {s.status === 'booked' ? (
                  <Chip size="small" color="primary" label="Booked" sx={{ fontWeight: 700 }} />
                ) : (
                  <Chip size="small" color="success" label="Open" sx={{ fontWeight: 700 }} />
                )}
                <Box sx={{ flex: 1 }} />
                {s.status !== 'booked' && (
                  <IconButton size="small" color="error" onClick={() => handleDelete(s)} title="Remove">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </Paper>
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

const MeetingsList: React.FC<{
  meetings: Meeting[];
  onClick: (m: Meeting) => void;
  emptyText: string;
}> = ({ meetings, onClick, emptyText }) => {
  if (meetings.length === 0) {
    return (
      <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
        <CardContent>
          <Typography variant="body1" color="text.secondary">
            {emptyText}
          </Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Stack spacing={1.5}>
      {meetings.map((m) => (
        <Card
          key={m._id}
          onClick={() => onClick(m)}
          sx={{
            borderRadius: 3,
            cursor: 'pointer',
            borderLeft: `4px solid ${STATUS_COLORS[m.status] || '#ccc'}`,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 },
          }}
        >
          <CardContent sx={{ py: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" icon={FORMAT_META[m.format].icon} label={FORMAT_META[m.format].label} />
              <Chip
                size="small"
                label={m.status.replace('_', ' ')}
                sx={{
                  color: STATUS_COLORS[m.status],
                  borderColor: STATUS_COLORS[m.status],
                  fontWeight: 700,
                  textTransform: 'capitalize',
                }}
                variant="outlined"
              />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {m.meetingNumber}
              </Typography>
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
              {formatRange(m.startsAt, m.endsAt)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Person sx={{ fontSize: 16 }} />
                {userLabel(m.parentId)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Re: <strong>{userLabel(m.studentId)}</strong>
              </Typography>
              {m.location && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn sx={{ fontSize: 14 }} />
                  {m.location}
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

// ─── Create Availability dialog ───────────────────────────────────────

const CreateAvailabilityDialog: React.FC<{ onClose: () => void; onCreated: () => void }> = ({
  onClose,
  onCreated,
}) => {
  // Sensible default: tomorrow at 9am, 30 min slot
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [startsAt, setStartsAt] = useState(toLocalDateTimeInput(tomorrow));
  const [duration, setDuration] = useState(30);
  const [count, setCount] = useState(1);
  const [gap, setGap] = useState(0);
  const [format, setFormat] = useState<MeetingFormat>('in_person');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const slots = useMemo(() => {
    const base = new Date(startsAt);
    if (Number.isNaN(base.getTime())) return [];
    const arr = [];
    for (let i = 0; i < count; i++) {
      const start = new Date(base.getTime() + i * (duration + gap) * 60000);
      const end = new Date(start.getTime() + duration * 60000);
      arr.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
    }
    return arr;
  }, [startsAt, duration, count, gap]);

  const handleCreate = async () => {
    if (slots.length === 0) {
      toast.error('Please pick a valid start time');
      return;
    }
    if (format === 'virtual' && !meetingUrl.trim()) {
      toast.error('Virtual meetings need a URL');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        slots: slots.map((s) => ({
          ...s,
          format,
          location: location || undefined,
          meetingUrl: meetingUrl || undefined,
          notes: notes || undefined,
        })),
      };
      const res = await apiService.createAvailability(payload as any);
      if (res.success) {
        toast.success(`${slots.length} slot${slots.length === 1 ? '' : 's'} published.`);
        onCreated();
        onClose();
      } else {
        toast.error(res.error || 'Failed to publish slots');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add availability</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Publish one or more open slots. Parents will see them and can book directly.
          </Alert>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Start time"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="Duration (min)"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(5, Math.min(240, Number(e.target.value) || 30)))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <TextField
                label="# of slots"
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                fullWidth
                helperText="Back-to-back"
              />
            </Grid>
            {count > 1 && (
              <Grid item xs={12} md={6}>
                <TextField
                  label="Gap between slots (min)"
                  type="number"
                  value={gap}
                  onChange={(e) => setGap(Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
                  fullWidth
                />
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select label="Format" value={format} onChange={(e) => setFormat(e.target.value as MeetingFormat)}>
                  {(Object.keys(FORMAT_META) as MeetingFormat[]).map((f) => (
                    <MenuItem key={f} value={f}>
                      {FORMAT_META[f].label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {format === 'in_person' && (
              <Grid item xs={12}>
                <TextField
                  label="Location"
                  placeholder="e.g. Classroom 2A, Front office"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  fullWidth
                />
              </Grid>
            )}
            {format === 'virtual' && (
              <Grid item xs={12}>
                <TextField
                  label="Meeting URL"
                  placeholder="Zoom / Google Meet / Teams link"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  fullWidth
                  required
                />
              </Grid>
            )}
            <Grid item xs={12}>
              <TextField
                label="Notes (visible to parents)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
          {slots.length > 0 && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fafafa' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Preview ({slots.length} slot{slots.length === 1 ? '' : 's'}):
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                {slots.map((s, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={`${new Date(s.startsAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}`}
                  />
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={submitting || slots.length === 0}>
          {submitting ? 'Publishing…' : `Publish ${slots.length || 0} slot${slots.length === 1 ? '' : 's'}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Teacher meeting detail dialog ────────────────────────────────────

const TeacherMeetingDetailDialog: React.FC<{
  meeting: Meeting;
  onClose: () => void;
  onChanged: (next: Meeting) => void;
}> = ({ meeting, onClose, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState(meeting.teacherNotes || '');

  const isUpcoming = meeting.status === 'confirmed' && new Date(meeting.startsAt) >= new Date();
  const isCompletable = meeting.status === 'confirmed' && new Date(meeting.startsAt) < new Date();

  const wrap = async <T,>(p: Promise<T>): Promise<T | null> => {
    setBusy(true);
    try {
      return await p;
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Reason for cancelling? (optional)') || undefined;
    const res = await wrap(apiService.cancelMeeting(meeting._id, reason));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Meeting cancelled.');
    } else {
      toast.error(res?.error || 'Failed to cancel');
    }
  };

  const handleComplete = async () => {
    const res = await wrap(apiService.completeMeeting(meeting._id, teacherNotes));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Marked as completed.');
    } else {
      toast.error(res?.error || 'Failed to mark complete');
    }
  };

  const handleNoShow = async () => {
    if (!window.confirm('Mark this meeting as a no-show?')) return;
    const res = await wrap(apiService.markMeetingNoShow(meeting._id));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Marked as no-show.');
    } else {
      toast.error(res?.error || 'Failed to mark no-show');
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {meeting.meetingNumber}
        <Chip
          size="small"
          label={meeting.status.replace('_', ' ')}
          sx={{
            color: STATUS_COLORS[meeting.status],
            borderColor: STATUS_COLORS[meeting.status],
            fontWeight: 700,
            textTransform: 'capitalize',
          }}
          variant="outlined"
        />
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Row label="When">{formatRange(meeting.startsAt, meeting.endsAt)}</Row>
          <Row label="Format">
            <Chip size="small" icon={FORMAT_META[meeting.format].icon} label={FORMAT_META[meeting.format].label} />
          </Row>
          {meeting.location && <Row label="Location">{meeting.location}</Row>}
          {meeting.meetingUrl && (
            <Row label="Meeting link">
              <Button size="small" variant="outlined" href={meeting.meetingUrl} target="_blank" rel="noreferrer">
                Open meeting
              </Button>
            </Row>
          )}
          <Row label="Parent">{userLabel(meeting.parentId)}</Row>
          <Row label="Student">{userLabel(meeting.studentId)}</Row>
          {meeting.bookingMessage && <Row label="Parent's note">{meeting.bookingMessage}</Row>}
          {meeting.cancelledAt && (
            <Row label="Cancelled">
              by {userLabel(meeting.cancelledBy)} at {new Date(meeting.cancelledAt).toLocaleString()}
              {meeting.cancellationReason ? ` — ${meeting.cancellationReason}` : ''}
            </Row>
          )}
          {meeting.completedAt && (
            <Row label="Completed">{new Date(meeting.completedAt).toLocaleString()}</Row>
          )}
          {(isUpcoming || isCompletable) && (
            <TextField
              label="Teacher notes"
              value={teacherNotes}
              onChange={(e) => setTeacherNotes(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              size="small"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>Close</Button>
        <Box sx={{ flex: 1 }} />
        {isUpcoming && (
          <Button color="error" startIcon={<Cancel />} onClick={handleCancel} disabled={busy}>
            Cancel meeting
          </Button>
        )}
        {isCompletable && (
          <>
            <Button color="warning" startIcon={<PersonOff />} onClick={handleNoShow} disabled={busy}>
              No-show
            </Button>
            <Button variant="contained" color="success" startIcon={<CheckCircle />} onClick={handleComplete} disabled={busy}>
              Mark completed
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 0.5 }}>
    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 140 }}>
      {label}
    </Typography>
    <Typography variant="body2" component="div" sx={{ flex: 1 }}>
      {children}
    </Typography>
  </Box>
);

export default Meetings;
