import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService } from '../../../services/apiService';
import { Program } from '../../../services/programService';
import { Level, levelService } from '../../../services/levelService';
import { Roadmap, roadmapService } from '../../../services/roadmapService';
import { PlannedSession, plannedSessionService } from '../../../services/plannedSessionService';
import { getIndividualLessonEnrollments, IndividualLessonEnrollment } from '../../../services/individualLessonService';
import DeliveredSessionManagement from '../../admin/sections/DeliveredSessionManagement';

type Reference = string | { _id: string; name?: string; programId?: string | { _id: string } };
type DeliveryMode = 'group' | 'individual';
interface AssignedGroup { _id: string; name: string; schoolId: string | { _id: string }; programId?: Reference | null; levelIds?: Reference[]; }

const idOf = (value?: Reference | null) => typeof value === 'string' ? value : value?._id || '';
const nameOf = (value?: Reference | null, fallback = '') => typeof value === 'object' && value?.name ? value.name : fallback;
const initialDate = () => new Date().toISOString().slice(0, 16);

export default function DeliveredSessionWorkflow() {
  const { user, token } = useAuth();
  const schoolId = typeof user?.schoolId === 'string' ? user.schoolId : user?.schoolId?._id || '';
  const [mode, setMode] = useState<DeliveryMode>('group');
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [groupId, setGroupId] = useState('');
  const [lessonAt, setLessonAt] = useState(initialDate);
  const [individualEnrollments, setIndividualEnrollments] = useState<IndividualLessonEnrollment[]>([]);
  const [enrollmentId, setEnrollmentId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmapId, setRoadmapId] = useState('');
  const [sessions, setSessions] = useState<PlannedSession[]>([]);
  const [plannedId, setPlannedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const group = groups.find(row => row._id === groupId);
  const individualEnrollment = individualEnrollments.find(row => row._id === enrollmentId);
  const programId = mode === 'individual' ? individualEnrollment?.program._id || '' : idOf(group?.programId);
  const effectiveLevelId = mode === 'individual' ? individualEnrollment?.level._id || '' : levelId;
  const level = mode === 'individual' && individualEnrollment ? {
    _id: individualEnrollment.level._id, schoolId, programId, name: individualEnrollment.level.name, sequence: 0, isActive: true
  } : levels.find(row => row._id === levelId);
  const roadmap = roadmaps.find(row => row._id === roadmapId);
  const plannedSession = sessions.find(row => row._id === plannedId);
  const program = useMemo<Program | undefined>(() => {
    if (mode === 'individual' && individualEnrollment) return { _id: individualEnrollment.program._id, schoolId, name: individualEnrollment.program.name, displayOrder: 0, isActive: true };
    return group && programId ? { _id: programId, schoolId, name: nameOf(group.programId, 'Assigned Program'), displayOrder: 0, isActive: true } : undefined;
  }, [mode, individualEnrollment, group, programId, schoolId]);
  const individualTarget = useMemo(() => individualEnrollment ? ({ enrollmentId: individualEnrollment._id, childId: individualEnrollment.child._id, childName: `${individualEnrollment.child.firstName} ${individualEnrollment.child.lastName}` }) : undefined, [individualEnrollment]);

  useEffect(() => { setGroupId(''); setEnrollmentId(''); setLevelId(''); setRoadmapId(''); setPlannedId(''); setError(false); }, [mode]);
  useEffect(() => {
    let active = true;
    if (!token || user?.role !== 'teacher' || !schoolId) { setLoading(false); return; }
    if (mode === 'individual') return () => { active = false; };
    setLoading(true); setError(false);
    apiService.getTeacherAssignedClasses().then(response => {
      if (!active) return;
      const rows = response.success && Array.isArray(response.data) ? response.data as unknown as AssignedGroup[] : [];
      setGroups(rows.filter(row => idOf(row.schoolId as Reference) === schoolId));
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.role, schoolId, mode]);
  useEffect(() => {
    let active = true;
    if (mode !== 'individual' || !token || !lessonAt || !Number.isFinite(Date.parse(lessonAt))) return;
    setLoading(true); setError(false); setEnrollmentId('');
    getIndividualLessonEnrollments(token, new Date(lessonAt).toISOString()).then(rows => { if (active) setIndividualEnrollments(rows); })
      .catch(() => { if (active) { setIndividualEnrollments([]); setError(true); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, token, lessonAt]);
  useEffect(() => {
    setLevels([]); setLevelId('');
    if (mode !== 'group' || !token || !schoolId || !programId || !group) return;
    let active = true; setLoading(true); setError(false);
    const configured = new Set((group.levelIds || []).map(idOf));
    levelService(token, schoolId, programId).list().then(rows => { if (active) setLevels(rows.filter(row => row.isActive && (!configured.size || configured.has(row._id)))); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [mode, token, schoolId, programId, group]);
  useEffect(() => {
    setRoadmaps([]); setRoadmapId(''); setSessions([]); setPlannedId('');
    if (!token || !schoolId || !programId || !effectiveLevelId) return;
    let active = true; setLoading(true); setError(false);
    roadmapService(token, schoolId, programId, effectiveLevelId).list().then(rows => { if (active) setRoadmaps(rows.filter(row => row.status === 'active')); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, schoolId, programId, effectiveLevelId]);
  useEffect(() => {
    setSessions([]); setPlannedId('');
    if (!token || !roadmap) return;
    let active = true; setLoading(true); setError(false);
    plannedSessionService(token, roadmap).load().then(result => { if (active) setSessions(result.sessions.filter(row => row.status === 'active')); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, roadmap]);

  if (!user || user.role !== 'teacher' || !token || !schoolId) return <Alert severity="error">Instructor access and organization context are required.</Alert>;
  if (program && level && roadmap && plannedSession) return <DeliveredSessionManagement schoolId={schoolId} program={program} level={level} roadmap={roadmap} plannedSession={plannedSession} individualTarget={mode === 'individual' ? individualTarget : undefined} initialScheduledAt={mode === 'individual' ? new Date(lessonAt).toISOString() : undefined} onBack={() => setPlannedId('')} />;

  return <Stack spacing={2}>
    <Typography variant="h5">My Delivered Sessions</Typography>
    <ToggleButtonGroup exclusive value={mode} onChange={(_, next) => { if (next) setMode(next); }} aria-label="Delivery mode"><ToggleButton value="group">Group Session</ToggleButton><ToggleButton value="individual">Individual Lesson</ToggleButton></ToggleButtonGroup>
    <Typography>{mode === 'group' ? 'Select an assigned group and its planned teaching session.' : 'Select a lesson date and an assigned learner. Program and Level come from the Enrollment.'}</Typography>
    {error && <Alert severity="error">Unable to confirm your authorized session options. Reload before retrying.</Alert>}
    {loading && <CircularProgress aria-label="Loading instructor sessions" />}
    {mode === 'group' ? <>
      {!loading && groups.length === 0 && <Alert severity="info">No active Delivery Groups are assigned to you.</Alert>}
      <TextField select label="Assigned Delivery Group" value={groupId} disabled={loading || error} onChange={event => { setGroupId(event.target.value); setLevelId(''); }}>{groups.map(row => <MenuItem key={row._id} value={row._id}>{row.name}</MenuItem>)}</TextField>
      {group && !programId && <Alert severity="info">This group needs a Program before a Delivered Session can be recorded.</Alert>}
      {group && programId && !loading && levels.length === 0 && <Alert severity="info">No active compatible Levels are available for this group's Program.</Alert>}
      <TextField select label="Level" value={levelId} disabled={!group || !programId || !levels.length || loading || error} onChange={event => setLevelId(event.target.value)}>{levels.map(row => <MenuItem key={row._id} value={row._id}>{row.name}</MenuItem>)}</TextField>
    </> : <>
      <TextField label="Lesson date and time" type="datetime-local" required InputLabelProps={{ shrink: true }} value={lessonAt} disabled={loading} onChange={event => setLessonAt(event.target.value)} />
      {!loading && !error && individualEnrollments.length === 0 && <Alert severity="info">No active individual lesson assignments cover this date.</Alert>}
      <TextField select label="Assigned learner and Enrollment" value={enrollmentId} disabled={loading || error || !individualEnrollments.length} onChange={event => setEnrollmentId(event.target.value)}>{individualEnrollments.map(row => <MenuItem key={row._id} value={row._id}>{row.child.firstName} {row.child.lastName} — {row.program.name} / {row.level.name}</MenuItem>)}</TextField>
      {individualEnrollment && <Alert severity="success">Program: {individualEnrollment.program.name}. Level: {individualEnrollment.level.name}.</Alert>}
    </>}
    {effectiveLevelId && !loading && roadmaps.length === 0 && <Alert severity="info">No active Roadmap is available for this Program and Level.</Alert>}
    <TextField select label="Roadmap" value={roadmapId} disabled={!effectiveLevelId || !roadmaps.length || loading || error} onChange={event => setRoadmapId(event.target.value)}>{roadmaps.map(row => <MenuItem key={row._id} value={row._id}>{row.name} — Version {row.version}</MenuItem>)}</TextField>
    {roadmapId && !loading && sessions.length === 0 && <Alert severity="info">No active Planned Sessions are available for this Roadmap.</Alert>}
    <TextField select label="Planned Session" value={plannedId} disabled={!roadmapId || !sessions.length || loading || error} onChange={event => setPlannedId(event.target.value)}>{sessions.map(row => <MenuItem key={row._id} value={row._id}>{row.sequence}. {row.title}</MenuItem>)}</TextField>
    {error && <Button onClick={() => window.location.reload()}>Reload</Button>}
  </Stack>;
}
