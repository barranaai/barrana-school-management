import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { Program } from '../../../services/programService';
import { Level } from '../../../services/levelService';
import { Roadmap } from '../../../services/roadmapService';
import { PlannedObjective, PlannedSession, SessionInput, plannedSessionFailure, plannedSessionService } from '../../../services/plannedSessionService';
import DeliveredSessionManagement from './DeliveredSessionManagement';
interface Context { schoolId: string; program: Program; level: Level; roadmap: Roadmap; }
export default function PlannedSessionManagement(props: Context) {
  const { user, token } = useAuth(); const { schoolId, program, level, roadmap } = props;
  const assigned = typeof user?.schoolId === 'string' ? user.schoolId : (user?.schoolId as any)?._id;
  if (!user || !token || !['school_admin','super_admin'].includes(user.role) || !schoolId || (assigned !== schoolId && user.role !== 'super_admin') || program.schoolId !== schoolId || level.schoolId !== schoolId || level.programId !== program._id || roadmap.schoolId !== schoolId || roadmap.programId !== program._id || roadmap.levelId !== level._id) return <Alert severity="error">Administrator access to this configuration required.</Alert>;
  return <Stack spacing={2}><Typography variant="h5">{program.name} → {level.name} → {roadmap.name} — Version {roadmap.version} → Planned Sessions</Typography><Sessions key={schoolId + roadmap._id + token} {...props} token={token} /></Stack>;
}
type Loaded = Awaited<ReturnType<ReturnType<typeof plannedSessionService>['load']>>;
function Sessions({ roadmap, token, ...context }: Context & { token: string }) {
  const [selectedSession, setSelectedSession] = useState<PlannedSession>();
  const api = useMemo(() => plannedSessionService(token, roadmap), [token, roadmap]);
  const [data, setData] = useState<Loaded>();
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState<{ row?: PlannedSession }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sequence, setSequence] = useState('1');
  const [outcomes, setOutcomes] = useState('');
  const [methodology, setMethodology] = useState('');
  const [objectives, setObjectives] = useState<PlannedObjective[]>([]);
  const [objective, setObjective] = useState<{ index: number; value: PlannedObjective }>();
  const [action, setAction] = useState<{ row: PlannedSession; kind: 'activate' | 'archive' }>();
  useEffect(() => { let active = true; setLoading(true); api.load().then(value => { if (active) { setData(value); setBlocked(false); } }).catch(() => { if (active) { setError(true); setData(undefined); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [api, reload]);
  const unavailable = busy || loading || blocked || !data || data.roadmap.status === 'archived';
  function refresh() { setForm(undefined); setObjective(undefined); setAction(undefined); setError(false); setSuccess(''); setReload(v => v + 1); }
  function open(row?: PlannedSession) {
    setError(false); setSuccess(''); setForm({ row }); setTitle(row?.title || ''); setDescription(row?.description || ''); setSequence(String(row?.sequence ?? Math.max(0, ...(data?.sessions.map(s => s.sequence) || [])) + 1)); setOutcomes((row?.expectedOutcomes || []).join('\n')); setMethodology(row?.methodology || ''); setObjectives((row?.objectives || []).map(o => ({ ...o })));
  }
  function validObjective(o: PlannedObjective) {
    return !!o.title.trim() && o.title.length <= 200 && Number.isInteger(o.sequence) && o.sequence >= 1 && (o.description || '').length <= 5000 && (o.expectedOutcome || '').length <= 5000 && (o.instructionalGuidance || '').length <= 10000 && (!o.requirementId || data?.requirements.some(r => r._id === o.requirementId)) && (!o.parameterId || data?.parameters.some(p => p._id === o.parameterId && p.requirementId === o.requirementId));
  }
  const valid = !!title.trim() && title.length <= 200 && description.length <= 5000 && methodology.length <= 10000 && Number.isInteger(Number(sequence)) && Number(sequence) >= 1 && (!data?.sessions.some(s => s.sequence === Number(sequence) && s._id !== form?.row?._id)) && objectives.every(validObjective) && new Set(objectives.map(o => o.sequence)).size === objectives.length;
  async function save() {
    if (!form || !valid || unavailable) return; setBusy(true);
    try { const input: SessionInput = { title: title.trim(), description, sequence: Number(sequence), methodology, expectedOutcomes: outcomes.split('\n').map(s => s.trim()).filter(Boolean), objectives };
      await api.save(form.row, input); setForm(undefined); setSuccess('Planned Session draft saved.'); setReload(v => v + 1);
    } catch (_) { setError(true); setBlocked(true); } finally { setBusy(false); }
  }
  async function lifecycle() { if (!action || unavailable) return; setBusy(true); try { await api[action.kind](action.row); setAction(undefined); setSuccess('Session ' + (action.kind === 'activate' ? 'activated.' : 'archived.')); setReload(v => v + 1); } catch (_) { setError(true); setBlocked(true); } finally { setBusy(false); } }
  const feedback = error && <Alert severity="error">{plannedSessionFailure}{blocked && <Button onClick={refresh} disabled={busy}>Reload and discard unsaved changes</Button>}</Alert>;
  const requirementName = (id?: string | null) => id ? data?.requirements.find(r => r._id === id)?.name || 'Unavailable Requirement' : 'None';
  const parameterName = (id?: string | null) => id ? data?.parameters.find(p => p._id === id)?.name || 'Unavailable Parameter' : 'None';
  if (selectedSession) return <DeliveredSessionManagement {...context} roadmap={roadmap} plannedSession={selectedSession} onBack={() => setSelectedSession(undefined)} />;
  return <Stack spacing={2}>
    {!form && !action && feedback}{success && <Alert severity="success">{success}</Alert>}
    <Button disabled={busy || loading} onClick={refresh}>Reload Sessions</Button>
    {loading && <CircularProgress aria-label="Loading Sessions" />}
    {data?.roadmap.status !== 'active' && data && <Alert severity="info">{data.roadmap.status === 'archived' ? 'The API does not list sessions for archived Roadmaps.' : 'Activate the Roadmap before adding a Planned Session.'}</Alert>}
    <Button variant="contained" disabled={unavailable || data?.roadmap.status !== 'active'} onClick={() => open()}>Add Planned Session</Button>
    {!loading && data?.sessions.length === 0 && <Typography>No available Planned Sessions.</Typography>}
    {!loading && data?.sessions.map(s => <Paper key={s._id} sx={{ p: 2 }}><Stack spacing={1}><Typography variant="h6">{s.sequence}. {s.title}</Typography><Chip label={s.status} /><Typography>{s.description}</Typography><Typography>Expected Outcomes: {s.expectedOutcomes.join('; ')}</Typography><Typography>Methodology: {s.methodology}</Typography><Typography variant="h6">Objectives ({s.objectives.length})</Typography>
      {[...s.objectives].sort((a,b) => a.sequence - b.sequence).map((o,i) => <Paper key={o._id || i} variant="outlined" sx={{ p: 1 }}><Typography>{o.sequence}. {o.title}</Typography><Typography>{o.description}</Typography><Typography>Expected Outcome: {o.expectedOutcome}</Typography><Typography>Instructional Guidance: {o.instructionalGuidance}</Typography><Typography>Requirement: {requirementName(o.requirementId)} · Parameter: {parameterName(o.parameterId)}</Typography></Paper>)}
      <Stack direction="row" spacing={1}>{s.status === 'draft' && <><Button disabled={unavailable} onClick={() => open(s)}>Edit session / Objectives</Button><Button disabled={unavailable} onClick={() => { setError(false); setAction({ row:s, kind:'activate' }); }}>Activate Session</Button></>}<Button disabled={unavailable} color="warning" onClick={() => { setError(false); setAction({ row:s, kind:'archive' }); }}>Archive Session</Button></Stack>
      <Button disabled={unavailable} onClick={() => setSelectedSession(s)}>Delivered Sessions</Button>
    </Stack></Paper>)}
    <Dialog open={!!form} fullWidth maxWidth="md" onClose={() => { if (!busy) { setForm(undefined); setObjective(undefined); } }}><DialogTitle>{form?.row ? 'Edit Planned Session' : 'Add Planned Session'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt:1 }}>{feedback}
      <TextField label="Title" required value={title} disabled={busy || blocked} onChange={e => setTitle(e.target.value)} inputProps={{ maxLength:200 }} />
      <TextField label="Description" multiline value={description} disabled={busy || blocked} onChange={e => setDescription(e.target.value)} inputProps={{ maxLength:5000 }} />
      <TextField label="Sequence" type="number" value={sequence} disabled={!!form?.row || busy || blocked} onChange={e => setSequence(e.target.value)} inputProps={{ min:1, step:1 }} helperText="A unique positive integer; cannot change after creation." />
      <TextField label="Expected Outcomes" multiline value={outcomes} disabled={busy || blocked} onChange={e => setOutcomes(e.target.value)} helperText="One outcome per line." />
      <TextField label="Methodology" multiline value={methodology} disabled={busy || blocked} onChange={e => setMethodology(e.target.value)} inputProps={{ maxLength:10000 }} />
      <Typography variant="h6">Objectives</Typography><Typography>Objectives are saved with this session draft. Requirement and Parameter links are optional.</Typography>
      {objectives.map((o,index) => ({ o,index })).sort((a,b) => a.o.sequence - b.o.sequence).map(({o,index}) => <Stack key={o._id || index} direction="row" spacing={1}><Typography>{o.sequence}. {o.title}</Typography><Button disabled={busy || blocked} onClick={() => setObjective({ index, value:{...o} })}>Edit Objective</Button></Stack>)}
      <Button disabled={busy || blocked} onClick={() => setObjective({ index:objectives.length, value:{ sequence:Math.max(0,...objectives.map(o => o.sequence))+1,title:'' } })}>Add Objective</Button>
      {!valid && <Typography color="text.secondary">Enter a title, unique positive sequences, and valid objective links before saving.</Typography>}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setForm(undefined)}>Cancel</Button><Button disabled={!valid || unavailable || !!objective} onClick={save}>Save Planned Session</Button></DialogActions></Dialog>
    <Dialog open={!!objective} fullWidth maxWidth="sm" onClose={() => setObjective(undefined)}><DialogTitle>{objective && objective.index < objectives.length ? 'Edit Objective' : 'Add Objective'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt:1 }}>
      {objective && <>
        <TextField label="Objective title" required value={objective.value.title} onChange={e => setObjective({...objective,value:{...objective.value,title:e.target.value}})} inputProps={{maxLength:200}} />
        <TextField label="Objective sequence" type="number" value={objective.value.sequence || ''} onChange={e => setObjective({...objective,value:{...objective.value,sequence:Number(e.target.value)}})} inputProps={{min:1,step:1}} />
        {(['description','expectedOutcome','instructionalGuidance'] as const).map((key,i) => <TextField key={key} label={['Objective description','Expected Outcome','Instructional Guidance'][i]} multiline value={objective.value[key] || ''} onChange={e => setObjective({...objective,value:{...objective.value,[key]:e.target.value}})} inputProps={{maxLength:key === 'instructionalGuidance' ? 10000 : 5000}} />)}
        <TextField select SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} label="Requirement" value={objective.value.requirementId || ''} onChange={e => setObjective({...objective,value:{...objective.value,requirementId:e.target.value || null,parameterId:null}})}><MenuItem value="">None</MenuItem>{data?.requirements.map(r => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}</TextField>
        <TextField select SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} label="Parameter" disabled={!objective.value.requirementId} value={objective.value.parameterId || ''} onChange={e => setObjective({...objective,value:{...objective.value,parameterId:e.target.value || null}})}><MenuItem value="">None</MenuItem>{data?.parameters.filter(p => p.requirementId === objective.value.requirementId).map(p => <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>)}</TextField>
      </>}
    </Stack></DialogContent><DialogActions><Button onClick={() => setObjective(undefined)}>Cancel Objective</Button><Button disabled={!objective || !validObjective(objective.value) || objectives.some((o,i) => i !== objective.index && o.sequence === objective.value.sequence)} onClick={() => { if (objective) { setObjectives(current => { const next=[...current]; next[objective.index]=objective.value; return next; }); setObjective(undefined); } }}>Apply Objective</Button></DialogActions></Dialog>
    <Dialog open={!!action} onClose={() => { if (!busy) setAction(undefined); }}><DialogTitle>Confirm {action?.kind}</DialogTitle><DialogContent>{feedback}<Typography>{action?.row.title}</Typography><Typography>{action?.kind === 'activate' ? 'Activation makes the session and its objectives read-only.' : 'Archive this session? The record is retained but no longer listed.'}</Typography></DialogContent><DialogActions><Button disabled={busy} onClick={() => setAction(undefined)}>Cancel</Button><Button disabled={unavailable} onClick={lifecycle}>Confirm session operation</Button></DialogActions></Dialog>
  </Stack>;
}
