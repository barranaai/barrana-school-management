import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { Program } from '../../../services/programService';
import { Level } from '../../../services/levelService';
import { Roadmap } from '../../../services/roadmapService';
import { PlannedSession } from '../../../services/plannedSessionService';
import { DeliveredSession, DeliveryStatus, deliveredSessionService, deliveredSessionFailure, nextDeliveryStatuses } from '../../../services/deliveredSessionService';

interface Context { schoolId: string; program: Program; level: Level; roadmap: Roadmap; plannedSession: PlannedSession; onBack: () => void; }
const displayDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().replace('T', ' ').replace('.000Z', ' UTC') : 'Not recorded';
const inputDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 16) : '';
const labels: Record<DeliveryStatus, string> = { scheduled: 'scheduled', in_progress: 'in_progress', completed: 'completed', cancelled: 'cancelled' };
const actionLabels: Partial<Record<DeliveryStatus, string>> = { in_progress: 'Start Session', completed: 'Complete Session', cancelled: 'Cancel Session' };

export default function DeliveredSessionManagement(props: Context) {
  const { user, token } = useAuth();
  const { schoolId, program, level, roadmap, plannedSession } = props;
  const assigned = typeof user?.schoolId === 'string' ? user.schoolId : user?.schoolId?._id;
  if (!user || !token || !['school_admin', 'super_admin', 'teacher'].includes(user.role) || !schoolId ||
    (user.role !== 'super_admin' && assigned !== schoolId) || program.schoolId !== schoolId || level.schoolId !== schoolId ||
    level.programId !== program._id || roadmap.schoolId !== schoolId || roadmap.programId !== program._id || roadmap.levelId !== level._id ||
    plannedSession.schoolId !== schoolId || plannedSession.roadmapId !== roadmap._id || plannedSession.roadmapVersion !== roadmap.version) {
    return <Alert severity="error">Authorized school and session context required.</Alert>;
  }
  return <Occurrences key={[token, user._id, schoolId, roadmap._id, plannedSession._id].join(':')} {...props} token={token} userId={user._id} role={user.role} />;
}

type Loaded = Awaited<ReturnType<ReturnType<typeof deliveredSessionService>['load']>>;
function Occurrences({ program, level, roadmap, plannedSession, onBack, token, userId, role }: Context & { token: string; userId: string; role: string }) {
  const api = useMemo(() => deliveredSessionService(token, roadmap, plannedSession._id), [token, roadmap, plannedSession._id]);
  const [data, setData] = useState<Loaded>();
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<{ row?: DeliveredSession }>();
  const [classId, setClassId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [adjustments, setAdjustments] = useState('');
  const [action, setAction] = useState<{ row: DeliveredSession; status: DeliveryStatus }>();
  const [detail, setDetail] = useState<DeliveredSession>();
  useEffect(() => {
    let active = true; setLoading(true); setData(undefined);
    api.load().then(value => { if (active) { setData(value); setBlocked(false); } })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, reload]);
  const disabled = loading || busy || blocked || !data;
  const owns = (row: DeliveredSession) => role !== 'teacher' || row.deliveredBy === userId;
  const className = (id: string) => data?.classes.find(c => c._id === id)?.name || 'Class ID: ' + id;
  function refresh() { setForm(undefined); setAction(undefined); setDetail(undefined); setError(false); setSuccess(''); setReload(n => n + 1); }
  function open(row?: DeliveredSession) {
    setForm({ row }); setClassId(row?.classId || ''); setScheduledAt(inputDate(row?.scheduledAt));
    setNotes(row?.deliveryNotes || ''); setAdjustments(row?.methodologyAdjustments || ''); setSuccess('');
  }
  const valid = !!scheduledAt && Number.isFinite(Date.parse(scheduledAt + ':00Z')) && notes.length <= 10000 && adjustments.length <= 10000 &&
    (!!form?.row || !!data?.classes.some(c => c._id === classId));
  async function save() {
    if (!form || !valid || disabled) return;
    setBusy(true);
    try {
      const input = { scheduledAt: new Date(scheduledAt + ':00Z').toISOString(), deliveryNotes: notes, methodologyAdjustments: adjustments };
      if (form.row) await api.edit(form.row, input); else await api.create(classId, input);
      setForm(undefined); setSuccess('Delivered Session saved.'); setReload(n => n + 1);
    } catch (_) { setError(true); setBlocked(true); } finally { setBusy(false); }
  }
  async function transition() {
    if (!action || disabled) return; setBusy(true);
    try { await api.transition(action.row, action.status); setAction(undefined); setSuccess('Session status updated.'); setReload(n => n + 1); }
    catch (_) { setError(true); setBlocked(true); } finally { setBusy(false); }
  }
  const feedback = error && <Alert severity="error">{deliveredSessionFailure}</Alert>;
  return <Stack spacing={2}>
    <Button disabled={busy} onClick={onBack}>Back to Planned Sessions</Button>
    <Typography variant="h5">{program.name} → {level.name} → {roadmap.name} — Version {roadmap.version} → {data?.planned.title || plannedSession.title} → Delivered Sessions</Typography>
    {!form && !action && feedback}{success && <Alert severity="success">{success}</Alert>}
    <Button disabled={busy || loading} onClick={refresh}>Reload Occurrences</Button>
    {loading && <CircularProgress aria-label="Loading Delivered Sessions" />}
    {data && data.planned.status !== 'active' && <Alert severity="info">An active Planned Session is required to create an occurrence. Existing history remains available.</Alert>}
    <Button variant="contained" disabled={disabled || data?.planned.status !== 'active' || !['active', 'archived'].includes(roadmap.status) || !data?.classes.length} onClick={() => open()}>Add Delivered Session</Button>
    {data && !data.classes.length && <Alert severity="info">No eligible classes are available for this account.</Alert>}
    {data?.rows.length === 0 && <Typography>No Delivered Sessions yet.</Typography>}
    {data?.rows.map(row => <Paper key={row._id} sx={{ p: 2 }}><Stack spacing={1}>
      <Typography variant="h6">{row.title}</Typography><Chip label={labels[row.status] || row.status} />
      <Typography>Class: {className(row.classId)}</Typography>
      <Typography>Delivered By: {row.deliveredBy === userId ? 'You' : 'Staff ID: ' + row.deliveredBy}</Typography>
      <Typography>Scheduled At: {displayDate(row.scheduledAt)}</Typography><Typography>Delivered At: {displayDate(row.deliveredAt)}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>Delivery Notes: {row.deliveryNotes || 'None'}</Typography>
      <Button onClick={() => setDetail(row)}>View planned snapshot</Button>
      {owns(row) && !!nextDeliveryStatuses[row.status]?.length && <Stack direction="row" spacing={1}>
        <Button disabled={disabled} onClick={() => open(row)}>Edit Occurrence</Button>
        {nextDeliveryStatuses[row.status].map(status => <Button key={status} disabled={disabled} color={status === 'cancelled' ? 'warning' : 'primary'} onClick={() => setAction({ row, status })}>{actionLabels[status]}</Button>)}
      </Stack>}
    </Stack></Paper>)}
    <Dialog open={!!form} fullWidth maxWidth="sm" onClose={() => { if (!busy) setForm(undefined); }}><DialogTitle>{form?.row ? 'Edit Occurrence' : 'Add Delivered Session'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{feedback}
      <Typography>Title: {form?.row?.title || data?.planned.title} (from Planned Session)</Typography>
      {form?.row ? <Typography>Class: {className(form.row.classId)}</Typography> : <TextField select label="Class" required value={classId} disabled={busy || blocked} onChange={e => setClassId(e.target.value)}>{data?.classes.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}</TextField>}
      <TextField label="Scheduled At (UTC)" type="datetime-local" required InputLabelProps={{ shrink: true }} value={scheduledAt} disabled={busy || blocked} onChange={e => setScheduledAt(e.target.value)} />
      <TextField label="Delivery Notes" multiline value={notes} disabled={busy || blocked} onChange={e => setNotes(e.target.value)} inputProps={{ maxLength: 10000 }} />
      <TextField label="Methodology Adjustments" multiline value={adjustments} disabled={busy || blocked} onChange={e => setAdjustments(e.target.value)} inputProps={{ maxLength: 10000 }} />
      {!form?.row && <Typography>Attributed to you as the authenticated creator. The server preserves the planned snapshot.</Typography>}
      {blocked && <Button disabled={busy} onClick={refresh}>Reload and discard unsaved changes</Button>}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setForm(undefined)}>Close</Button><Button disabled={disabled || !valid} onClick={save}>Save Delivered Session</Button></DialogActions></Dialog>
    <Dialog open={!!action} onClose={() => { if (!busy) setAction(undefined); }}><DialogTitle>Confirm session status</DialogTitle><DialogContent>{feedback}<Typography>{action?.row.title}: change to {action?.status}?</Typography><Typography>Completed and cancelled occurrences cannot be edited. Records remain in history.</Typography>{blocked && <Button onClick={refresh}>Reload Occurrences</Button>}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setAction(undefined)}>Keep current status</Button><Button disabled={disabled} onClick={transition}>Confirm status change</Button></DialogActions></Dialog>
    <Dialog open={!!detail} onClose={() => setDetail(undefined)} fullWidth maxWidth="sm"><DialogTitle>Planned snapshot</DialogTitle><DialogContent><Stack spacing={1}>
      <Typography>{detail?.plannedSessionSnapshot.title}</Typography><Typography>{detail?.plannedSessionSnapshot.description}</Typography>
      <Typography>Methodology: {detail?.plannedSessionSnapshot.methodology}</Typography><Typography>Expected Outcomes: {detail?.plannedSessionSnapshot.expectedOutcomes.join('; ')}</Typography>
      {detail?.plannedSessionSnapshot.objectives.map((o, i) => <Paper key={o.objectiveId || i} sx={{ p: 1 }}><Typography>{o.sequence}. {o.title}</Typography><Typography>{o.expectedOutcome}</Typography><Typography>{o.requirementLabel} {o.parameterLabel}</Typography></Paper>)}
      <Typography>Historical snapshot — read-only.</Typography>
    </Stack></DialogContent><DialogActions><Button onClick={() => setDetail(undefined)}>Close snapshot</Button></DialogActions></Dialog>
  </Stack>;
}
