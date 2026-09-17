import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { Program } from '../../../services/programService';
import { Level } from '../../../services/levelService';
import { Roadmap, RoadmapError, RoadmapInput, roadmapFailure, roadmapService } from '../../../services/roadmapService';
import PlannedSessionManagement from './PlannedSessionManagement';
interface Context { schoolId: string; program: Program; level: Level; }
const dateInput = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString().slice(0, 16) : '';
const iso = (value: string) => value ? new Date(value + ':00Z').toISOString() : undefined;
const validDate = (value: string) => !value || Number.isFinite(Date.parse(value + ':00Z'));
export default function RoadmapManagement(props: Context) {
  const { user, token } = useAuth();
  const { schoolId, program, level } = props;
  const assigned = typeof user?.schoolId === 'string' ? user.schoolId : (user?.schoolId as any)?._id;
  if (!user || !token || !['school_admin', 'super_admin'].includes(user.role) || !schoolId || program.schoolId !== schoolId || level.schoolId !== schoolId || level.programId !== program._id || (user.role === 'school_admin' && assigned !== schoolId)) return <Alert severity="error">Administrator access to this configuration required.</Alert>;
  return <Stack spacing={2}><Typography variant="h5">{program.name} → {level.name} → Roadmaps</Typography><Roadmaps key={schoolId + level._id + token} {...props} token={token} /></Stack>;
}
function Roadmaps({ schoolId, program, level, token }: Context & { token: string }) {
  const api = useMemo(() => roadmapService(token, schoolId, program._id, level._id), [token, schoolId, program._id, level._id]);
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap>();
  const [rows, setRows] = useState<Roadmap[]>([]);
  const [reload, setReload] = useState(0);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [form, setForm] = useState<{ row?: Roadmap }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [methodology, setMethodology] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [action, setAction] = useState<{ kind: 'activate' | 'deactivate' | 'version'; row: Roadmap; predecessor?: Roadmap }>();
  const [actionDate, setActionDate] = useState('');
  useEffect(() => { let active = true; setLoading(true); setReady(false);
    api.list().then(data => { if (active) { setRows(data); setReady(true); setBlocked(false); } }).catch(() => { if (active) setError(roadmapFailure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, reload]);
  const unavailable = busy || loading || !ready || blocked;
  function refresh() { setForm(undefined); setAction(undefined); setError(''); setSuccess(''); setReload(v => v + 1); }
  function open(row?: Roadmap) { setError(''); setSuccess(''); setForm({ row }); setName(row?.name || ''); setDescription(row?.description || ''); setMethodology(row?.methodology || ''); setFrom(dateInput(row?.effectiveFrom)); setTo(dateInput(row?.effectiveTo)); }
  function failed(e: unknown) { setError(e instanceof RoadmapError ? e.message : roadmapFailure); setBlocked(true); }
  const valid = !!name.trim() && name.trim().length <= 200 && description.length <= 5000 && methodology.length <= 10000 && validDate(from) && validDate(to) && (!from || !to || to >= from);
  async function save() {
    if (!form || !valid || unavailable) return;
    setBusy(true);
    try {
      const input: RoadmapInput = { name, description, methodology, effectiveFrom: from ? iso(from) : form.row ? null : undefined, ...(form.row ? { effectiveTo: to ? iso(to) : null } : {}) };
      if (form.row) await api.edit(form.row, input); else await api.create(input);
      setForm(undefined); setSuccess('Roadmap draft saved.'); setReload(v => v + 1);
    } catch (e) { failed(e); } finally { setBusy(false); }
  }
  function confirm(kind: 'activate' | 'deactivate' | 'version', row: Roadmap) {
    setError(''); setSuccess(''); setAction({ kind, row, predecessor: rows.find(r => r.status === 'active') });
    setActionDate(dateInput(kind === 'activate' && row.effectiveFrom ? row.effectiveFrom : new Date().toISOString()));
  }
  const minimum = action?.kind === 'activate' ? action.predecessor?.effectiveFrom : action?.row.effectiveFrom;
  const actionDateValid = action?.kind === 'version' || (!!actionDate && validDate(actionDate) && (!minimum || Date.parse(actionDate + ':00Z') >= Date.parse(minimum)));
  async function execute() {
    if (!action || unavailable || !actionDateValid) return;
    setBusy(true);
    try {
      if (action.kind === 'activate') await api.activate(action.row, action.predecessor, iso(actionDate)!);
      else if (action.kind === 'deactivate') await api.deactivate(action.row, iso(actionDate)!);
      else await api.version(action.row);
      setAction(undefined); setSuccess('Roadmap operation completed.'); setReload(v => v + 1);
    } catch (e) { failed(e); } finally { setBusy(false); }
  }
  const feedback = error && <Alert severity="error">{error}{blocked && <Button disabled={busy} onClick={refresh}>Reload and discard unsaved changes</Button>}</Alert>;
  if (selectedRoadmap) return <Stack spacing={2}><Button onClick={() => { setSelectedRoadmap(undefined); refresh(); }}>Back to Roadmaps</Button><PlannedSessionManagement schoolId={schoolId} program={program} level={level} roadmap={selectedRoadmap} /></Stack>;
  return <Stack spacing={2}>
    <Typography>Draft, active, and archived versions for this Level. Dates are shown and entered in UTC.</Typography>
    {!form && !action && feedback}{success && <Alert severity="success">{success}</Alert>}
    <Stack direction="row" spacing={2}><Button variant="contained" disabled={unavailable} onClick={() => open()}>Add Roadmap</Button><Button disabled={busy || loading} onClick={refresh}>Reload Roadmaps</Button></Stack>
    {loading ? <CircularProgress aria-label="Loading Roadmaps" /> : ready && rows.length === 0 ? <Typography>No Roadmaps yet.</Typography> : ready && rows.map(row => <Paper key={row._id} sx={{ p: 2 }}><Stack spacing={1}>
      <Typography variant="h6">{row.name} — Version {row.version}</Typography><Chip label={row.status} /><Typography>{row.description}</Typography><Typography>{row.methodology}</Typography>
      <Typography>Effective From: {row.effectiveFrom || 'Not set'} · Effective To: {row.effectiveTo || 'Not set'}</Typography>
      <Stack direction="row" spacing={1}><Button disabled={unavailable} onClick={() => setSelectedRoadmap(row)}>Planned Sessions</Button>{row.status === 'draft' && <><Button disabled={unavailable} onClick={() => open(row)}>Edit draft</Button><Button disabled={unavailable} onClick={() => confirm('activate', row)}>Activate</Button></>}
        {row.version === Math.max(...rows.map(r => r.version)) && <Button disabled={unavailable} onClick={() => confirm('version', row)}>New version</Button>}
        {row.status === 'active' && <Button color="warning" disabled={unavailable} onClick={() => confirm('deactivate', row)}>Archive</Button>}
      </Stack></Stack></Paper>)}
    <Dialog open={!!form} fullWidth maxWidth="sm" onClose={() => { if (!busy) setForm(undefined); }}><DialogTitle>{form?.row ? 'Edit Roadmap draft' : 'Add Roadmap'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{feedback}
      <TextField label="Name" required value={name} disabled={busy || blocked} onChange={e => setName(e.target.value)} inputProps={{ maxLength: 200 }} />
      <TextField label="Description" multiline value={description} disabled={busy || blocked} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength: 5000 }} />
      <TextField label="Methodology" multiline value={methodology} disabled={busy || blocked} onChange={e => setMethodology(e.target.value)} inputProps={{ maxLength: 10000 }} />
      <TextField label="Effective From (UTC)" type="datetime-local" InputLabelProps={{ shrink: true }} value={from} disabled={busy || blocked} onChange={e => setFrom(e.target.value)} />
      {form?.row && <TextField label="Effective To (UTC)" type="datetime-local" InputLabelProps={{ shrink: true }} value={to} disabled={busy || blocked} onChange={e => setTo(e.target.value)} helperText="Must not precede Effective From. Activation clears this date." />}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setForm(undefined)}>Cancel</Button><Button disabled={!valid || unavailable} onClick={save}>Save draft</Button></DialogActions></Dialog>
    <Dialog open={!!action} onClose={() => { if (!busy) setAction(undefined); }}><DialogTitle>Confirm Roadmap {action?.kind}</DialogTitle><DialogContent><Stack spacing={2}>{feedback}
      <Typography>{action?.row.name} — Version {action?.row.version}</Typography>
      {action?.kind === 'activate' && <Typography>{action.predecessor ? `This archives ${action.predecessor.name}, version ${action.predecessor.version}, and activates this draft.` : 'This activates the first active Roadmap for this Program and Level.'}</Typography>}
      {action?.kind === 'deactivate' && <Typography>This archives the active Roadmap. Its record remains available in history.</Typography>}
      {action?.kind === 'version' ? <Typography>Create the next draft version from this Roadmap using the existing backend version operation. This does not activate it.</Typography> : <TextField label={action?.kind === 'activate' ? 'Activation date (UTC)' : 'Archive date (UTC)'} type="datetime-local" InputLabelProps={{ shrink: true }} value={actionDate} disabled={busy || blocked} onChange={e => setActionDate(e.target.value)} helperText="Must not precede the current active Roadmap’s start date." />}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setAction(undefined)}>Cancel</Button><Button disabled={unavailable || !actionDateValid} onClick={execute}>Confirm operation</Button></DialogActions></Dialog>
  </Stack>;
}
