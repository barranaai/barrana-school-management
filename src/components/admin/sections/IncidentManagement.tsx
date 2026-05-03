/**
 * IncidentManagement (Admin)
 *
 * Full incident-tracking dashboard for school admins:
 *   - Stats cards (total, last 30 days, open by severity, by status)
 *   - Filterable, paginated list of incidents
 *   - Detail dialog with timeline + admin actions:
 *       review, resolve, lock/unlock, notify-parents, delete
 *   - Real-time refresh trigger
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
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Avatar,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ReportProblem,
  Refresh,
  CheckCircle,
  Lock,
  LockOpen,
  Send,
  Visibility,
  Close,
  CalendarMonth,
  LocationOn,
  ChevronRight,
  Delete as DeleteIcon,
  History as HistoryIcon,
  Person,
  Group as GroupIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type IncidentReport,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentStats,
  type IncidentType,
} from '../../../services/apiService';

interface Props {
  schoolBranding?: any;
}

const SEVERITY_COLOR: Record<IncidentSeverity, { bg: string; fg: string; label: string }> = {
  minor: { bg: '#e8f5e9', fg: '#2e7d32', label: 'Minor' },
  moderate: { bg: '#fff8e1', fg: '#ef6c00', label: 'Moderate' },
  serious: { bg: '#ffebee', fg: '#c62828', label: 'Serious' },
  critical: { bg: '#fce4ec', fg: '#ad1457', label: 'Critical' },
};

const TYPE_LABELS: Record<IncidentType, string> = {
  injury: 'Injury',
  behavior: 'Behavior',
  illness: 'Illness',
  allergic_reaction: 'Allergic Reaction',
  medication_error: 'Medication Error',
  environmental: 'Environmental',
  lost_child: 'Lost Child',
  property_damage: 'Property Damage',
  other: 'Other',
};

const STATUS_META: Record<
  IncidentStatus,
  { label: string; color: string; icon: React.ReactElement }
> = {
  reported: { label: 'Reported', color: '#1976d2', icon: <ReportProblem fontSize="small" /> },
  parent_notified: {
    label: 'Parent notified',
    color: '#0288d1',
    icon: <Send fontSize="small" />,
  },
  acknowledged: {
    label: 'Acknowledged',
    color: '#7b1fa2',
    icon: <CheckCircle fontSize="small" />,
  },
  under_review: { label: 'Under review', color: '#ef6c00', icon: <Visibility fontSize="small" /> },
  resolved: { label: 'Resolved', color: '#2e7d32', icon: <CheckCircle fontSize="small" /> },
  closed: { label: 'Closed', color: '#455a64', icon: <Lock fontSize="small" /> },
};

function studentLabel(stu: any): string {
  if (!stu) return 'Unknown';
  if (typeof stu === 'string') return stu;
  return `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Student';
}

function userLabel(u: any): string {
  if (!u) return '—';
  if (typeof u === 'string') return u;
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—';
}

const IncidentManagement: React.FC<Props> = ({ schoolBranding }) => {
  const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';

  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<'' | IncidentSeverity>('');
  const [filterType, setFilterType] = useState<'' | IncidentType>('');
  const [filterStatus, setFilterStatus] = useState<'' | IncidentStatus>('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<IncidentReport | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [incRes, statsRes] = await Promise.all([
        apiService.getIncidents({
          severity: filterSeverity || undefined,
          incidentType: filterType || undefined,
          status: filterStatus || undefined,
          limit: 200,
        }),
        apiService.getIncidentStats(),
      ]);
      if (incRes.success && Array.isArray(incRes.data)) setIncidents(incRes.data);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
    } catch (err) {
      console.error('Admin: load incidents error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterSeverity, filterType, filterStatus]);

  const filtered = useMemo(() => {
    if (!search.trim()) return incidents;
    const q = search.trim().toLowerCase();
    return incidents.filter((i) => {
      const inNumber = i.reportNumber?.toLowerCase().includes(q);
      const inDesc = i.description?.toLowerCase().includes(q);
      const inLoc = i.location?.toLowerCase().includes(q);
      const inStudent = (i.studentsInvolved || []).some((s) =>
        studentLabel(s.studentId).toLowerCase().includes(q)
      );
      return Boolean(inNumber || inDesc || inLoc || inStudent);
    });
  }, [incidents, search]);

  const handleChanged = (next: IncidentReport) => {
    setDetail(next);
    setIncidents((prev) => prev.map((i) => (i._id === next._id ? next : i)));
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Hero */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 2,
          background: `linear-gradient(135deg, ${primaryColor} 0%, #c62828 120%)`,
          color: '#fff',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <ReportProblem sx={{ fontSize: 36 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Incident Management
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Review, respond to, and resolve all incidents reported across your school.
              </Typography>
            </Box>
            <IconButton
              onClick={load}
              sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
              title="Refresh"
            >
              <Refresh />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Total"
              value={stats.total}
              hint="All incidents"
              color="#1976d2"
              icon={<ReportProblem />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Last 30 days"
              value={stats.last30Days}
              hint="Reported in 30d"
              color="#ef6c00"
              icon={<CalendarMonth />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Serious or critical"
              value={(stats.severityLast30.serious || 0) + (stats.severityLast30.critical || 0)}
              hint="Last 30 days"
              color="#c62828"
              icon={<ReportProblem />}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <StatCard
              label="Awaiting acknowledgment"
              value={stats.byStatus.parent_notified || 0}
              hint="Parent notified"
              color="#7b1fa2"
              icon={<Send />}
            />
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              placeholder="Number, description, student, location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Severity</InputLabel>
              <Select
                label="Severity"
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as any)}
              >
                <MenuItem value="">All</MenuItem>
                {(Object.keys(SEVERITY_COLOR) as IncidentSeverity[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {SEVERITY_COLOR[s].label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
              >
                <MenuItem value="">All</MenuItem>
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {v}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
              >
                <MenuItem value="">All</MenuItem>
                {(Object.keys(STATUS_META) as IncidentStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </MenuItem>
                ))}
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
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              No incidents match your filters.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Adjust filters or refresh to see new incidents as they're reported.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {filtered.map((inc) => (
            <AdminIncidentRow key={inc._id} incident={inc} onClick={() => setDetail(inc)} />
          ))}
        </Stack>
      )}

      {detail && (
        <AdminIncidentDetailDialog
          incident={detail}
          onClose={() => setDetail(null)}
          onChanged={handleChanged}
          onDeleted={() => {
            setIncidents((prev) => prev.filter((i) => i._id !== detail._id));
            setDetail(null);
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

const AdminIncidentRow: React.FC<{ incident: IncidentReport; onClick: () => void }> = ({
  incident,
  onClick,
}) => {
  const sev = SEVERITY_COLOR[incident.severity];
  const status = STATUS_META[incident.status];
  const studentNames = (incident.studentsInvolved || [])
    .map((s) => studentLabel(s.studentId))
    .filter(Boolean)
    .join(', ');

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        borderLeft: `4px solid ${sev.fg}`,
        '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 },
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip label={sev.label} size="small" sx={{ bgcolor: sev.bg, color: sev.fg, fontWeight: 700 }} />
          <Chip
            label={TYPE_LABELS[incident.incidentType] || incident.incidentType}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Chip
            icon={status.icon}
            label={status.label}
            size="small"
            sx={{ color: status.color, borderColor: status.color, fontWeight: 600 }}
            variant="outlined"
          />
          {incident.isLocked && <Chip icon={<Lock fontSize="small" />} label="Locked" size="small" color="warning" />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 700, mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={incident.description}
            >
              {incident.reportNumber} · {studentNames || 'No students'}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {incident.description}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarMonth sx={{ fontSize: 14 }} />
                {new Date(incident.occurredAt).toLocaleString()}
              </Typography>
              {incident.location && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn sx={{ fontSize: 14 }} />
                  {incident.location}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Person sx={{ fontSize: 14 }} />
                Reported by {userLabel(incident.reportedBy)}
              </Typography>
            </Box>
          </Box>
          <ChevronRight color="action" />
        </Box>
      </CardContent>
    </Card>
  );
};

// ─── Detail dialog with admin actions ─────────────────────────────────

interface DetailProps {
  incident: IncidentReport;
  onClose: () => void;
  onChanged: (next: IncidentReport) => void;
  onDeleted: () => void;
}

const AdminIncidentDetailDialog: React.FC<DetailProps> = ({
  incident,
  onClose,
  onChanged,
  onDeleted,
}) => {
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState(incident.reviewNotes || '');
  const [resolutionNotes, setResolutionNotes] = useState(incident.resolutionNotes || '');

  const sev = SEVERITY_COLOR[incident.severity];
  const status = STATUS_META[incident.status];

  const wrap = async <T,>(p: Promise<T>): Promise<T | null> => {
    setBusy(true);
    try {
      return await p;
    } finally {
      setBusy(false);
    }
  };

  const handleNotify = async () => {
    const res = await wrap(apiService.notifyParentsOfIncident(incident._id, ['push']));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Parent notification dispatched.');
    } else {
      toast.error(res?.error || 'Failed to notify parents');
    }
  };

  const handleReview = async () => {
    const res = await wrap(apiService.reviewIncident(incident._id, reviewNotes));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Review recorded.');
    } else {
      toast.error(res?.error || 'Failed to record review');
    }
  };

  const handleResolve = async () => {
    const res = await wrap(apiService.resolveIncident(incident._id, resolutionNotes));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success('Incident resolved.');
    } else {
      toast.error(res?.error || 'Failed to resolve');
    }
  };

  const handleLockToggle = async () => {
    const res = await wrap(apiService.toggleIncidentLock(incident._id, !incident.isLocked));
    if (res?.success && res.data) {
      onChanged(res.data);
      toast.success(res.data.isLocked ? 'Incident locked.' : 'Incident unlocked.');
    } else {
      toast.error(res?.error || 'Failed to toggle lock');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this incident? This cannot be undone (locked incidents cannot be deleted).')) return;
    const res = await wrap(apiService.deleteIncident(incident._id));
    if (res?.success) {
      toast.success('Incident deleted.');
      onDeleted();
    } else {
      toast.error(res?.error || 'Failed to delete');
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {incident.reportNumber}
        <Chip label={sev.label} size="small" sx={{ bgcolor: sev.bg, color: sev.fg, fontWeight: 700 }} />
        <Chip
          icon={status.icon}
          label={status.label}
          size="small"
          sx={{ color: status.color, borderColor: status.color, fontWeight: 600 }}
          variant="outlined"
        />
        {incident.isLocked && <Chip icon={<Lock fontSize="small" />} label="Locked" size="small" color="warning" />}
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3 }}>
        <Tab label="Details" />
        <Tab label="Notifications" />
        <Tab label="Audit log" />
      </Tabs>

      <DialogContent dividers>
        {tab === 0 && (
          <Stack spacing={1.5}>
            <SummaryRow label="When">{new Date(incident.occurredAt).toLocaleString()}</SummaryRow>
            <SummaryRow label="Location">{incident.location || '—'}</SummaryRow>
            <SummaryRow label="Type">{TYPE_LABELS[incident.incidentType]}</SummaryRow>
            <SummaryRow label="Reported by">{userLabel(incident.reportedBy)}</SummaryRow>
            <SummaryRow label="Students involved">
              {(incident.studentsInvolved || []).map((s) => studentLabel(s.studentId)).join(', ') || '—'}
            </SummaryRow>
            <SummaryRow label="Description">{incident.description}</SummaryRow>
            <SummaryRow label="Immediate action">{incident.immediateAction || '—'}</SummaryRow>
            <SummaryRow label="First aid">
              {incident.firstAidGiven ? `Yes — ${incident.firstAidDetails || ''}` : 'No'}
            </SummaryRow>
            <SummaryRow label="Emergency services">
              {incident.emergencyServicesCalled
                ? `Yes — ${incident.emergencyServicesDetails || ''}`
                : 'No'}
            </SummaryRow>
            {incident.attachments && incident.attachments.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                  Attachments
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {incident.attachments.map((a) => (
                    <Tooltip key={a._id || a.filename} title={a.originalName}>
                      <Box
                        component="a"
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        sx={{
                          width: 96,
                          height: 96,
                          borderRadius: 2,
                          overflow: 'hidden',
                          background: '#f5f5f5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {a.mimeType?.startsWith('image/') ? (
                          <img
                            src={a.url}
                            alt={a.originalName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Typography variant="caption">{a.originalName}</Typography>
                        )}
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Admin actions
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Send />}
                onClick={handleNotify}
                disabled={busy || incident.isLocked}
              >
                Notify parents now
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={incident.isLocked ? <LockOpen /> : <Lock />}
                color="warning"
                onClick={handleLockToggle}
                disabled={busy}
              >
                {incident.isLocked ? 'Unlock' : 'Lock for compliance'}
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                disabled={busy || incident.isLocked}
              >
                Delete
              </Button>
            </Stack>
            <TextField
              label="Review notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              multiline
              minRows={2}
              size="small"
              disabled={incident.isLocked}
              helperText={incident.reviewedAt ? `Last reviewed ${new Date(incident.reviewedAt).toLocaleString()}` : 'Not yet reviewed'}
            />
            <Box>
              <Button
                variant="contained"
                startIcon={<Visibility />}
                onClick={handleReview}
                disabled={busy || incident.isLocked || !reviewNotes.trim()}
              >
                Record review
              </Button>
            </Box>
            <TextField
              label="Resolution notes"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              multiline
              minRows={2}
              size="small"
              disabled={incident.isLocked}
              helperText={incident.resolvedAt ? `Resolved ${new Date(incident.resolvedAt).toLocaleString()}` : 'Not yet resolved'}
            />
            <Box>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={handleResolve}
                disabled={busy || incident.isLocked || !resolutionNotes.trim()}
              >
                Resolve incident
              </Button>
            </Box>
          </Stack>
        )}

        {tab === 1 && (
          <Stack spacing={1}>
            {incident.parentNotifications && incident.parentNotifications.length > 0 ? (
              incident.parentNotifications.map((n) => (
                <Paper key={n._id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label={n.method} />
                    <Chip
                      size="small"
                      label={n.deliveryStatus || 'queued'}
                      color={
                        n.deliveryStatus === 'sent'
                          ? 'success'
                          : n.deliveryStatus === 'failed'
                          ? 'error'
                          : 'default'
                      }
                    />
                    {n.acknowledged && (
                      <Chip size="small" color="success" icon={<CheckCircle fontSize="small" />} label="Acknowledged" />
                    )}
                    <Typography variant="caption" sx={{ ml: 'auto' }}>
                      {n.notifiedAt ? new Date(n.notifiedAt).toLocaleString() : ''}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    For{' '}
                    <strong>
                      {studentLabel(n.studentId)}
                    </strong>
                    {n.parentEmail ? ` (${n.parentEmail})` : ''} — by {userLabel(n.notifiedBy)}
                  </Typography>
                  {n.deliveryError && (
                    <Typography variant="caption" color="error">
                      {n.deliveryError}
                    </Typography>
                  )}
                  {n.acknowledgmentNotes && (
                    <Typography variant="caption" color="text.secondary">
                      Note: {n.acknowledgmentNotes}
                    </Typography>
                  )}
                </Paper>
              ))
            ) : (
              <Alert severity="info">No parent notifications dispatched yet.</Alert>
            )}
          </Stack>
        )}

        {tab === 2 && (
          <Stack spacing={1}>
            {incident.editHistory && incident.editHistory.length > 0 ? (
              incident.editHistory.map((h, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <HistoryIcon fontSize="small" color="action" />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {h.summary || 'Edit'}
                    </Typography>
                    <Typography variant="caption" sx={{ ml: 'auto' }}>
                      {new Date(h.editedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    by {userLabel(h.editedBy)}{' '}
                    {h.fieldsChanged && h.fieldsChanged.length > 0 ? `· fields: ${h.fieldsChanged.join(', ')}` : ''}
                  </Typography>
                </Paper>
              ))
            ) : (
              <Alert severity="info">No audit entries yet.</Alert>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const SummaryRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 0.5 }}>
    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 160 }}>
      {label}
    </Typography>
    <Typography variant="body2" component="div" sx={{ flex: 1 }}>
      {children}
    </Typography>
  </Box>
);

export default IncidentManagement;
