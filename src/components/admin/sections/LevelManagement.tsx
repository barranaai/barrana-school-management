import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { Program } from '../../../services/programService';
import { Level, levelService } from '../../../services/levelService';
import RoadmapManagement from './RoadmapManagement';
import RequirementParameterManagement from './RequirementParameterManagement';
const failure = 'Unable to complete the request. Check your access and connection, then refresh before retrying.';
export default function LevelManagement({ program, schoolId }: { program: Program; schoolId: string }) {
  const { user, token } = useAuth();
  const assignedSchool = typeof user?.schoolId === 'string' ? user.schoolId : (user?.schoolId as any)?._id;
  if (!user || !token || !['school_admin', 'super_admin'].includes(user.role) || !schoolId || program.schoolId !== schoolId || (user.role === 'school_admin' && assignedSchool !== schoolId)) return <Alert severity="error">Administrator access to this school required.</Alert>;
  return <Stack spacing={2}><Typography variant="h5">Levels — {program.name}</Typography><Levels key={schoolId + program._id + token} token={token} schoolId={schoolId} program={program} /></Stack>;
}
function Levels({ token, schoolId, program }: { token: string; schoolId: string; program: Program }) {
  const api = useMemo(() => levelService(token, schoolId, program._id), [token, schoolId, program._id]);
  const [roadmapLevel, setRoadmapLevel] = useState<Level>();
  const [selectedLevel, setSelectedLevel] = useState<Level>();
  const [rows, setRows] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Level>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('0');
  const [busy, setBusy] = useState(false);
  const [deactivating, setDeactivating] = useState<Level>();
  useEffect(() => {
    let active = true; setLoading(true); setReady(false);
    api.list().then(data => {
      if (!data.every(p => p.schoolId === schoolId && p.programId === program._id)) throw new Error();
      if (active) { setRows(data); setReady(true); }
    }).catch(() => { if (active) setError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, schoolId, program._id, refresh]);
  function open(program?: Level) { setEditing(program); setName(program?.name || ''); setDescription(program?.description || ''); setOrder(String(program?.sequence ?? 0)); setError(''); setSuccess(''); setDialog(true); }
  const valid = !!name.trim() && !!order.trim() && Number.isFinite(Number(order));
  async function save() {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await api.save(editing?._id, { name, description, sequence: Number(order) }); setDialog(false); setSuccess(editing ? 'Level updated.' : 'Level created.'); setRefresh(v => v + 1); }
    catch (_) { setError(failure); } finally { setBusy(false); }
  }
  async function deactivate() {
    if (!deactivating || busy) return;
    setBusy(true); setError('');
    try { await api.deactivate(deactivating._id); setDeactivating(undefined); setSuccess('Level deactivated.'); setRefresh(v => v + 1); }
    catch (_) { setError(failure); } finally { setBusy(false); }
  }
  if (roadmapLevel) return <Stack spacing={2}><Button onClick={() => { setRoadmapLevel(undefined); setRefresh(v => v + 1); }}>Back to Levels</Button><RoadmapManagement schoolId={schoolId} program={program} level={roadmapLevel} /></Stack>;
  if (selectedLevel) return <Stack spacing={2}><Button onClick={() => { setSelectedLevel(undefined); setRefresh(v => v + 1); }}>Back to Levels</Button><RequirementParameterManagement schoolId={schoolId} program={program} level={selectedLevel} /></Stack>;
  return <Stack spacing={2}>
    <Typography>Configure the Levels belonging to this Program. Only active Levels are listed.</Typography>
    {error && !dialog && !deactivating && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}
    <Stack direction="row" spacing={2}><Button variant="contained" disabled={!ready || loading || busy} onClick={() => open()}>Add Level</Button><Button disabled={loading || busy} onClick={() => { setError(''); setRefresh(v => v + 1); }}>Refresh</Button></Stack>
    {loading ? <CircularProgress aria-label="Loading Levels" /> : ready && rows.length === 0 ? <Typography>No active Levels. Add your first Level.</Typography> : ready && rows.map(p => <Paper key={p._id} sx={{ p: 2 }}><Stack spacing={1}><Typography variant="h6">{p.name}</Typography><Typography>{p.description}</Typography><Typography>Sequence: {p.sequence}</Typography><Stack direction="row" spacing={1}><Button disabled={busy} onClick={() => setSelectedLevel(p)}>Requirements</Button><Button disabled={busy} onClick={() => setRoadmapLevel(p)}>Roadmaps</Button><Button disabled={busy} onClick={() => open(p)} aria-label={'Edit ' + p.name}>Edit</Button><Button color="warning" disabled={busy} onClick={() => { setError(''); setSuccess(''); setDeactivating(p); }} aria-label={'Deactivate ' + p.name}>Deactivate</Button></Stack></Stack></Paper>)}
    <Dialog open={dialog} onClose={() => { if (!busy) setDialog(false); }} fullWidth maxWidth="sm"><DialogTitle>{editing ? 'Edit Level' : 'Add Level'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<TextField label="Level name" required value={name} onChange={e => setName(e.target.value)} disabled={busy} /><TextField label="Description" multiline value={description} onChange={e => setDescription(e.target.value)} disabled={busy} /><TextField label="Sequence" type="number" value={order} onChange={e => setOrder(e.target.value)} disabled={busy} helperText="Lower sequence numbers appear first." /></Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setDialog(false)}>Cancel</Button><Button variant="contained" disabled={!valid || busy} onClick={save}>Save Level</Button></DialogActions></Dialog>
    <Dialog open={!!deactivating} onClose={() => { if (!busy) setDeactivating(undefined); }}><DialogTitle>Deactivate Level</DialogTitle><DialogContent>{error && <Alert severity="error">{error}</Alert>}Deactivate {deactivating?.name}? It will no longer appear in the active Level list. Existing records are retained.</DialogContent><DialogActions><Button disabled={busy} onClick={() => setDeactivating(undefined)}>Cancel</Button><Button color="warning" disabled={busy} onClick={deactivate}>Confirm deactivation</Button></DialogActions></Dialog>
  </Stack>;
}
