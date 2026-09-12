import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { identity, Parameter, Participation, Progress, Session, WorkflowReport, WorkflowService, workflowError, workflowService } from '../../services/progressWorkflowService';

const objectiveStatuses = ['not_observed', 'achieved', 'partially_achieved', 'not_achieved', 'needs_improvement'];
const label = (value: string) => value.replace(/_/g, ' ');
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Not recorded';
const inputValue = (value: any) => value ?? '';
function ValueInput({ type, name, value, options = [], onChange, disabled = false }: { type: string; name: string; value: any; options?: string[]; onChange: (value: any) => void; disabled?: boolean }) {
  if (type === 'checkbox') return <FormControlLabel label={name} control={<Checkbox checked={value === true} disabled={disabled} onChange={e => onChange(e.target.checked)} />} />;
  return <TextField fullWidth label={name} value={inputValue(value)} disabled={disabled} select={type === 'select'} type={['number','rating','percentage'].includes(type) ? 'number' : 'text'} inputProps={type === 'percentage' ? { min: 0, max: 100 } : {}} onChange={e => onChange(e.target.value)}>{type === 'select' && options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}</TextField>;
}
export default function ProgressWorkflow() {
  const { user, token } = useAuth();
  if (!user || !['teacher','school_admin','super_admin'].includes(user.role)) return <Alert severity="error">Staff access only. Parents cannot access this workflow.</Alert>;
  if (!token) return <Alert severity="error">Please sign in again.</Alert>;
  return <StaffWorkflow key={user._id} token={token} role={user.role} userSchool={identity(user.schoolId)} />;
}
function StaffWorkflow({ token, role, userSchool }: { token: string; role: string; userSchool: string }) {
  const [school, setSchool] = useState(userSchool);
  const [schools, setSchools] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => workflowService(token, school), [token, school]);
  useEffect(() => { let active = true; if (role === 'super_admin') workflowService(token, '').request<any[]>('/schools').then(rows => { if(active) setSchools(rows); }).catch(e => { if(active) setError(workflowError(e)); }); return () => { active = false; }; }, [token, role]);
  useEffect(() => {
    let active = true; setSessions([]); setSelected(''); if (!school) return;
    setLoading(true); setError(''); api.sessions().then(rows => { if(active) setSessions(rows); }).catch(e => { if(active) setError(workflowError(e)); }).finally(() => { if(active) setLoading(false); });
    return () => { active = false; };
  }, [api, school]);
  return <Stack spacing={3} sx={{ p: 3 }}><Typography variant="h4">Session Progress</Typography><Typography>Record child progress, review a report draft, then explicitly finalize it.</Typography>
    {role === 'super_admin' && <TextField select label="School" value={school} onChange={e => setSchool(e.target.value)}>{schools.map(s => <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>)}</TextField>}
    {error && <Alert severity="error">{error}</Alert>}{loading && <CircularProgress aria-label="Loading sessions" />}
    {!school && <Alert severity="info">Choose a school to view its sessions.</Alert>}
    {school && !loading && !error && sessions.length === 0 && <Alert severity="info">No delivered sessions are available. Sessions must be configured before recording progress.</Alert>}
    {sessions.length > 0 && <TextField select label="Delivered session" value={selected} onChange={e => setSelected(e.target.value)}>{sessions.map(s => <MenuItem key={s._id} value={s._id}>{s.title} — {date(s.scheduledAt)} ({label(s.status)})</MenuItem>)}</TextField>}
    {selected && <SessionEntry key={school + selected} api={api} sessionId={selected} />}
  </Stack>;
}
function SessionEntry({ api, sessionId }: { api: WorkflowService; sessionId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<WorkflowService['session']>>>();
  const [error, setError] = useState(''); const [selected, setSelected] = useState('');
  useEffect(() => { let active = true; api.session(sessionId).then(r => { if(active) setData(r); }).catch(e => { if(active) setError(workflowError(e)); }); return () => { active = false; }; }, [api, sessionId]);
  if(error) return <Alert severity="error">{error}</Alert>;
  if(!data) return <CircularProgress aria-label="Loading session" />;
  const { session, children, users } = data;
  const classChild = users.find(u => identity(u.classId) === session.classId && u.studentClass);
  const child = children.find(p => p._id === selected);
  const user = users.find(u => u._id === identity(child?.childId));
  return <Stack spacing={2}><Paper sx={{ p: 2 }}><Typography variant="h5">{session.plannedSessionSnapshot.title}</Typography><Typography>Class: {classChild?.studentClass || session.classId}</Typography><Typography>Program: {data.program.name} · Level: {data.level.name}</Typography><Typography>Scheduled: {date(session.scheduledAt)} · Delivered: {date(session.deliveredAt)}</Typography><Chip label={label(session.status)} /><Typography variant="h6" sx={{mt:2}}>Planned objectives</Typography>{session.plannedSessionSnapshot.objectives.map(o=><Typography key={o.objectiveId}>• {o.title} — {o.expectedOutcome || o.description}</Typography>)}</Paper>
    {!['in_progress','completed'].includes(session.status) && <Alert severity="info">Progress can be recorded only for an in-progress or completed session.</Alert>}
    {children.length === 0 ? <Alert severity="info">No participating children in this session.</Alert> : <TextField select label="Participating child" value={selected} onChange={e => setSelected(e.target.value)}>{children.map(p => { const u = users.find(u => u._id === identity(p.childId)); return <MenuItem key={p._id} value={p._id}>{u ? u.firstName + ' ' + u.lastName : identity(p.childId)} — {label(p.status)}</MenuItem>; })}</TextField>}
    {child && <ChildEntry key={child._id} api={api} session={session} participation={child} parameters={data.parameters} templates={data.templates} parentEmail={user?.parentEmail || ''} />}
  </Stack>;
}
function ChildEntry({ api, session, participation, parameters, templates, parentEmail }: { api: WorkflowService; session: Session; participation: Participation; parameters: Parameter[]; templates: any[]; parentEmail: string }) {
  const [loaded, setLoaded] = useState(false); const [progress, setProgress] = useState<Progress>(); const [report, setReport] = useState<WorkflowReport>();
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [dirty, setDirty] = useState(false);
  const [objectives, setObjectives] = useState<Record<string, { status: string; instructorNote: string; evidence: string }>>({});
  const [values, setValues] = useState<Record<string, { recorded: boolean; value: any; note: string }>>({});
  const [observations, setObservations] = useState(''); const [recommendations, setRecommendations] = useState(''); const [overall, setOverall] = useState('in_progress'); const [template, setTemplate] = useState('');
  useEffect(() => { let active = true; (async () => {
    const rows = await api.progress(participation._id); if(rows.length > 1) throw new Error('Multiple Progress records found. Contact your administrator.');
    const p = rows[0]; const r = p ? await api.findReport(identity(participation.childId), p._id) : undefined;
    if(!active) return;
    setProgress(p); setReport(r);
    setObjectives(Object.fromEntries(session.plannedSessionSnapshot.objectives.map(o => { const v = p?.objectiveResults.find(v => identity(v.objectiveId) === o.objectiveId); return [o.objectiveId, { status: v?.status || 'not_observed', instructorNote: v?.instructorNote || '', evidence: v?.evidence || '' }]; })));
    setValues(Object.fromEntries(parameters.map(param => { const v = p?.parameterResults.find(v => identity(v.parameterId) === param._id); return [param._id, { recorded: !!v, value: v?.value ?? (param.type === 'checkbox' ? false : ''), note: v?.note || '' }]; })));
    setObservations(p?.observations || ''); setRecommendations(p?.recommendations || ''); setOverall(p?.overallStatus || 'in_progress'); setLoaded(true);
  })().catch(e => { if(active) setError(workflowError(e)); }); return () => { active = false; }; }, [api, participation, parameters, session]);
  const eligible = participation.status === 'active' && ['in_progress','completed'].includes(session.status);
  const unavailable = progress?.parameterResults.some(r => !parameters.some(p => p._id === identity(r.parameterId)));
  async function saveProgress() {
    setBusy(true); setError(''); setNotice('');
    try {
      const parameterResults = parameters.filter(p => values[p._id]?.recorded).map(p => {
        const v = values[p._id]; let value = v.value;
        if(['number','rating','percentage'].includes(p.type)) { if(value === '' || !Number.isFinite(Number(value))) throw new Error(p.name + ': enter a number.'); value = Number(value); if(p.type === 'percentage' && (value < 0 || value > 100)) throw new Error(p.name + ': enter 0–100.'); }
        if(p.type === 'select' && !p.options?.includes(value)) throw new Error(p.name + ': choose an option.');
        return { parameterId: p._id, value, note: v.note };
      });
      const saved = await api.saveProgress(progress?._id, { childParticipationId: participation._id, objectiveResults: Object.entries(objectives).map(([objectiveId,v]) => ({ objectiveId,...v })), parameterResults, observations, recommendations, overallStatus: overall });
      setProgress(saved); setDirty(false); setNotice('Progress saved. No report was approved or sent.');
    } catch(e) { setError(workflowError(e)); } finally { setBusy(false); }
  }
  async function generate() { if(!progress) return; setBusy(true);setError('');try {setReport(await api.draft(progress._id,template));}catch(e){setError(workflowError(e));}finally{setBusy(false);} }
  if(!loaded) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Loading progress" />;
  return <Stack spacing={2}><Typography variant="h5">Child Progress</Typography><Alert severity="info">{progress ? 'Progress already recorded.' : 'Progress not yet recorded.'} This information is internal until reviewed in a report.</Alert>
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    {unavailable && <Alert severity="warning">A previously recorded parameter is no longer available. Contact your administrator before editing.</Alert>}
    <Box component="fieldset" disabled={busy || !eligible || !!unavailable} sx={{ border: 0, p: 0 }}><Stack spacing={2}>
    {session.plannedSessionSnapshot.objectives.length === 0 && <Alert severity="info">This planned session has no objectives.</Alert>}
    {session.plannedSessionSnapshot.objectives.map(o => <Paper key={o.objectiveId} sx={{p:2}}><Stack spacing={2}><Typography variant="h6">{o.title}</Typography><Typography>{o.description} {o.expectedOutcome}</Typography><TextField select label={o.title + ' status'} value={objectives[o.objectiveId]?.status || 'not_observed'} onChange={e=>{setObjectives({...objectives,[o.objectiveId]:{...objectives[o.objectiveId],status:e.target.value}});setDirty(true);}}>{objectiveStatuses.map(s=><MenuItem key={s} value={s}>{label(s)}</MenuItem>)}</TextField>{(['instructorNote','evidence'] as const).map(k=><TextField key={k} label={o.title + (k==='evidence'?' evidence':' note')} value={objectives[o.objectiveId]?.[k] || ''} onChange={e=>{setObjectives({...objectives,[o.objectiveId]:{...objectives[o.objectiveId],[k]:e.target.value}});setDirty(true);}} />)}</Stack></Paper>)}
    <Typography variant="h6">Parameters</Typography><Typography>Leave “Record” unchecked when a parameter was not measured; zero and false are actual results.</Typography>
    {parameters.length===0 && <Typography>No applicable parameters configured.</Typography>}
    {parameters.map(p=><Paper key={p._id} sx={{p:2}}><FormControlLabel label={'Record ' + p.name} control={<Checkbox checked={values[p._id]?.recorded || false} onChange={e=>{setValues({...values,[p._id]:{...values[p._id],recorded:e.target.checked}});setDirty(true);}} />}/>{values[p._id]?.recorded && <Stack spacing={2}><ValueInput name={p.name} type={p.type} options={p.options} value={values[p._id].value} onChange={v=>{setValues({...values,[p._id]:{...values[p._id],value:v}});setDirty(true);}} /><TextField label={p.name + ' note'} value={values[p._id].note} onChange={e=>{setValues({...values,[p._id]:{...values[p._id],note:e.target.value}});setDirty(true);}} /></Stack>}</Paper>)}
    <TextField label="Internal observations" multiline value={observations} onChange={e=>{setObservations(e.target.value);setDirty(true);}} /><TextField label="Recommendations" multiline value={recommendations} onChange={e=>{setRecommendations(e.target.value);setDirty(true);}} /><TextField label="Overall status" select value={overall} onChange={e=>{setOverall(e.target.value);setDirty(true);}}>{['in_progress','achieved','partially_achieved','needs_improvement'].map(s=><MenuItem key={s} value={s}>{label(s)}</MenuItem>)}</TextField>
    <Button variant="contained" disabled={busy || !eligible || !!unavailable} onClick={saveProgress}>Save progress</Button></Stack></Box>
    {progress && !report && <Stack spacing={2}><Typography variant="h6">Create a report draft</Typography>{templates.length===0 && <Alert severity="info">No active report templates are available.</Alert>}<TextField select label="Report template" value={template} onChange={e=>setTemplate(e.target.value)}>{templates.map(t=><MenuItem key={t._id} value={t._id}>{t.name}</MenuItem>)}</TextField><Button disabled={!template || busy || dirty || !eligible} onClick={generate}>Generate report draft</Button>{dirty && <Typography>Save progress before generating a draft.</Typography>}</Stack>}
    {report && progress && <ReportReview key={report._id} api={api} initial={report} progress={progress} childId={identity(participation.childId)} parentEmail={parentEmail} />}
  </Stack>;
}
function ReportReview({ api, initial, progress, childId, parentEmail }: { api: WorkflowService; initial: WorkflowReport; progress: Progress; childId: string; parentEmail: string }) {
  const [report,setReport]=useState(initial);const [title,setTitle]=useState(initial.title);const [content,setContent]=useState(initial.content);const [fields,setFields]=useState(initial.customFieldValues || {});
  const [dirty,setDirty]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [confirm,setConfirm]=useState<'approve'|'send'|'refresh'|''>('');
  const editable=['draft','review'].includes(report.status);const finalized=['approved','sent'].includes(report.status);const snapshot=report.finalizedSnapshot;
  const validFinalized = !!snapshot && typeof snapshot.parentVisibleContent === 'string' && typeof snapshot.reportMetadata?.title === 'string';
  function adopt(r: WorkflowReport) {setReport(r);setTitle(r.title);setContent(r.content);setFields(r.customFieldValues || {});setDirty(false);}
  async function action(kind: string) {
    setConfirm('');setBusy(true);setError('');setNotice('');
    try {
      if(kind==='save') {
        if(!title.trim() || !content.trim()) throw new Error('Report title and content are required.');
        const custom={...fields};for(const f of report.templateSnapshot?.customFields || []) {if(f.isRequired && (custom[f.name]===undefined || custom[f.name]===''))throw new Error(f.name + ' is required.');if(['rating','percentage'].includes(f.type) && custom[f.name]!==undefined && custom[f.name]!==''){const value=Number(custom[f.name]);if(!Number.isFinite(value)||(f.type==='percentage'&&(value<0||value>100)))throw new Error(f.name + ' has an invalid value.');custom[f.name]=value;}}
        adopt(await api.edit(report._id,{title,content,customFieldValues:custom}));setNotice('Draft saved. Not sent to parents.');
      } else if(kind==='approve') adopt(await api.approve(report._id));
      else if(kind==='refresh') {const latest=await api.findReport(childId,progress._id);if(!latest)throw new Error('Report is no longer available.');adopt(latest);}
      else {const result=await api.send(report._id,parentEmail);if(!result.success) {setError(result.error || result.message || 'Sending failed.');return;}setReport({...report,status:'sent'});setNotice(result.message || 'Email transport accepted the report.');}
    } catch(e) {setError(workflowError(e));} finally {setBusy(false);}
  }
  return <Paper sx={{p:3}}><Stack spacing={2}><Typography variant="h5">Report review</Typography><Chip label={finalized ? (report.status==='sent'?'Sent':'Finalized') : 'DRAFT — not sent to parents'} color={finalized?'success':'warning'} />
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="info">{notice}</Alert>}
    {finalized && !validFinalized && <Alert severity="error">Finalized content is unavailable. Refresh or contact your administrator before sending.</Alert>}<Typography variant="h6">Internal information</Typography><Typography>Saved observations: {progress.observations || 'None'}. Progress remains separate from the report snapshot. Review the parent-visible text below before finalizing.</Typography>
    <Typography variant="h6">Parent-visible report</Typography>
    <TextField label="Report title" value={finalized ? snapshot?.reportMetadata?.title || '' : title} inputProps={{readOnly:!editable,maxLength:100}} disabled={busy} onChange={e=>{setTitle(e.target.value);setDirty(true);}} />
    <TextField label="Parent-visible content" multiline minRows={7} value={finalized ? snapshot?.parentVisibleContent ?? '' : content} inputProps={{readOnly:!editable,maxLength:10000}} disabled={busy} onChange={e=>{setContent(e.target.value);setDirty(true);}} />
    <Typography variant="h6">Report custom fields</Typography>{!(report.templateSnapshot?.customFields?.length) && <Typography>No template custom fields.</Typography>}
    {(report.templateSnapshot?.customFields || []).map(f=><ValueInput key={f.name} name={f.name} type={f.type} value={(finalized ? snapshot?.customFieldValues || {} : fields)?.[f.name]} disabled={busy || !editable} onChange={v=>{setFields({...fields,[f.name]:v});setDirty(true);}} />)}
    {editable && <Stack direction="row" spacing={2}><Button disabled={busy} onClick={()=>action('save')}>Save draft</Button><Button variant="contained" disabled={busy || dirty} onClick={()=>setConfirm('approve')}>Approve / Finalize</Button></Stack>}
    {dirty && <Typography>Save your edits before approval.</Typography>}
    {report.status==='approved' && <Button disabled={busy || !parentEmail || !validFinalized} onClick={()=>setConfirm('send')}>Send finalized report</Button>}
    {report.status==='approved' && !parentEmail && <Alert severity="warning">No authorized parent email is available.</Alert>}
    <Button disabled={busy} onClick={()=>setConfirm('refresh')}>Refresh latest report</Button>
    <Dialog open={!!confirm} onClose={()=>setConfirm('')}><DialogTitle>{confirm==='approve'?'Finalize this report?':confirm==='send'?'Send this finalized report?':'Refresh the report?'}</DialogTitle><DialogContent>{confirm==='approve'?'You are approving the parent-visible content and custom fields. Normal editing will be locked. This does not send the report.':confirm==='send'?'Send the finalized report to ' + parentEmail + '? Transport acceptance does not prove inbox delivery.':'Refreshing replaces your local edits with the latest saved report.'}</DialogContent><DialogActions><Button onClick={()=>setConfirm('')}>Cancel</Button><Button onClick={()=>action(confirm)}>{confirm==='approve'?'Confirm finalization':confirm==='send'?'Confirm send':'Confirm refresh'}</Button></DialogActions></Dialog>
  </Stack></Paper>;
}
