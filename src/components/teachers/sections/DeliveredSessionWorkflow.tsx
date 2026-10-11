import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService } from '../../../services/apiService';
import { Program } from '../../../services/programService';
import { Level, levelService } from '../../../services/levelService';
import { Roadmap, roadmapService } from '../../../services/roadmapService';
import { PlannedSession, plannedSessionService } from '../../../services/plannedSessionService';
import DeliveredSessionManagement from '../../admin/sections/DeliveredSessionManagement';

type Reference = string | { _id: string; name?: string; programId?: string | { _id: string } };
interface AssignedGroup {
  _id: string;
  name: string;
  schoolId: string | { _id: string };
  programId?: Reference | null;
  levelIds?: Reference[];
}

const idOf = (value?: Reference | null) => typeof value === 'string' ? value : value?._id || '';
const nameOf = (value?: Reference | null, fallback = '') => typeof value === 'object' && value?.name ? value.name : fallback;

export default function DeliveredSessionWorkflow() {
  const { user, token } = useAuth();
  const schoolId = typeof user?.schoolId === 'string' ? user.schoolId : user?.schoolId?._id || '';
  const [groups, setGroups] = useState<AssignedGroup[]>([]);
  const [groupId, setGroupId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [levels, setLevels] = useState<Level[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [roadmapId, setRoadmapId] = useState('');
  const [sessions, setSessions] = useState<PlannedSession[]>([]);
  const [plannedId, setPlannedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const group = groups.find(row => row._id === groupId);
  const programId = idOf(group?.programId);
  const level = levels.find(row => row._id === levelId);
  const roadmap = roadmaps.find(row => row._id === roadmapId);
  const plannedSession = sessions.find(row => row._id === plannedId);
  const program = useMemo<Program | undefined>(() => group && programId ? {
    _id: programId, schoolId, name: nameOf(group.programId, 'Assigned Program'), displayOrder: 0, isActive: true
  } : undefined, [group, programId, schoolId]);

  useEffect(() => {
    let active = true;
    if (!token || user?.role !== 'teacher' || !schoolId) { setLoading(false); return; }
    setLoading(true); setError(false);
    apiService.getTeacherAssignedClasses().then(response => {
      if (!active) return;
      const rows = response.success && Array.isArray(response.data) ? response.data as unknown as AssignedGroup[] : [];
      setGroups(rows.filter(row => idOf(row.schoolId as Reference) === schoolId));
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.role, schoolId]);

  useEffect(() => {
    setLevels([]); setLevelId('');
    if (!token || !schoolId || !programId || !group) return;
    let active = true; setLoading(true); setError(false);
    const configured = new Set((group.levelIds || []).map(idOf));
    levelService(token, schoolId, programId).list()
      .then(rows => { if (active) setLevels(rows.filter(row => row.isActive && (!configured.size || configured.has(row._id)))); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, schoolId, programId, group]);

  useEffect(() => {
    setRoadmaps([]); setRoadmapId(''); setSessions([]); setPlannedId('');
    if (!token || !schoolId || !programId || !levelId) return;
    let active = true; setLoading(true); setError(false);
    roadmapService(token, schoolId, programId, levelId).list()
      .then(rows => { if (active) setRoadmaps(rows.filter(row => row.status === 'active')); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, schoolId, programId, levelId]);

  useEffect(() => {
    setSessions([]); setPlannedId('');
    if (!token || !roadmap) return;
    let active = true; setLoading(true); setError(false);
    plannedSessionService(token, roadmap).load()
      .then(result => { if (active) setSessions(result.sessions.filter(row => row.status === 'active')); })
      .catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, roadmap]);

  if (!user || user.role !== 'teacher' || !token || !schoolId) return <Alert severity="error">Instructor access and organization context are required.</Alert>;
  if (program && level && roadmap && plannedSession) return <DeliveredSessionManagement schoolId={schoolId} program={program} level={level} roadmap={roadmap} plannedSession={plannedSession} onBack={() => setPlannedId('')} />;

  return <Stack spacing={2}>
    <Typography variant="h5">My Delivered Sessions</Typography>
    <Typography>Select an assigned group and its planned teaching session.</Typography>
    {error && <Alert severity="error">Unable to confirm your assigned session options. Reload before retrying.</Alert>}
    {loading && <CircularProgress aria-label="Loading instructor sessions" />}
    {!loading && groups.length === 0 && <Alert severity="info">No active Delivery Groups are assigned to you.</Alert>}
    <TextField select label="Assigned Delivery Group" value={groupId} disabled={loading || error} onChange={event => { setGroupId(event.target.value); setLevelId(''); }}>
      {groups.map(row => <MenuItem key={row._id} value={row._id}>{row.name}</MenuItem>)}
    </TextField>
    {group && !programId && <Alert severity="info">This group needs a Program before a Delivered Session can be recorded.</Alert>}
    {group && programId && !loading && levels.length === 0 && <Alert severity="info">No active compatible Levels are available for this group's Program.</Alert>}
    <TextField select label="Level" value={levelId} disabled={!group || !programId || !levels.length || loading || error} onChange={event => setLevelId(event.target.value)}>
      {levels.map(row => <MenuItem key={row._id} value={row._id}>{row.name}</MenuItem>)}
    </TextField>
    {levelId && !loading && roadmaps.length === 0 && <Alert severity="info">No active Roadmap is available for this Program and Level.</Alert>}
    <TextField select label="Roadmap" value={roadmapId} disabled={!levelId || !roadmaps.length || loading || error} onChange={event => setRoadmapId(event.target.value)}>
      {roadmaps.map(row => <MenuItem key={row._id} value={row._id}>{row.name} — Version {row.version}</MenuItem>)}
    </TextField>
    {roadmapId && !loading && sessions.length === 0 && <Alert severity="info">No active Planned Sessions are available for this Roadmap.</Alert>}
    <TextField select label="Planned Session" value={plannedId} disabled={!roadmapId || !sessions.length || loading || error} onChange={event => setPlannedId(event.target.value)}>
      {sessions.map(row => <MenuItem key={row._id} value={row._id}>{row.sequence}. {row.title}</MenuItem>)}
    </TextField>
    {error && <Button onClick={() => window.location.reload()}>Reload</Button>}
  </Stack>;
}
