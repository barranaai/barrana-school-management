import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { Program, ProgramSchool, programService } from '../../../services/programService';

import LevelManagement from './LevelManagement';

const failure = 'Unable to complete the request. Check your access and connection, then refresh before retrying.';
export default function ProgramManagement() {
  const { user, token } = useAuth();
  if (!user || !token || !['school_admin', 'super_admin'].includes(user.role)) return <Alert severity="error">Administrator access required.</Alert>;
  const school = typeof user.schoolId === 'string' ? user.schoolId : (user.schoolId as any)?._id || '';
  return <ProgramScope key={user._id + token + school} token={token} role={user.role} schoolId={school} />;
}
function ProgramScope({ token, role, schoolId }: { token: string; role: string; schoolId: string }) {
  const [selected, setSelected] = useState(role === 'super_admin' ? '' : schoolId);
  const [schools, setSchools] = useState<ProgramSchool[]>([]);
  const [error, setError] = useState(false);
  const api = useMemo(() => programService(token, ''), [token]);
  useEffect(() => { let active = true; if (role === 'super_admin') api.schools().then(rows => { if (active) setSchools(rows); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [api, role]);
  return <Stack spacing={2} sx={{ py: 3 }}>
    <Typography variant="h4">Program Management</Typography>
    {error && <Alert severity="error">{failure}</Alert>}
    {role === 'super_admin' && <TextField select label="School" value={selected} onChange={e => setSelected(e.target.value)}><MenuItem value="">Choose a school</MenuItem>{schools.map(s => <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>)}</TextField>}
    {selected ? <Programs key={selected + token} token={token} schoolId={selected} /> : <Alert severity="info">Choose a school to manage Programs.</Alert>}
  </Stack>;
}
function Programs({ token, schoolId }: { token: string; schoolId: string }) {
  const api = useMemo(() => programService(token, schoolId), [token, schoolId]);
  const [selectedProgram, setSelectedProgram] = useState<Program>();
  const [rows, setRows] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Program>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('0');
  const [busy, setBusy] = useState(false);
  const [deactivating, setDeactivating] = useState<Program>();
  useEffect(() => {
    let active = true; setLoading(true); setReady(false);
    api.list().then(data => {
      if (!data.every(p => p.schoolId === schoolId)) throw new Error();
      if (active) { setRows(data); setReady(true); }
    }).catch(() => { if (active) setError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, schoolId, refresh]);
  function open(program?: Program) { setEditing(program); setName(program?.name || ''); setDescription(program?.description || ''); setOrder(String(program?.displayOrder ?? 0)); setError(''); setSuccess(''); setDialog(true); }
  const valid = !!name.trim() && !!order.trim() && Number.isFinite(Number(order));
  async function save() {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await api.save(editing?._id, { name, description, displayOrder: Number(order) }); setDialog(false); setSuccess(editing ? 'Program updated.' : 'Program created.'); setRefresh(v => v + 1); }
    catch (_) { setError(failure); } finally { setBusy(false); }
  }
  async function deactivate() {
    if (!deactivating || busy) return;
    setBusy(true); setError('');
    try { await api.deactivate(deactivating._id); setDeactivating(undefined); setSuccess('Program deactivated.'); setRefresh(v => v + 1); }
    catch (_) { setError(failure); } finally { setBusy(false); }
  }
  if (selectedProgram) return <Stack spacing={2}><Button onClick={() => { setSelectedProgram(undefined); setRefresh(v => v + 1); }}>Back to Programs</Button><LevelManagement program={selectedProgram} schoolId={schoolId} /></Stack>;
  return <Stack spacing={2}>
    <Typography>Configure the Programs offered by this school. Only active Programs are listed.</Typography>
    {error && !dialog && !deactivating && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}
    <Stack direction="row" spacing={2}><Button variant="contained" disabled={!ready || loading || busy} onClick={() => open()}>Add Program</Button><Button disabled={loading || busy} onClick={() => { setError(''); setRefresh(v => v + 1); }}>Refresh</Button></Stack>
    {loading ? <CircularProgress aria-label="Loading Programs" /> : ready && rows.length === 0 ? <Typography>No active Programs. Add your first Program.</Typography> : ready && rows.map(p => <Paper key={p._id} sx={{ p: 2 }}><Stack spacing={1}><Typography variant="h6">{p.name}</Typography><Typography>{p.description}</Typography><Typography>Display order: {p.displayOrder}</Typography><Stack direction="row" spacing={1}><Button disabled={busy} onClick={() => setSelectedProgram(p)} aria-label={'Manage Levels for ' + p.name}>Levels</Button><Button disabled={busy} onClick={() => open(p)} aria-label={'Edit ' + p.name}>Edit</Button><Button color="warning" disabled={busy} onClick={() => { setError(''); setSuccess(''); setDeactivating(p); }} aria-label={'Deactivate ' + p.name}>Deactivate</Button></Stack></Stack></Paper>)}
    <Dialog open={dialog} onClose={() => { if (!busy) setDialog(false); }} fullWidth maxWidth="sm"><DialogTitle>{editing ? 'Edit Program' : 'Add Program'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<TextField label="Program name" required value={name} onChange={e => setName(e.target.value)} disabled={busy} /><TextField label="Description" multiline value={description} onChange={e => setDescription(e.target.value)} disabled={busy} /><TextField label="Display order" type="number" value={order} onChange={e => setOrder(e.target.value)} disabled={busy} helperText="Lower numbers appear first." /></Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setDialog(false)}>Cancel</Button><Button variant="contained" disabled={!valid || busy} onClick={save}>Save Program</Button></DialogActions></Dialog>
    <Dialog open={!!deactivating} onClose={() => { if (!busy) setDeactivating(undefined); }}><DialogTitle>Deactivate Program</DialogTitle><DialogContent>{error && <Alert severity="error">{error}</Alert>}Deactivate {deactivating?.name}? It will no longer appear in the active Program list. Existing records are retained.</DialogContent><DialogActions><Button disabled={busy} onClick={() => setDeactivating(undefined)}>Cancel</Button><Button color="warning" disabled={busy} onClick={deactivate}>Confirm deactivation</Button></DialogActions></Dialog>
  </Stack>;
}
