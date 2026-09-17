import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { Program } from '../../../services/programService';
import { Level } from '../../../services/levelService';
import { ConfigurationItem, ParameterType, requirementParameterService } from '../../../services/requirementParameterService';
const types: ParameterType[] = ['text', 'rating', 'percentage', 'number', 'checkbox', 'select'];
const failure = 'Unable to complete the request. Check your access and connection, then refresh before retrying.';
interface Context { schoolId: string; program: Program; level: Level; requirement?: ConfigurationItem; }
export default function RequirementParameterManagement(props: Context) {
 const { user, token } = useAuth(); const { schoolId, program, level, requirement } = props;
 const assignedSchool = typeof user?.schoolId === 'string' ? user.schoolId : (user?.schoolId as any)?._id;
 if (!user || !token || !['school_admin','super_admin'].includes(user.role) || !schoolId || program.schoolId !== schoolId || level.schoolId !== schoolId || level.programId !== program._id || (user.role === 'school_admin' && assignedSchool !== schoolId) || (requirement && (requirement.schoolId !== schoolId || requirement.programId !== program._id || requirement.levelId !== level._id))) return <Alert severity="error">Administrator access to this configuration required.</Alert>;
 return <Stack spacing={2}><Typography variant="h5">{program.name} → {level.name}{requirement ? ' → ' + requirement.name + ' → Parameters' : ' → Requirements'}</Typography><Items key={schoolId + level._id + (requirement?._id || '') + token} {...props} token={token} /></Stack>;
}
function Items({ token, schoolId, program, level, requirement }: Context & { token: string }) {
  const kind = requirement ? 'parameters' : 'requirements';
  const label = requirement ? 'Parameter' : 'Requirement';
  const parentId = requirement?._id || level._id;
  const api = useMemo(() => requirementParameterService(token, schoolId, program._id, kind, parentId), [token, schoolId, program._id, kind, parentId]);
  const [selected, setSelected] = useState<ConfigurationItem>();
  const [type, setType] = useState<ParameterType>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(!requirement);
  const [rows, setRows] = useState<ConfigurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<ConfigurationItem>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('0');
  const [busy, setBusy] = useState(false);
  const [deactivating, setDeactivating] = useState<ConfigurationItem>();
  useEffect(() => {
    let active = true; setLoading(true); setReady(false);
    api.list().then(data => {
      if (!data.every(p => p.schoolId === schoolId && p.programId === program._id && (requirement ? p.requirementId === parentId : p.levelId === parentId))) throw new Error();
      if (active) { setRows(data); setReady(true); }
    }).catch(() => { if (active) setError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, schoolId, program._id, parentId, requirement, refresh]);
  function open(program?: ConfigurationItem) { setType(program?.type || 'text'); setOptions((program?.options || []).join('\n')); setRequired(program?.isRequired ?? !requirement); setEditing(program); setName(program?.name || ''); setDescription(program?.description || ''); setOrder(String(program?.sequence ?? 0)); setError(''); setSuccess(''); setDialog(true); }
  const parsedOptions = options.split('\n').map(value => value.trim()).filter(Boolean);
  const valid = (!requirement || (types.includes(type) && (type !== 'select' || parsedOptions.length > 0))) && !!name.trim() && !!order.trim() && Number.isFinite(Number(order));
  async function save() {
    if (!valid || busy) return;
    setBusy(true); setError('');
    try { await api.save(editing?._id, { name, description, sequence: Number(order), isRequired: required, ...(requirement ? { type, options: parsedOptions } : {}) }); setDialog(false); setSuccess(editing ? label + ' updated.' : label + ' created.'); setRefresh(v => v + 1); }
    catch (_) { setError(failure); } finally { setBusy(false); }
  }
  async function deactivate() {
    if (!deactivating || busy) return;
    setBusy(true); setError('');
    try { await api.deactivate(deactivating._id); setDeactivating(undefined); setSuccess(label + ' deactivated.'); setRefresh(v => v + 1); }
    catch (_) { setError(failure); } finally { setBusy(false); }
  }
  if (selected) return <Stack spacing={2}><Button onClick={() => { setSelected(undefined); setRefresh(v => v + 1); }}>Back to Requirements</Button><RequirementParameterManagement schoolId={schoolId} program={program} level={level} requirement={selected} /></Stack>;
  return <Stack spacing={2}>
    <Typography>Only active {label.toLowerCase()}s are listed.</Typography>
    {error && !dialog && !deactivating && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}
    <Stack direction="row" spacing={2}><Button variant="contained" disabled={!ready || loading || busy} onClick={() => open()}>Add {label}</Button><Button disabled={loading || busy} onClick={() => { setError(''); setRefresh(v => v + 1); }}>Refresh</Button></Stack>
    {loading ? <CircularProgress aria-label={'Loading ' + label + 's'} /> : ready && rows.length === 0 ? <Typography>No active {label.toLowerCase()}s. Add your first {label.toLowerCase()}.</Typography> : ready && rows.map(p => <Paper key={p._id} sx={{ p: 2 }}><Stack spacing={1}><Typography variant="h6">{p.name}</Typography><Typography>{p.description}</Typography><Typography>Sequence: {p.sequence} · {p.isRequired ? 'Required' : 'Optional'}</Typography>{requirement && <Typography>Type: {p.type}{p.type === 'select' ? ' · Options: ' + (p.options || []).join(', ') : ''}</Typography>}<Stack direction="row" spacing={1}>{!requirement && <Button disabled={busy} onClick={() => setSelected(p)}>Parameters</Button>}<Button disabled={busy} onClick={() => open(p)} aria-label={'Edit ' + p.name}>Edit</Button><Button color="warning" disabled={busy} onClick={() => { setError(''); setSuccess(''); setDeactivating(p); }} aria-label={'Deactivate ' + p.name}>Deactivate</Button></Stack></Stack></Paper>)}
    <Dialog open={dialog} onClose={() => { if (!busy) setDialog(false); }} fullWidth maxWidth="sm"><DialogTitle>{(editing ? 'Edit ' : 'Add ') + label}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<TextField label={label + ' name'} required value={name} onChange={e => setName(e.target.value)} disabled={busy} />{!requirement && <TextField label="Description" multiline value={description} onChange={e => setDescription(e.target.value)} disabled={busy} />}
{requirement && <><TextField select label="Type" value={type} onChange={e => setType(e.target.value as ParameterType)} disabled={busy}>{types.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>{type === 'select' && <TextField label="Options" multiline required helperText="One non-empty option per line." value={options} onChange={e => setOptions(e.target.value)} disabled={busy} />}</>}
<FormControlLabel label="Required" control={<Checkbox checked={required} disabled={busy} onChange={e => setRequired(e.target.checked)} />} /> <TextField label="Sequence" type="number" value={order} onChange={e => setOrder(e.target.value)} disabled={busy} helperText="Lower sequence numbers appear first." /></Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setDialog(false)}>Cancel</Button><Button variant="contained" disabled={!valid || busy} onClick={save}>Save {label}</Button></DialogActions></Dialog>
    <Dialog open={!!deactivating} onClose={() => { if (!busy) setDeactivating(undefined); }}><DialogTitle>Deactivate {label}</DialogTitle><DialogContent>{error && <Alert severity="error">{error}</Alert>}Deactivate {deactivating?.name}? It will no longer appear in the active {label.toLowerCase()} list. Existing records are retained.</DialogContent><DialogActions><Button disabled={busy} onClick={() => setDeactivating(undefined)}>Cancel</Button><Button color="warning" disabled={busy} onClick={deactivate}>Confirm deactivation</Button></DialogActions></Dialog>
  </Stack>;
}
