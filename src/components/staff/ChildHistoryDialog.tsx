import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Paper, Stack, Typography
} from '@mui/material';
import { History, School, Event, TrendingUp, Description, SwapHoriz } from '@mui/icons-material';
import { ChildHistoryData, ChildHistoryEvent, getChildHistory } from '../../services/childHistoryService';

type Props = {
  open: boolean;
  childId?: string;
  schoolId?: string;
  onClose: () => void;
  loadHistory?: typeof getChildHistory;
};

const label = (value?: string | null) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()) : 'Not available';
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric'
}) : 'Date unavailable';

const iconFor = (type: ChildHistoryEvent['type']) => {
  if (type === 'session') return <Event fontSize="small" />;
  if (type === 'progress') return <TrendingUp fontSize="small" />;
  if (type === 'report') return <Description fontSize="small" />;
  if (type === 'level' || type === 'group' || type === 'enrollment_status') return <SwapHoriz fontSize="small" />;
  return <School fontSize="small" />;
};

function EventDetails({ item }: { item: ChildHistoryEvent }) {
  const details = item.details || {};
  if (item.type === 'progress') return <Stack spacing={1}>
    <Typography variant="body2">Overall status: {label(details.overallStatus)}</Typography>
    {(details.objectiveResults || []).map((result: any, index: number) => <Box key={`${result.objectiveId || index}`}>
      <Typography variant="body2" fontWeight={600}>{result.title || `Objective ${index + 1}`}: {label(result.status)}</Typography>
      {result.instructorNote && <Typography variant="body2" color="text.secondary">{result.instructorNote}</Typography>}
    </Box>)}
    {(details.parameterResults || []).map((result: any, index: number) => <Typography key={`${result.parameterId || index}`} variant="body2">
      {result.requirementLabel ? `${result.requirementLabel} — ` : ''}{result.parameterLabel || `Measurement ${index + 1}`}: {String(result.value)}
    </Typography>)}
    {details.observations && <Typography variant="body2"><strong>Observations:</strong> {details.observations}</Typography>}
    {details.recommendations && <Typography variant="body2"><strong>Recommendations:</strong> {details.recommendations}</Typography>}
  </Stack>;
  if (item.type === 'session') return <Typography variant="body2" color="text.secondary">
    {[details.program?.name, details.level?.name, details.group?.name, details.instructor?.name].filter(Boolean).join(' · ')}
    {details.participationStatus ? ` · Participation: ${label(details.participationStatus)}` : ''}
  </Typography>;
  if (item.type === 'report') return <Typography variant="body2" color="text.secondary">
    {label(details.reportType)} · Status: {label(details.status)}
    {details.finalizedAt ? ` · Finalized ${dateLabel(details.finalizedAt)}` : ''}
  </Typography>;
  return <Typography variant="body2" color="text.secondary">
    {[details.program?.name, details.level?.name, details.group?.name, details.status && label(details.status), details.reason].filter(Boolean).join(' · ')}
  </Typography>;
}

const ChildHistoryDialog: React.FC<Props> = ({ open, childId, schoolId, onClose, loadHistory = getChildHistory }) => {
  const [data, setData] = useState<ChildHistoryData>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!open || !childId) return () => { active = false; };
    setLoading(true); setError(''); setData(undefined);
    loadHistory(childId, schoolId)
      .then(result => { if (active) setData(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Participant history could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, childId, schoolId, loadHistory]);

  const name = useMemo(() => data ? `${data.child.firstName} ${data.child.lastName}` : 'Participant History', [data]);
  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth aria-labelledby="child-history-title">
    <DialogTitle id="child-history-title"><Stack direction="row" spacing={1} alignItems="center"><History /><span>{name}</span></Stack></DialogTitle>
    <DialogContent dividers sx={{ minHeight: 360 }}>
      {loading && <Stack alignItems="center" spacing={2} sx={{ py: 8 }}><CircularProgress aria-label="Loading participant history" /><Typography>Loading history…</Typography></Stack>}
      {!loading && error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && data && <Stack spacing={3}>
        <Box>
          <Typography variant="h6">Current enrollment</Typography>
          {data.currentEnrollments.length === 0 ? <Typography color="text.secondary">No current enrollment.</Typography> :
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>{data.currentEnrollments.map(row => <Chip key={row.enrollmentId}
              label={[row.program?.name, row.level?.name, row.group?.name, label(row.status)].filter(Boolean).join(' · ')} />)}</Stack>}
        </Box>
        <Divider />
        <Box>
          <Typography variant="h6" gutterBottom>History</Typography>
          {data.events.length === 0 ? <Alert severity="info">No history is available for this participant yet.</Alert> :
            <Stack spacing={2}>{data.events.map((item, index) => <Paper key={`${item.type}-${item.date}-${index}`} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ color: 'primary.main', pt: 0.25 }}>{iconFor(item.type)}</Box>
                <Box sx={{ flex: 1 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box><Typography fontWeight={700}>{item.title}</Typography><Typography>{item.description}</Typography></Box>
                    <Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={label(item.type)} /><Typography variant="caption" color="text.secondary">{dateLabel(item.date)}</Typography></Stack>
                  </Stack>
                  <Box sx={{ mt: 1 }}><EventDetails item={item} /></Box>
                </Box>
              </Stack>
            </Paper>)}</Stack>}
        </Box>
      </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Back to participants</Button></DialogActions>
  </Dialog>;
};

export default ChildHistoryDialog;
