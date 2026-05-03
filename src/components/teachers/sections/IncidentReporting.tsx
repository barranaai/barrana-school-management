/**
 * IncidentReporting (Teacher)
 *
 * Two surfaces in one page:
 *   1. A header card with a "Report Incident" CTA + summary chips
 *   2. A list of incidents the teacher has filed
 *
 * The CTA opens a multi-step wizard (What → Who → Response → Review-Submit)
 * tuned for the "60-second emergency capture" north star: only the truly
 * required fields are mandatory in step 1; everything else is progressive.
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
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  AlertTitle,
} from '@mui/material';
import {
  ReportProblem,
  Add,
  Refresh,
  CalendarMonth,
  LocationOn,
  Visibility,
  HealthAndSafety,
  Lock,
  CheckCircle,
  HourglassTop,
  ChevronRight,
  Close,
  ArrowBack,
  ArrowForward,
  Send,
  PhotoCamera,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import {
  apiService,
  type IncidentReport,
  type IncidentSeverity,
  type IncidentType,
  type IncidentStatus,
  type Student,
} from '../../../services/apiService';
import { useData } from '../../../contexts/DataContext';

interface Props {
  schoolBranding?: any;
}

// Visual-status presentation for chips
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

// Convert any students prop / studentId reference into a stable display tuple
function studentLabel(stu: any): string {
  if (!stu) return 'Unknown';
  if (typeof stu === 'string') return stu;
  return `${stu.firstName || ''} ${stu.lastName || ''}`.trim() || 'Student';
}

const IncidentReporting: React.FC<Props> = ({ schoolBranding }) => {
  const { students } = useData();
  const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';

  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailIncident, setDetailIncident] = useState<IncidentReport | null>(null);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const res = await apiService.getIncidents({ limit: 100 });
      if (res.success && Array.isArray(res.data)) setIncidents(res.data);
    } catch (err) {
      console.error('Failed to load incidents', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  // Lightweight summary stats for the page header
  const stats = useMemo(() => {
    const acc = { total: incidents.length, open: 0, serious: 0, awaitingAck: 0 };
    incidents.forEach((i) => {
      if (i.status !== 'resolved' && i.status !== 'closed') acc.open += 1;
      if (i.severity === 'serious' || i.severity === 'critical') acc.serious += 1;
      if (i.status === 'parent_notified') acc.awaitingAck += 1;
    });
    return acc;
  }, [incidents]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${primaryColor} 0%, #764ba2 100%)`,
          color: '#fff',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <ReportProblem sx={{ fontSize: 36 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Incident Reporting
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                File and track incidents involving your students. Parents are notified in real time.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1.5}>
              <StatChip label="Total" value={stats.total} />
              <StatChip label="Open" value={stats.open} />
              <StatChip label="Serious+" value={stats.serious} />
              <StatChip label="Awaiting Ack." value={stats.awaitingAck} />
            </Stack>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={() => setWizardOpen(true)}
              sx={{
                bgcolor: '#fff',
                color: primaryColor,
                fontWeight: 700,
                px: 3,
                '&:hover': { bgcolor: '#f5f5f5' },
              }}
            >
              Report Incident
            </Button>
            <IconButton
              onClick={loadIncidents}
              sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }}
              title="Refresh"
            >
              <Refresh />
            </IconButton>
          </Box>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : incidents.length === 0 ? (
        <EmptyState onAdd={() => setWizardOpen(true)} primaryColor={primaryColor} />
      ) : (
        <Stack spacing={1.5}>
          {incidents.map((inc) => (
            <IncidentRow key={inc._id} incident={inc} onClick={() => setDetailIncident(inc)} />
          ))}
        </Stack>
      )}

      {/* Wizard */}
      {wizardOpen && (
        <ReportIncidentWizard
          students={students as unknown as Student[]}
          onClose={() => setWizardOpen(false)}
          onSubmitted={() => {
            setWizardOpen(false);
            loadIncidents();
            toast.success('Incident reported and admins notified.');
          }}
        />
      )}

      {/* Detail */}
      {detailIncident && (
        <IncidentDetailDialog
          incident={detailIncident}
          onClose={() => setDetailIncident(null)}
          onChanged={(next) => {
            setDetailIncident(next);
            setIncidents((prev) => prev.map((i) => (i._id === next._id ? next : i)));
          }}
        />
      )}
    </Box>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────

const StatChip: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <Box
    sx={{
      px: 2,
      py: 0.75,
      borderRadius: 2,
      background: 'rgba(255,255,255,0.18)',
      backdropFilter: 'blur(6px)',
      textAlign: 'center',
      minWidth: 88,
    }}
  >
    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
      {value}
    </Typography>
    <Typography variant="caption" sx={{ opacity: 0.85 }}>
      {label}
    </Typography>
  </Box>
);

const EmptyState: React.FC<{ onAdd: () => void; primaryColor: string }> = ({ onAdd, primaryColor }) => (
  <Card sx={{ borderRadius: 3, textAlign: 'center', py: 6 }}>
    <CardContent>
      <HealthAndSafety sx={{ fontSize: 56, color: primaryColor, mb: 1 }} />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        No incidents reported yet.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        When you file an incident, it appears here. Parents and admins are notified instantly.
      </Typography>
      <Button variant="contained" startIcon={<Add />} onClick={onAdd}>
        Report Your First Incident
      </Button>
    </CardContent>
  </Card>
);

const IncidentRow: React.FC<{ incident: IncidentReport; onClick: () => void }> = ({
  incident,
  onClick,
}) => {
  const sev = SEVERITY_COLOR[incident.severity];
  const status = STATUS_META[incident.status];
  const studentNames = (incident.studentsInvolved || [])
    .map((s) => studentLabel(s.studentId))
    .filter(Boolean)
    .join(', ');
  const occurredAt = new Date(incident.occurredAt);

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: 4 },
      }}
    >
      <CardContent sx={{ py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
          {incident.isLocked && (
            <Chip
              icon={<Lock fontSize="small" />}
              label="Locked"
              size="small"
              color="warning"
              sx={{ fontWeight: 600 }}
            />
          )}
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
                {occurredAt.toLocaleString()}
              </Typography>
              {incident.location && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationOn sx={{ fontSize: 14 }} />
                  {incident.location}
                </Typography>
              )}
            </Box>
          </Box>
          <ChevronRight color="action" />
        </Box>
      </CardContent>
    </Card>
  );
};

// ─── Wizard ───────────────────────────────────────────────────────────

interface WizardProps {
  students: Student[];
  onClose: () => void;
  onSubmitted: () => void;
}

const STEPS = ['What happened', 'Who was involved', 'Response', 'Review & submit'];

const ReportIncidentWizard: React.FC<WizardProps> = ({ students, onClose, onSubmitted }) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [createdIncident, setCreatedIncident] = useState<IncidentReport | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Form state — kept flat for simplicity
  const [occurredAt, setOccurredAt] = useState<string>(() => {
    const d = new Date();
    // datetime-local format: YYYY-MM-DDTHH:mm
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [location, setLocation] = useState('');
  const [incidentType, setIncidentType] = useState<IncidentType>('injury');
  const [severity, setSeverity] = useState<IncidentSeverity>('minor');
  const [description, setDescription] = useState('');

  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});

  const [immediateAction, setImmediateAction] = useState('');
  const [firstAidGiven, setFirstAidGiven] = useState(false);
  const [firstAidDetails, setFirstAidDetails] = useState('');
  const [emergencyServicesCalled, setEmergencyServicesCalled] = useState(false);
  const [emergencyServicesDetails, setEmergencyServicesDetails] = useState('');
  const [notifyParents, setNotifyParents] = useState(true);

  const stepValid = (() => {
    if (step === 0) {
      return (
        Boolean(occurredAt) &&
        Boolean(incidentType) &&
        Boolean(severity) &&
        description.trim().length >= 5
      );
    }
    if (step === 1) {
      return selectedStudentIds.length > 0;
    }
    return true;
  })();

  const handleNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles((prev) => [...prev, ...files].slice(0, 10));
  };

  const handleRemovePending = (idx: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        occurredAt: new Date(occurredAt).toISOString(),
        location: location || undefined,
        incidentType,
        severity,
        description,
        studentsInvolved: selectedStudentIds.map((id) => ({
          studentId: id,
          role: 'affected',
          notes: studentNotes[id] || undefined,
        })),
        immediateAction: immediateAction || undefined,
        firstAidGiven,
        firstAidDetails: firstAidGiven ? firstAidDetails || undefined : undefined,
        emergencyServicesCalled,
        emergencyServicesDetails: emergencyServicesCalled
          ? emergencyServicesDetails || undefined
          : undefined,
      };

      const createRes = await apiService.createIncident(payload as any);
      if (!createRes.success || !createRes.data) {
        toast.error(createRes.error || 'Failed to create incident');
        setSubmitting(false);
        return;
      }
      const incident = createRes.data;
      setCreatedIncident(incident);

      // Upload attachments if any
      if (pendingFiles.length > 0) {
        const upRes = await apiService.uploadIncidentMedia(incident._id, pendingFiles);
        if (!upRes.success) {
          toast.error('Incident saved, but uploading photos failed: ' + (upRes.error || ''));
        }
      }

      // Optionally notify parents now
      if (notifyParents) {
        const notRes = await apiService.notifyParentsOfIncident(incident._id, ['push']);
        if (!notRes.success) {
          toast.error('Saved, but parent notification dispatch failed.');
        }
      }

      onSubmitted();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ReportProblem color="error" />
        Report Incident
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <Stepper activeStep={step}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      <DialogContent dividers>
        {step === 0 && (
          <Stack spacing={2}>
            <Alert severity="warning" icon={<HealthAndSafety />}>
              <AlertTitle sx={{ fontWeight: 700 }}>Quick capture</AlertTitle>
              In an emergency, just fill these required fields and submit. You can add details later.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="When did it happen?"
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Playground, Classroom 2A"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Incident type</InputLabel>
                  <Select
                    label="Incident type"
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                  >
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <MenuItem key={k} value={k}>
                        {v}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    label="Severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  >
                    {(Object.keys(SEVERITY_COLOR) as IncidentSeverity[]).map((s) => (
                      <MenuItem key={s} value={s}>
                        {SEVERITY_COLOR[s].label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="What happened?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  placeholder="Describe the incident in your own words. Be factual."
                  required
                  helperText={`${description.trim().length} / minimum 5 characters`}
                />
              </Grid>
            </Grid>
          </Stack>
        )}

        {step === 1 && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Select the student(s) involved. You can add per-student notes.
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 360, overflowY: 'auto' }}>
              <FormGroup>
                {students.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    No students available.
                  </Typography>
                )}
                {students.map((s: any) => {
                  const id = s._id || s.id;
                  const checked = selectedStudentIds.includes(id);
                  return (
                    <Box key={id} sx={{ borderBottom: '1px solid rgba(0,0,0,0.06)', py: 0.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudentIds((p) => [...p, id]);
                              } else {
                                setSelectedStudentIds((p) => p.filter((x) => x !== id));
                              }
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {s.firstName} {s.lastName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {s.studentClass || s.class || 'No class'} · Grade {s.studentGrade || s.grade || '—'}
                            </Typography>
                          </Box>
                        }
                      />
                      {checked && (
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="Per-student note (optional)"
                          value={studentNotes[id] || ''}
                          onChange={(e) =>
                            setStudentNotes((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                          sx={{ ml: 4, mt: 0.5, width: 'calc(100% - 32px)' }}
                        />
                      )}
                    </Box>
                  );
                })}
              </FormGroup>
            </Paper>
          </Stack>
        )}

        {step === 2 && (
          <Stack spacing={2}>
            <TextField
              label="Immediate action taken"
              value={immediateAction}
              onChange={(e) => setImmediateAction(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              placeholder="e.g. Moved child to safe area, applied ice pack."
            />
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={firstAidGiven}
                    onChange={(e) => setFirstAidGiven(e.target.checked)}
                  />
                }
                label="First aid was given"
              />
              {firstAidGiven && (
                <TextField
                  fullWidth
                  size="small"
                  placeholder="First aid details (e.g. cleaned wound, applied bandage)"
                  value={firstAidDetails}
                  onChange={(e) => setFirstAidDetails(e.target.value)}
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={emergencyServicesCalled}
                    onChange={(e) => setEmergencyServicesCalled(e.target.checked)}
                  />
                }
                label="Emergency services were called"
              />
              {emergencyServicesCalled && (
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Service called and outcome (e.g. 911, ambulance, hospital)"
                  value={emergencyServicesDetails}
                  onChange={(e) => setEmergencyServicesDetails(e.target.value)}
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
            <Divider />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Photos (optional, max 10)
              </Typography>
              <Button component="label" variant="outlined" startIcon={<PhotoCamera />}>
                Add photos
                <input type="file" accept="image/*,video/*" multiple hidden onChange={handleFiles} />
              </Button>
              {pendingFiles.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {pendingFiles.map((f, i) => (
                    <Chip
                      key={`${f.name}-${i}`}
                      label={`${f.name} (${Math.round(f.size / 1024)} KB)`}
                      onDelete={() => handleRemovePending(i)}
                      deleteIcon={<DeleteIcon />}
                    />
                  ))}
                </Stack>
              )}
            </Box>
            <Divider />
            <FormControlLabel
              control={
                <Switch
                  checked={notifyParents}
                  onChange={(e) => setNotifyParents(e.target.checked)}
                />
              }
              label="Notify parents immediately upon submission"
            />
          </Stack>
        )}

        {step === 3 && (
          <Stack spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Review and submit
            </Typography>
            <SummaryRow label="When">{new Date(occurredAt).toLocaleString()}</SummaryRow>
            <SummaryRow label="Location">{location || '—'}</SummaryRow>
            <SummaryRow label="Type">{TYPE_LABELS[incidentType]}</SummaryRow>
            <SummaryRow label="Severity">
              <Chip
                size="small"
                label={SEVERITY_COLOR[severity].label}
                sx={{ bgcolor: SEVERITY_COLOR[severity].bg, color: SEVERITY_COLOR[severity].fg, fontWeight: 700 }}
              />
            </SummaryRow>
            <SummaryRow label="Students">
              {selectedStudentIds.length === 0
                ? '—'
                : selectedStudentIds
                    .map((id) => {
                      const s = students.find((x: any) => (x._id || x.id) === id);
                      return s ? `${(s as any).firstName} ${(s as any).lastName}` : id;
                    })
                    .join(', ')}
            </SummaryRow>
            <SummaryRow label="Description">{description || '—'}</SummaryRow>
            <SummaryRow label="Immediate action">{immediateAction || '—'}</SummaryRow>
            <SummaryRow label="First aid">
              {firstAidGiven ? `Yes — ${firstAidDetails || 'details not provided'}` : 'No'}
            </SummaryRow>
            <SummaryRow label="Emergency services">
              {emergencyServicesCalled
                ? `Yes — ${emergencyServicesDetails || 'details not provided'}`
                : 'No'}
            </SummaryRow>
            <SummaryRow label="Photos">{pendingFiles.length} attached</SummaryRow>
            <SummaryRow label="Notify parents">{notifyParents ? 'Yes (push)' : 'No'}</SummaryRow>
            {createdIncident && (
              <Alert severity="success" icon={<CheckCircle />}>
                Submitted as <strong>{createdIncident.reportNumber}</strong>
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          disabled={step === 0 || submitting}
        >
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            variant="contained"
            endIcon={<ArrowForward />}
            disabled={!stepValid}
            onClick={handleNext}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            color="error"
            startIcon={submitting ? <HourglassTop /> : <Send />}
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? 'Submitting…' : 'Submit Incident'}
          </Button>
        )}
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

// ─── Detail dialog (read-only for teacher) ───────────────────────────

interface DetailProps {
  incident: IncidentReport;
  onClose: () => void;
  onChanged: (next: IncidentReport) => void;
}

const IncidentDetailDialog: React.FC<DetailProps> = ({ incident, onClose }) => {
  const sev = SEVERITY_COLOR[incident.severity];
  const status = STATUS_META[incident.status];

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
        {incident.isLocked && (
          <Chip icon={<Lock fontSize="small" />} label="Locked" size="small" color="warning" />
        )}
        <IconButton onClick={onClose} sx={{ ml: 'auto' }}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <SummaryRow label="When">{new Date(incident.occurredAt).toLocaleString()}</SummaryRow>
          <SummaryRow label="Location">{incident.location || '—'}</SummaryRow>
          <SummaryRow label="Type">{TYPE_LABELS[incident.incidentType]}</SummaryRow>
          <SummaryRow label="Reported by">
            {studentLabel(incident.reportedBy)}
          </SummaryRow>
          <SummaryRow label="Students involved">
            {(incident.studentsInvolved || [])
              .map((s) => studentLabel(s.studentId))
              .join(', ') || '—'}
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
          {incident.parentNotifications && incident.parentNotifications.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1, mb: 0.5 }}>
                Parent notifications
              </Typography>
              <Stack spacing={0.5}>
                {incident.parentNotifications.map((n) => (
                  <Typography variant="caption" color="text.secondary" key={n._id}>
                    [{n.method}] {n.deliveryStatus} —{' '}
                    {n.notifiedAt ? new Date(n.notifiedAt).toLocaleString() : ''}{' '}
                    {n.acknowledged && (
                      <Chip
                        size="small"
                        label="acknowledged"
                        color="success"
                        sx={{ ml: 1, height: 18 }}
                      />
                    )}
                  </Typography>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default IncidentReporting;
