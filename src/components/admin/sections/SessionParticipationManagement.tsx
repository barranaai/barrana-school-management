import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { DeliveredSession } from '../../../services/deliveredSessionService';
import { EligibleParticipant, ParticipationStatus, SessionParticipation, nextParticipationStatuses, participationFailure, participationService } from '../../../services/participationService';

const statusLabel = (status: ParticipationStatus) => status[0].toUpperCase() + status.slice(1);
const actionLabel: Record<ParticipationStatus, string> = { active: 'Mark Active', excused: 'Mark Excused', absent: 'Mark Absent', cancelled: 'Cancel Participation' };

export default function SessionParticipationManagement({ token, schoolId, session, onClose }: { token: string; schoolId: string; session: DeliveredSession; onClose: () => void }) {
  const api = useMemo(() => participationService(token, schoolId, session), [token, schoolId, session]);
  const [rows, setRows] = useState<SessionParticipation[]>([]);
  const [eligible, setEligible] = useState<EligibleParticipant[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState('');
  const [reload, setReload] = useState(0);
  const [action, setAction] = useState<{ row: SessionParticipation; status: ParticipationStatus }>();

  useEffect(() => {
    let active = true; setLoading(true); setError(false); setBlocked(false);
    api.load().then(roster => { if (active) { setRows(roster.participations); setEligible(roster.eligible); setSelected(''); } })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, reload]);
  const refresh = () => { setAction(undefined); setSuccess(''); setError(false); setReload(value => value + 1); };
  async function add() {
    const candidate = eligible.find(item => item.childId === selected);
    if (!candidate || busy || blocked) return;
    setBusy(true); setError(false);
    try { await api.add(candidate); setSuccess('Participant added to this Delivered Session.'); setReload(value => value + 1); }
    catch (_) { setError(true); setBlocked(true); } finally { setBusy(false); }
  }
  async function change() {
    if (!action || busy || blocked) return;
    setBusy(true); setError(false);
    try { await api.changeStatus(action.row, action.status); setAction(undefined); setSuccess('Participation status updated.'); setReload(value => value + 1); }
    catch (_) { setError(true); setBlocked(true); } finally { setBusy(false); }
  }
  const feedback = error && <Alert severity="error">{participationFailure}</Alert>;
  return <Stack spacing={2}>
    <Stack direction="row" spacing={1}><Button onClick={onClose} disabled={busy}>Back to Delivered Sessions</Button><Button onClick={refresh} disabled={loading || busy}>Reload Participants</Button></Stack>
    <Typography variant="h5">{session.title} → Participants</Typography>
    {!action && feedback}{success && <Alert severity="success">{success}</Alert>}
    {loading ? <CircularProgress aria-label="Loading session participants" /> : <>
      <Paper sx={{ p: 2 }}><Stack spacing={1.5}><Typography variant="h6">Add eligible participant</Typography>
        {!eligible.length ? <Typography>No eligible enrolled children are available to add.</Typography> : <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField select fullWidth label="Eligible child" value={selected} disabled={busy || blocked} onChange={event => setSelected(event.target.value)}>
            {eligible.map(child => <MenuItem key={child.childId} value={child.childId}>{child.firstName} {child.lastName}</MenuItem>)}
          </TextField><Button variant="contained" disabled={!selected || busy || blocked} onClick={add}>Add Participant</Button>
        </Stack>}
        <Typography variant="body2" color="text.secondary">Eligibility is verified by the server from the session, enrollment, class assignment and tenant context.</Typography>
      </Stack></Paper>
      <Typography variant="h6">Current participants</Typography>
      {!rows.length ? <Typography>No children are participating in this Delivered Session yet.</Typography> : rows.map(row => <Paper key={row._id} sx={{ p: 2 }}><Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center"><Typography>{row.firstName || 'Participant'} {row.lastName || ''}</Typography><Chip size="small" label={statusLabel(row.status)} color={row.status === 'active' ? 'success' : row.status === 'cancelled' ? 'default' : 'warning'} /></Stack>
        {!!nextParticipationStatuses[row.status].length && <Stack direction="row" spacing={1} flexWrap="wrap">{nextParticipationStatuses[row.status].map(status => <Button key={status} color={status === 'cancelled' ? 'warning' : 'primary'} disabled={busy || blocked} onClick={() => setAction({ row, status })}>{actionLabel[status]}</Button>)}</Stack>}
        {row.status === 'cancelled' && <Typography variant="body2" color="text.secondary">Cancelled participation is final.</Typography>}
      </Stack></Paper>)}
    </>}
    {blocked && <Alert severity="warning" action={<Button onClick={refresh}>Reload</Button>}>Reload the roster before retrying so the latest server state is used.</Alert>}
    <Dialog open={!!action} onClose={() => { if (!busy) setAction(undefined); }}><DialogTitle>Confirm participation status</DialogTitle><DialogContent>{feedback}<Typography>Change {action?.row.firstName || 'this participant'} to {action ? statusLabel(action.status) : ''}?</Typography>{action?.status === 'cancelled' && <Alert severity="warning">Cancellation is final under the current participation lifecycle.</Alert>}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setAction(undefined)}>Keep current status</Button><Button disabled={busy || blocked} onClick={change}>Confirm</Button></DialogActions></Dialog>
  </Stack>;
}
