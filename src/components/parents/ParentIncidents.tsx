/**
 * ParentIncidents
 *
 * Parent-facing list of incidents involving any of their children.
 * Each card shows the essential details and an "Acknowledge" CTA when
 * a notification is awaiting acknowledgment for that parent.
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
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  ReportProblem,
  CheckCircle,
  CalendarMonth,
  LocationOn,
  Lock,
  Send,
  Visibility,
  Close,
  Refresh,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type IncidentReport,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from '../../services/apiService';

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
  parent_notified: { label: 'Notified', color: '#0288d1', icon: <Send fontSize="small" /> },
  acknowledged: { label: 'Acknowledged', color: '#7b1fa2', icon: <CheckCircle fontSize="small" /> },
  under_review: { label: 'Under review', color: '#ef6c00', icon: <Visibility fontSize="small" /> },
  resolved: { label: 'Resolved', color: '#2e7d32', icon: <CheckCircle fontSize="small" /> },
  closed: { label: 'Closed', color: '#455a64', icon: <Lock fontSize="small" /> },
};

function studentLabel(stu: any): string {
  if (!stu) return 'Unknown';
  if (typeof stu === 'string') return stu;
  return `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Student';
}

interface Props {
  parentEmail?: string;
}

const ParentIncidents: React.FC<Props> = ({ parentEmail }) => {
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<IncidentReport | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiService.getIncidents({ limit: 100 });
      if (res.success && Array.isArray(res.data)) setIncidents(res.data);
    } catch (err) {
      console.error('Parent: load incidents error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const awaiting = useMemo(
    () =>
      incidents.filter((inc) =>
        (inc.parentNotifications || []).some(
          (n) =>
            !n.acknowledged &&
            (parentEmail
              ? (n.parentEmail || '').toLowerCase() === parentEmail.toLowerCase()
              : true)
        )
      ),
    [incidents, parentEmail]
  );

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <ReportProblem sx={{ fontSize: 32, color: '#c62828' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Incidents
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All incidents involving your children, including any awaiting your acknowledgment.
          </Typography>
        </Box>
        <IconButton onClick={load} title="Refresh">
          <Refresh />
        </IconButton>
      </Box>

      {/* Awaiting acknowledgment banner */}
      {awaiting.length > 0 && (
        <Alert severity="warning" icon={<ReportProblem />} sx={{ mb: 2, borderRadius: 2 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>
            {awaiting.length} incident{awaiting.length === 1 ? '' : 's'} awaiting your acknowledgment
          </AlertTitle>
          Please open and acknowledge each so the school knows you've been informed.
        </Alert>
      )}

      {/* List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : incidents.length === 0 ? (
        <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
          <CardContent>
            <CheckCircle sx={{ fontSize: 56, color: 'success.main', mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              No incidents on file.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You'll see any incidents involving your children here.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {incidents.map((inc) => (
            <ParentIncidentRow
              key={inc._id}
              incident={inc}
              parentEmail={parentEmail}
              onClick={() => setDetail(inc)}
            />
          ))}
        </Stack>
      )}

      {detail && (
        <ParentIncidentDetail
          incident={detail}
          parentEmail={parentEmail}
          onClose={() => setDetail(null)}
          onChanged={(next) => {
            setDetail(next);
            setIncidents((prev) => prev.map((i) => (i._id === next._id ? next : i)));
          }}
        />
      )}
    </Box>
  );
};

const ParentIncidentRow: React.FC<{
  incident: IncidentReport;
  parentEmail?: string;
  onClick: () => void;
}> = ({ incident, parentEmail, onClick }) => {
  const sev = SEVERITY_COLOR[incident.severity];
  const status = STATUS_META[incident.status];

  const myUnack = (incident.parentNotifications || []).some(
    (n) =>
      !n.acknowledged &&
      (parentEmail ? (n.parentEmail || '').toLowerCase() === parentEmail.toLowerCase() : true)
  );

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        cursor: 'pointer',
        borderLeft: `4px solid ${sev.fg}`,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 },
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={sev.label}
            size="small"
            sx={{ bgcolor: sev.bg, color: sev.fg, fontWeight: 700 }}
          />
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
          {myUnack && (
            <Chip
              label="Action needed"
              size="small"
              color="warning"
              sx={{ fontWeight: 700 }}
            />
          )}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 1 }}>
          {incident.reportNumber} —{' '}
          {(incident.studentsInvolved || [])
            .map((s) => studentLabel(s.studentId))
            .join(', ') || '—'}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {incident.description}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <CalendarMonth sx={{ fontSize: 14 }} />
            {new Date(incident.occurredAt).toLocaleString()}
          </Typography>
          {incident.location && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <LocationOn sx={{ fontSize: 14 }} />
              {incident.location}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const ParentIncidentDetail: React.FC<{
  incident: IncidentReport;
  parentEmail?: string;
  onClose: () => void;
  onChanged: (next: IncidentReport) => void;
}> = ({ incident, parentEmail, onClose, onChanged }) => {
  const sev = SEVERITY_COLOR[incident.severity];
  const status = STATUS_META[incident.status];
  const [ackNotes, setAckNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const myNotifications = (incident.parentNotifications || []).filter((n) =>
    parentEmail ? (n.parentEmail || '').toLowerCase() === parentEmail.toLowerCase() : true
  );
  const hasUnack = myNotifications.some((n) => !n.acknowledged);

  const handleAcknowledge = async () => {
    setBusy(true);
    try {
      const res = await apiService.acknowledgeIncident(incident._id, ackNotes || undefined);
      if (res.success && res.data) {
        onChanged(res.data);
        toast.success('Acknowledged. Thank you.');
      } else {
        toast.error(res.error || 'Failed to acknowledge');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {incident.reportNumber}
        <Chip
          label={sev.label}
          size="small"
          sx={{ bgcolor: sev.bg, color: sev.fg, fontWeight: 700 }}
        />
        <Chip
          icon={status.icon}
          label={status.label}
          size="small"
          sx={{ color: status.color, borderColor: status.color, fontWeight: 600 }}
          variant="outlined"
        />
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Row label="When">{new Date(incident.occurredAt).toLocaleString()}</Row>
          <Row label="Location">{incident.location || '—'}</Row>
          <Row label="Type">{TYPE_LABELS[incident.incidentType]}</Row>
          <Row label="Students">
            {(incident.studentsInvolved || [])
              .map((s) => studentLabel(s.studentId))
              .join(', ') || '—'}
          </Row>
          <Row label="Description">{incident.description}</Row>
          <Row label="Immediate action">{incident.immediateAction || '—'}</Row>
          <Row label="First aid">
            {incident.firstAidGiven ? `Yes — ${incident.firstAidDetails || ''}` : 'No'}
          </Row>
          <Row label="Emergency services">
            {incident.emergencyServicesCalled
              ? `Yes — ${incident.emergencyServicesDetails || ''}`
              : 'No'}
          </Row>

          {incident.attachments && incident.attachments.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                Photos
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
                        width: 100,
                        height: 100,
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

          {/* My notifications */}
          {myNotifications.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                Notifications you've received
              </Typography>
              <Stack spacing={0.5}>
                {myNotifications.map((n) => (
                  <Paper key={n._id} variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}>
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
                      {n.acknowledged ? (
                        <Chip
                          size="small"
                          color="success"
                          icon={<CheckCircle fontSize="small" />}
                          label="Acknowledged"
                        />
                      ) : (
                        <Chip size="small" color="warning" label="Awaiting acknowledgment" />
                      )}
                      <Typography variant="caption" sx={{ ml: 'auto' }}>
                        {n.notifiedAt ? new Date(n.notifiedAt).toLocaleString() : ''}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Acknowledge action */}
          {hasUnack && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                borderColor: 'warning.main',
                bgcolor: 'rgba(255,193,7,0.05)',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Acknowledge this incident
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Confirms you've read the incident report. Your acknowledgment is recorded with a
                timestamp.
              </Typography>
              <TextField
                label="Optional notes (for the school)"
                value={ackNotes}
                onChange={(e) => setAckNotes(e.target.value)}
                fullWidth
                size="small"
                multiline
                minRows={2}
                sx={{ mb: 1 }}
              />
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={handleAcknowledge}
                disabled={busy}
              >
                {busy ? 'Acknowledging…' : 'Acknowledge'}
              </Button>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, py: 0.5 }}>
    <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 160 }}>
      {label}
    </Typography>
    <Typography variant="body2" component="div" sx={{ flex: 1 }}>
      {children}
    </Typography>
  </Box>
);

export default ParentIncidents;
