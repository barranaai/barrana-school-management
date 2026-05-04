/**
 * MeetingsManagement (Admin)
 *
 * School-wide oversight of parent-teacher meetings:
 *   - Stats cards (total, upcoming 30d, completed, cancelled, no-show)
 *   - Filterable list with detail dialog
 *   - Admin can view all but does not gate booking (auto-book MVP)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
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
  TextField,
  Typography,
  Button,
  Avatar,
} from '@mui/material';
import {
  Event as EventIcon,
  Refresh,
  CheckCircle,
  Cancel as CancelIcon,
  PersonOff,
  Schedule,
  Person,
  LocationOn,
  Videocam,
  Phone,
} from '@mui/icons-material';
import {
  apiService,
  type Meeting,
  type MeetingFormat,
  type MeetingStats,
  type MeetingStatus,
} from '../../../services/apiService';
import SchoolBannerHeader from '../../common/SchoolBannerHeader';

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

const MeetingsManagement: React.FC<Props> = ({ schoolBranding }) => {
  const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [stats, setStats] = useState<MeetingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'' | MeetingStatus>('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Meeting | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        apiService.getMeetings(filterStatus ? { status: filterStatus } : {}),
        apiService.getMeetingStats(),
      ]);
      if (mRes.success && Array.isArray(mRes.data)) setMeetings(mRes.data);
      if (sRes.success && sRes.data) setStats(sRes.data);
    } catch (err) {
      console.error('Admin: load meetings error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // `load` is defined later in the component and intentionally excluded;
    // including it would create an infinite refresh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.trim().toLowerCase();
    return meetings.filter(
      (m) =>
        m.meetingNumber?.toLowerCase().includes(q) ||
        userLabel(m.teacherId).toLowerCase().includes(q) ||
        userLabel(m.parentId).toLowerCase().includes(q) ||
        userLabel(m.studentId).toLowerCase().includes(q)
    );
  }, [meetings, search]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <SchoolBannerHeader schoolBranding={schoolBranding} />
      {/* Hero */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 2,
          background: `linear-gradient(135deg, ${primaryColor} 0%, #43e97b 100%)`,
          color: '#fff',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <EventIcon sx={{ fontSize: 36 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Meetings Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                School-wide oversight of all parent-teacher meetings.
              </Typography>
            </Box>
            <IconButton onClick={load} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }} title="Refresh">
              <Refresh />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={2.4}>
            <StatCard label="Total" value={stats.total} hint="All meetings" color="#1976d2" icon={<EventIcon />} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <StatCard label="Upcoming (30d)" value={stats.upcoming30Days} hint="Next 30 days" color="#0288d1" icon={<Schedule />} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <StatCard label="Completed" value={stats.completed} hint="All time" color="#2e7d32" icon={<CheckCircle />} />
          </Grid>
          <Grid item xs={6} md={2.4}>
            <StatCard label="Cancelled" value={stats.cancelled} hint="All time" color="#9e9e9e" icon={<CancelIcon />} />
          </Grid>
          <Grid item xs={12} md={2.4}>
            <StatCard label="No-show" value={stats.noShow} hint="All time" color="#c62828" icon={<PersonOff />} />
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              placeholder="Meeting #, teacher, parent, student"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                <MenuItem value="">All</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
                <MenuItem value="no_show">No-show</MenuItem>
                <MenuItem value="rescheduled">Rescheduled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
          <CardContent>
            <Typography variant="body1" color="text.secondary">
              No meetings match your filters.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((m) => (
            <AdminMeetingRow key={m._id} meeting={m} onClick={() => setDetail(m)} />
          ))}
        </Stack>
      )}

      {detail && (
        <AdminMeetingDetailDialog
          meeting={detail}
          onClose={() => setDetail(null)}
          onChanged={(next) => {
            setDetail(next);
            setMeetings((prev) => prev.map((m) => (m._id === next._id ? next : m)));
          }}
        />
      )}
    </Box>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: number;
  hint: string;
  color: string;
  icon: React.ReactElement;
}> = ({ label, value, hint, color, icon }) => (
  <Card sx={{ borderRadius: 2, height: '100%' }}>
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: color, color: '#fff' }}>{icon}</Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const AdminMeetingRow: React.FC<{ meeting: Meeting; onClick: () => void }> = ({ meeting, onClick }) => (
  <Card
    onClick={onClick}
    sx={{
      borderRadius: 3,
      cursor: 'pointer',
      borderLeft: `4px solid ${STATUS_COLORS[meeting.status] || '#ccc'}`,
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 },
    }}
  >
    <CardContent sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip size="small" icon={FORMAT_META[meeting.format].icon} label={FORMAT_META[meeting.format].label} />
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
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {meeting.meetingNumber}
        </Typography>
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
        {formatRange(meeting.startsAt, meeting.endsAt)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Person sx={{ fontSize: 16 }} />
          Teacher: <strong>{userLabel(meeting.teacherId)}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Parent: <strong>{userLabel(meeting.parentId)}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Student: <strong>{userLabel(meeting.studentId)}</strong>
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

const AdminMeetingDetailDialog: React.FC<{
  meeting: Meeting;
  onClose: () => void;
  onChanged: (next: Meeting) => void;
}> = ({ meeting, onClose }) => (
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
        <Row label="Parent">{userLabel(meeting.parentId)}</Row>
        <Row label="Student">{userLabel(meeting.studentId)}</Row>
        {meeting.bookingMessage && <Row label="Booking message">{meeting.bookingMessage}</Row>}
        {meeting.cancelledAt && (
          <Row label="Cancelled">
            by {userLabel(meeting.cancelledBy)} at {new Date(meeting.cancelledAt).toLocaleString()}
            {meeting.cancellationReason ? ` — ${meeting.cancellationReason}` : ''}
          </Row>
        )}
        {meeting.completedAt && <Row label="Completed">{new Date(meeting.completedAt).toLocaleString()}</Row>}
        {meeting.noShowAt && <Row label="No-show">{new Date(meeting.noShowAt).toLocaleString()}</Row>}
        {meeting.teacherNotes && <Row label="Teacher notes">{meeting.teacherNotes}</Row>}
        {meeting.reminderHistory && meeting.reminderHistory.length > 0 && (
          <Row label="Reminders sent">
            {meeting.reminderHistory.map((r, i) => (
              <Chip
                key={i}
                size="small"
                label={`${r.type} · ${new Date(r.sentAt).toLocaleString()}`}
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Row>
        )}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Close</Button>
    </DialogActions>
  </Dialog>
);

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

export default MeetingsManagement;
