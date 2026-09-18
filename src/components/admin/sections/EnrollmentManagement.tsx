import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, MenuItem, Paper, Stack, TextField, Typography
} from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import {
  Enrollment, EnrollmentChild, EnrollmentClass, EnrollmentLevel, EnrollmentProgram,
  EnrollmentSchool, EnrollmentStatus, enrollmentService
} from '../../../services/enrollmentService';

const failure = 'Unable to complete the request. Check your access and connection, then refresh before retrying.';
const terminal: EnrollmentStatus[] = ['completed', 'withdrawn', 'cancelled'];
const date = (value?: string) => value ? new Date(value).toLocaleDateString() : '—';
const label = (value: string) => value.replace('_', ' ').replace(/^./, first => first.toUpperCase());
const statusColor = (status: EnrollmentStatus): 'success' | 'warning' | 'info' | 'default' | 'error' =>
  status === 'active' ? 'success' : status === 'paused' ? 'warning' : status === 'pending' ? 'info' : status === 'cancelled' ? 'error' : 'default';

export default function EnrollmentManagement() {
  const { user, token } = useAuth();
  if (!user || !token || !['school_admin', 'super_admin'].includes(user.role)) {
    return <Alert severity="error">Administrator access required.</Alert>;
  }
  const schoolId = typeof user.schoolId === 'string' ? user.schoolId : (user.schoolId as any)?._id || '';
  return <EnrollmentScope key={user._id + token + schoolId} token={token} role={user.role} schoolId={schoolId} />;
}

function EnrollmentScope({ token, role, schoolId }: { token: string; role: string; schoolId: string }) {
  const [selectedSchool, setSelectedSchool] = useState(role === 'super_admin' ? '' : schoolId);
  const [schools, setSchools] = useState<EnrollmentSchool[]>([]);
  const [schoolError, setSchoolError] = useState('');
  const api = useMemo(() => enrollmentService(token, ''), [token]);
  useEffect(() => {
    let active = true;
    if (role === 'super_admin') api.schools().then(rows => { if (active) setSchools(rows); }).catch(() => { if (active) setSchoolError(failure); });
    return () => { active = false; };
  }, [api, role]);
  return <Stack spacing={2} sx={{ py: 3 }}>
    <Typography variant="h4">Enrollment Management</Typography>
    <Typography color="text.secondary">Manage each participant's Program enrollment and preserve its level, class and status history.</Typography>
    {schoolError && <Alert severity="error">{schoolError}</Alert>}
    {role === 'super_admin' && <TextField select label="Organization" value={selectedSchool} onChange={event => setSelectedSchool(event.target.value)}>
      <MenuItem value="">Choose an organization</MenuItem>{schools.map(school => <MenuItem key={school._id} value={school._id}>{school.name}</MenuItem>)}
    </TextField>}
    {selectedSchool ? <OrganizationEnrollments key={selectedSchool + token} token={token} schoolId={selectedSchool} /> : <Alert severity="info">Choose an organization to manage enrollments.</Alert>}
  </Stack>;
}

function OrganizationEnrollments({ token, schoolId }: { token: string; schoolId: string }) {
  const api = useMemo(() => enrollmentService(token, schoolId), [token, schoolId]);
  const [children, setChildren] = useState<EnrollmentChild[]>([]);
  const [childId, setChildId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api.children().then(rows => { if (active) setChildren(rows); }).catch(() => { if (active) setError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);
  if (loading) return <CircularProgress aria-label="Loading participants" />;
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}
    <TextField select label="Participant" value={childId} onChange={event => setChildId(event.target.value)} disabled={!children.length}>
      <MenuItem value="">Choose a participant</MenuItem>{children.map(child => <MenuItem key={child._id} value={child._id}>{child.firstName} {child.lastName}</MenuItem>)}
    </TextField>
    {!children.length ? <Alert severity="info">No participants are available in this organization.</Alert> : childId ? <ChildEnrollments key={childId} api={api} childId={childId} schoolId={schoolId} /> : <Alert severity="info">Choose a participant to view enrollment history.</Alert>}
  </Stack>;
}

function ChildEnrollments({ api, childId, schoolId }: { api: ReturnType<typeof enrollmentService>; childId: string; schoolId: string }) {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [programs, setPrograms] = useState<EnrollmentProgram[]>([]);
  const [levels, setLevels] = useState<EnrollmentLevel[]>([]);
  const [classes, setClasses] = useState<EnrollmentClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [programId, setProgramId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [initialStatus, setInitialStatus] = useState<'pending' | 'active'>('active');
  const [action, setAction] = useState<{ type: 'level' | 'class' | 'activate' | 'pause' | 'resume' | 'end'; row: Enrollment }>();
  const [actionLevel, setActionLevel] = useState('');
  const [actionClass, setActionClass] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    Promise.all([api.list(childId), api.programs(), api.classes()]).then(async ([enrollments, programRows, classRows]) => {
      if (!enrollments.every(row => String(row.schoolId) === schoolId && String(row.childId) === childId)) throw new Error();
      const levelRows = (await Promise.all(programRows.map(program => api.levels(program._id)))).flat();
      if (!levelRows.every(level => level.schoolId === schoolId)) throw new Error();
      if (active) { setRows(enrollments); setPrograms(programRows); setLevels(levelRows); setClasses(classRows); }
    }).catch(() => { if (active) setError(failure); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, childId, refresh, schoolId]);

  const programName = (id: string) => programs.find(program => program._id === String(id))?.name || 'Unavailable Program';
  const levelName = (id?: string | null) => id ? levels.find(level => level._id === String(id))?.name || 'Unavailable Level' : 'Not assigned';
  const className = (id?: string | null) => id ? classes.find(item => item._id === String(id))?.name || 'Unavailable Class' : 'Not assigned';
  const createLevels = levels.filter(level => level.programId === programId);
  const actionLevels = action ? levels.filter(level => level.programId === String(action.row.programId) && level._id !== String(action.row.currentLevelId || '')) : [];
  const actionClasses = action ? classes.filter(item => item._id !== String(action.row.currentClassId || '')) : [];
  const createValid = !!programId && !!levelId && !!startDate;

  function openCreate() { setProgramId(''); setLevelId(''); setInitialStatus('active'); setError(''); setSuccess(''); setCreateOpen(true); }
  async function create() {
    if (!createValid || busy) return;
    setBusy(true); setError('');
    try {
      await api.create({ childId, programId, currentLevelId: levelId, startDate, status: initialStatus });
      setCreateOpen(false); setSuccess('Enrollment created.'); setRefresh(value => value + 1);
    } catch (_) { setError(failure); } finally { setBusy(false); }
  }
  function openAction(type: 'level' | 'class' | 'activate' | 'pause' | 'resume' | 'end', row: Enrollment) {
    setAction({ type, row }); setActionLevel(''); setActionClass(''); setEffectiveDate(new Date().toISOString().slice(0, 10)); setReason(''); setError(''); setSuccess('');
  }
  async function runAction() {
    if (!action || busy || (action.type === 'level' && !actionLevel) || (action.type === 'class' && (!actionClass || !effectiveDate))) return;
    setBusy(true); setError('');
    try {
      if (action.type === 'level') await api.changeLevel(action.row._id, actionLevel, new Date().toISOString(), reason);
      else if (action.type === 'class') await api.changeClass(action.row._id, actionClass, effectiveDate, reason);
      else if (action.type === 'pause') await api.changeStatus(action.row._id, 'paused', reason);
      else if (action.type === 'resume' || action.type === 'activate') await api.changeStatus(action.row._id, 'active', reason);
      else await api.end(action.row._id, reason);
      setAction(undefined); setSuccess(action.type === 'end' ? 'Enrollment ended and retained in history.' : 'Enrollment updated.'); setRefresh(value => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : failure); } finally { setBusy(false); }
  }

  if (loading) return <CircularProgress aria-label="Loading enrollments" />;
  return <Stack spacing={2}>
    {error && !createOpen && !action && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}
    <Stack direction="row" spacing={1}><Button variant="contained" onClick={openCreate} disabled={busy}>Add Enrollment</Button><Button onClick={() => setRefresh(value => value + 1)} disabled={busy}>Refresh</Button></Stack>
    {!rows.length ? <Paper sx={{ p: 3 }}><Typography>No enrollment history for this participant.</Typography></Paper> : rows.map(row => {
      const editable = !terminal.includes(row.status);
      return <Paper key={row._id} sx={{ p: 2 }}><Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Typography variant="h6">{programName(String(row.programId))}</Typography><Chip label={label(row.status)} color={statusColor(row.status)} size="small" /></Stack>
        <Typography>Current level: {levelName(row.currentLevelId)}</Typography><Typography>Current class: {className(row.currentClassId)}</Typography>
        <Typography>Started: {date(row.startDate)}{row.endDate ? ` · Ended: ${date(row.endDate)}` : ''}</Typography>
        {editable && <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button onClick={() => openAction('level', row)}>Change Level</Button>
          <Button onClick={() => openAction('class', row)}>{row.currentClassId ? 'Change Class' : 'Assign Class'}</Button>
          {row.status === 'pending' && <Button onClick={() => openAction('activate', row)}>Activate</Button>}
          {row.status === 'active' && <Button onClick={() => openAction('pause', row)}>Pause</Button>}
          {row.status === 'paused' && <Button onClick={() => openAction('resume', row)}>Resume</Button>}
          <Button color="warning" onClick={() => openAction('end', row)}>End Enrollment</Button>
        </Stack>}
        <Divider /><Typography variant="subtitle2">History</Typography>
        {!row.levelHistory?.length && !row.statusHistory?.length && !row.classAssignments?.length ? <Typography color="text.secondary">No changes recorded yet.</Typography> : <Stack spacing={0.5}>
          {row.levelHistory?.map((item, index) => <Typography key={item._id || `level-${index}`} variant="body2">Level: {levelName(item.levelId)} from {date(item.effectiveFrom)}{item.effectiveTo ? ` to ${date(item.effectiveTo)}` : ' (current)'}</Typography>)}
          {row.classAssignments?.map((item, index) => <Typography key={item._id || `class-${index}`} variant="body2">Class: {className(item.classId)} from {date(item.effectiveFrom)}{item.effectiveTo ? ` to ${date(item.effectiveTo)}` : ' (current)'}</Typography>)}
          {row.statusHistory?.map((item, index) => <Typography key={item._id || `status-${index}`} variant="body2">Status: {label(item.status)} on {date(item.changedAt)}</Typography>)}
        </Stack>}
      </Stack></Paper>;
    })}

    <Dialog open={createOpen} onClose={() => { if (!busy) setCreateOpen(false); }} fullWidth maxWidth="sm"><DialogTitle>Add Enrollment</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField select required label="Program" value={programId} onChange={event => { setProgramId(event.target.value); setLevelId(''); }}>{programs.map(program => <MenuItem key={program._id} value={program._id}>{program.name}</MenuItem>)}</TextField>
      <TextField select required label="Level" value={levelId} disabled={!programId} onChange={event => setLevelId(event.target.value)}>{createLevels.map(level => <MenuItem key={level._id} value={level._id}>{level.name}</MenuItem>)}</TextField>
      <Alert severity="info">Class assignment is unavailable here because the current backend does not define a safe Program/Level-to-Class relationship.</Alert>
      <TextField required label="Start date" type="date" InputLabelProps={{ shrink: true }} value={startDate} onChange={event => setStartDate(event.target.value)} />
      <TextField select label="Initial status" value={initialStatus} onChange={event => setInitialStatus(event.target.value as 'pending' | 'active')}><MenuItem value="active">Active</MenuItem><MenuItem value="pending">Pending</MenuItem></TextField>
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="contained" disabled={!createValid || busy} onClick={create}>Save Enrollment</Button></DialogActions></Dialog>

    <Dialog open={!!action} onClose={() => { if (!busy) setAction(undefined); }} fullWidth maxWidth="sm"><DialogTitle>{action?.type === 'level' ? 'Change Level' : action?.type === 'class' ? (action.row.currentClassId ? 'Change Class' : 'Assign Class') : action?.type === 'activate' ? 'Activate Enrollment' : action?.type === 'pause' ? 'Pause Enrollment' : action?.type === 'resume' ? 'Resume Enrollment' : 'End Enrollment'}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {action?.type === 'level' && <TextField select required label="New level" value={actionLevel} onChange={event => setActionLevel(event.target.value)}>{actionLevels.map(level => <MenuItem key={level._id} value={level._id}>{level.name}</MenuItem>)}</TextField>}
      {action?.type === 'class' && <>
        <TextField select required label="Class" value={actionClass} onChange={event => setActionClass(event.target.value)}>{actionClasses.map(item => <MenuItem key={item._id} value={item._id}>{item.name}</MenuItem>)}</TextField>
        <TextField required label="Effective date" type="date" InputLabelProps={{ shrink: true }} value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} />
        <Alert severity="info">Classes are organization-scoped. Confirm this class is appropriate for the enrollment's Program and Level.</Alert>
      </>}
      <TextField label="Reason (optional)" value={reason} onChange={event => setReason(event.target.value)} />
      {action?.type === 'end' && <Alert severity="warning">This ends the enrollment as withdrawn. Its history will be retained.</Alert>}
    </Stack></DialogContent><DialogActions><Button disabled={busy} onClick={() => setAction(undefined)}>Cancel</Button><Button color={action?.type === 'end' ? 'warning' : 'primary'} variant="contained" disabled={busy || (action?.type === 'level' && !actionLevel) || (action?.type === 'class' && (!actionClass || !effectiveDate))} onClick={runAction}>Confirm</Button></DialogActions></Dialog>
  </Stack>;
}
