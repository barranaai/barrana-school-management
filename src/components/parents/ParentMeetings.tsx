/**
 * ParentMeetings
 *
 * Three tabs:
 *   - Book a meeting: pick child → pick teacher → pick slot → confirm
 *   - Upcoming: my future confirmed meetings
 *   - Past: completed / cancelled / no-show / rescheduled history
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
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  Refresh,
  LocationOn,
  Videocam,
  Phone,
  Person,
  Cancel,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type AvailabilitySlot,
  type Meeting,
  type MeetingFormat,
} from '../../services/apiService';

interface Props {
  parentEmail?: string;
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

const ParentMeetings: React.FC<Props> = ({ parentEmail }) => {
  const [tab, setTab] = useState(0);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookOpen, setBookOpen] = useState(false);
  const [detail, setDetail] = useState<Meeting | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [meetingsRes, slotsRes, childrenRes] = await Promise.all([
        apiService.getMeetings({}),
        apiService.getAvailability({
          status: 'published',
          onlyMyTeachers: true,
          from: new Date().toISOString(),
        }),
        fetch('/api/parents/me/children', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        }).then((r) => r.json()),
      ]);
      if (meetingsRes.success && Array.isArray(meetingsRes.data)) setMeetings(meetingsRes.data);
      if (slotsRes.success && Array.isArray(slotsRes.data)) setSlots(slotsRes.data);
      if (childrenRes?.success && Array.isArray(childrenRes.data)) setChildren(childrenRes.data);
    } catch (err) {
      console.error('Parent: load meetings error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

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
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <EventIcon sx={{ fontSize: 32, color: '#1976d2' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Parent-Teacher Meetings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Book a meeting with your child's teacher and manage your upcoming sessions.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<EventIcon />} onClick={() => setBookOpen(true)}>
          Book a Meeting
        </Button>
        <IconButton onClick={loadAll} title="Refresh">
          <Refresh />
        </IconButton>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Upcoming (${upcomingMeetings.length})`} />
        <Tab label={`Past (${pastMeetings.length})`} />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : tab === 0 ? (
        <ParentMeetingsList
          meetings={upcomingMeetings}
          onClick={setDetail}
          emptyText="You have no upcoming meetings."
          ctaLabel="Book one now"
          onCta={() => setBookOpen(true)}
        />
      ) : (
        <ParentMeetingsList
          meetings={pastMeetings}
          onClick={setDetail}
          emptyText="No past meetings yet."
        />
      )}

      {bookOpen && (
        <BookMeetingDialog
          myChildren={children}
          slots={slots}
          onClose={() => setBookOpen(false)}
          onBooked={() => {
            setBookOpen(false);
            loadAll();
          }}
        />
      )}

      {detail && (
        <ParentMeetingDetailDialog
          meeting={detail}
          onClose={() => setDetail(null)}
          onChanged={(next) => {
            setDetail(next);
            setMeetings((prev) => prev.map((m) => (m._id === next._id ? next : m)));
            // Refresh available slots since cancellation frees a slot
            loadAll();
          }}
        />
      )}
    </Box>
  );
};

const ParentMeetingsList: React.FC<{
  meetings: Meeting[];
  onClick: (m: Meeting) => void;
  emptyText: string;
  ctaLabel?: string;
  onCta?: () => void;
}> = ({ meetings, onClick, emptyText, ctaLabel, onCta }) => {
  if (meetings.length === 0) {
    return (
      <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
        <CardContent>
          <Typography variant="body1" color="text.secondary" sx={{ mb: ctaLabel ? 2 : 0 }}>
            {emptyText}
          </Typography>
          {ctaLabel && onCta && (
            <Button variant="contained" startIcon={<EventIcon />} onClick={onCta}>
              {ctaLabel}
            </Button>
          )}
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
                {userLabel(m.teacherId)}
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

// ─── Booking dialog ───────────────────────────────────────────────────

const BookMeetingDialog: React.FC<{
  myChildren: any[];
  slots: AvailabilitySlot[];
  onClose: () => void;
  onBooked: () => void;
}> = ({ myChildren, slots, onClose, onBooked }) => {
  const [studentId, setStudentId] = useState<string>(myChildren[0]?._id || '');
  const [teacherId, setTeacherId] = useState<string>('');
  const [slotId, setSlotId] = useState<string>('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Distinct teachers across all available slots
  const teachers = useMemo(() => {
    const seen = new Map<string, { _id: string; firstName: string; lastName: string }>();
    slots.forEach((s) => {
      if (typeof s.teacherId === 'object' && s.teacherId) {
        const t = s.teacherId as any;
        seen.set(t._id, { _id: t._id, firstName: t.firstName, lastName: t.lastName });
      }
    });
    return Array.from(seen.values());
  }, [slots]);

  // Slots filtered by selected teacher
  const teacherSlots = useMemo(
    () =>
      slots
        .filter(
          (s) =>
            typeof s.teacherId === 'object' &&
            (s.teacherId as any)?._id === teacherId &&
            s.status === 'published'
        )
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [slots, teacherId]
  );

  // Group slots by date for picker UX
  const slotsByDate = useMemo(() => {
    const groups: Record<string, AvailabilitySlot[]> = {};
    teacherSlots.forEach((s) => {
      const date = new Date(s.startsAt).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      (groups[date] = groups[date] || []).push(s);
    });
    return groups;
  }, [teacherSlots]);

  const handleBook = async () => {
    if (!studentId) return toast.error('Pick a child');
    if (!slotId) return toast.error('Pick a slot');
    setSubmitting(true);
    try {
      const res = await apiService.bookMeeting(slotId, studentId, bookingMessage || undefined);
      if (res.success && res.data) {
        toast.success(`Meeting booked: ${res.data.meetingNumber}`);
        onBooked();
      } else {
        toast.error(res.error || 'Booking failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Book a meeting</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Pick your child, the teacher, and a time slot. Booking is instant — both you and the teacher get a confirmation.
          </Alert>

          <FormControl fullWidth>
            <InputLabel>Child</InputLabel>
            <Select
              label="Child"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {myChildren.map((c) => (
                <MenuItem key={c._id} value={c._id}>
                  {c.firstName} {c.lastName}
                  {c.studentClass ? ` · ${c.studentClass}` : ''}
                </MenuItem>
              ))}
              {myChildren.length === 0 && <MenuItem disabled>No children on file</MenuItem>}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Teacher</InputLabel>
            <Select
              label="Teacher"
              value={teacherId}
              onChange={(e) => {
                setTeacherId(e.target.value);
                setSlotId('');
              }}
            >
              {teachers.length === 0 && (
                <MenuItem disabled>No teachers have published slots yet</MenuItem>
              )}
              {teachers.map((t) => (
                <MenuItem key={t._id} value={t._id}>
                  {t.firstName} {t.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {teacherId && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Pick a time slot
              </Typography>
              {Object.keys(slotsByDate).length === 0 ? (
                <Alert severity="info">No open slots for this teacher right now.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {Object.entries(slotsByDate).map(([date, daySlots]) => (
                    <Box key={date}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        {date}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 0.5 }}>
                        {daySlots.map((s) => {
                          const time = `${new Date(s.startsAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`;
                          const selected = slotId === s._id;
                          return (
                            <Chip
                              key={s._id}
                              icon={FORMAT_META[s.format].icon}
                              label={`${time} • ${s.durationMinutes}m`}
                              color={selected ? 'primary' : 'default'}
                              onClick={() => setSlotId(s._id)}
                              sx={{ cursor: 'pointer', fontWeight: selected ? 700 : 500 }}
                            />
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          )}

          <TextField
            label="Message to the teacher (optional)"
            value={bookingMessage}
            onChange={(e) => setBookingMessage(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="e.g. I'd like to discuss reading progress."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleBook}
          disabled={submitting || !studentId || !slotId}
        >
          {submitting ? 'Booking…' : 'Confirm booking'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Parent meeting detail dialog ─────────────────────────────────────

const ParentMeetingDetailDialog: React.FC<{
  meeting: Meeting;
  onClose: () => void;
  onChanged: (next: Meeting) => void;
}> = ({ meeting, onClose, onChanged }) => {
  const [busy, setBusy] = useState(false);

  const isUpcoming = meeting.status === 'confirmed' && new Date(meeting.startsAt) >= new Date();
  const canCancel =
    isUpcoming && new Date(meeting.startsAt).getTime() - Date.now() >= 60 * 60 * 1000;

  const wrap = async <T,>(p: Promise<T>): Promise<T | null> => {
    setBusy(true);
    try {
      return await p;
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this meeting?')) return;
    const reason = window.prompt('Reason (optional):') || undefined;
    const res = await wrap(apiService.cancelMeeting(meeting._id, reason));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Meeting cancelled.');
    } else {
      toast.error(res?.error || 'Failed to cancel');
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
          <Row label="Teacher">{userLabel(meeting.teacherId)}</Row>
          <Row label="Child">{userLabel(meeting.studentId)}</Row>
          {meeting.bookingMessage && <Row label="Your note">{meeting.bookingMessage}</Row>}
          {meeting.cancelledAt && (
            <Row label="Cancelled">
              by {userLabel(meeting.cancelledBy)} at {new Date(meeting.cancelledAt).toLocaleString()}
              {meeting.cancellationReason ? ` — ${meeting.cancellationReason}` : ''}
            </Row>
          )}
          {meeting.completedAt && (
            <Row label="Completed">{new Date(meeting.completedAt).toLocaleString()}</Row>
          )}
          {meeting.teacherNotes && <Row label="Teacher notes">{meeting.teacherNotes}</Row>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Box sx={{ flex: 1 }} />
        {isUpcoming && (
          <Button
            color="error"
            startIcon={<Cancel />}
            onClick={handleCancel}
            disabled={busy || !canCancel}
            title={!canCancel ? 'Meetings can only be cancelled at least 1 hour before they start' : ''}
          >
            Cancel meeting
          </Button>
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

export default ParentMeetings;
