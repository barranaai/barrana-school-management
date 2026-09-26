import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
  MenuItem, Paper, Stack, Step, StepLabel, Stepper, TextField, Typography
} from '@mui/material';
import { Add, ArrowBack, Delete, Edit, Publish, Visibility } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import apiService, { OnboardingMetadata } from '../../services/apiService';
import {
  StandardPackage, StandardPackageDraftInput, StandardPackageServiceError,
  StandardParameterType, standardPackageService
} from '../../services/standardPackageService';

const steps = ['Package Details', 'Programs & Levels', 'Requirements & Parameters', 'Roadmaps & Sessions', 'Review'];
const parameterTypes: StandardParameterType[] = ['text', 'rating', 'percentage', 'number', 'checkbox', 'select'];
const blank = (): StandardPackageDraftInput => ({
  slug: '', name: '', description: '', version: 1, organizationTypes: [],
  definition: { programs: [] }
});
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const keyFrom = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const safeError = (error: unknown) => {
  if (error instanceof StandardPackageServiceError) {
    if (error.code === 'INVALID_PACKAGE') return 'The package is incomplete or contains unsupported information.';
    if (error.code === 'CONFLICT') return 'The package changed or this slug and version already exist.';
    if (error.code === 'NOT_AUTHORIZED') return 'Platform Administrator access is required.';
    if (error.code === 'NOT_FOUND') return 'The package is no longer available.';
  }
  return 'The Standard Package operation could not be completed.';
};

function Review({ pkg }: { pkg: StandardPackage | StandardPackageDraftInput }) {
  const programs = pkg.definition?.programs || [];
  return <Stack spacing={2}>
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h5">{pkg.name || 'Unnamed package'} - version {pkg.version}</Typography>
      <Typography color="text.secondary">{pkg.slug}</Typography>
      <Typography>{pkg.description || 'No description'}</Typography>
      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
        {(pkg.organizationTypes || []).length
          ? pkg.organizationTypes.map(type => <Chip key={type} label={type.replace(/_/g, ' ')} size="small" />)
          : <Chip label="All organization types" size="small" />}
      </Stack>
    </Paper>
    {!programs.length && <Alert severity="warning">At least one Program is required.</Alert>}
    {programs.map(program => <Card key={program.key} variant="outlined"><CardContent>
      <Typography variant="h6">Program: {program.name}</Typography>
      {program.levels.map(level => <Box key={level.key} sx={{ ml: 2, mt: 1 }}>
        <Typography fontWeight={700}>Level: {level.name}</Typography>
        {level.requirements.map(requirement => <Box key={requirement.key} sx={{ ml: 2 }}>
          <Typography>Requirement: {requirement.name}</Typography>
          <Typography variant="body2">Parameters: {requirement.parameters.map(parameter => `${parameter.name} (${parameter.type})`).join(', ') || 'None'}</Typography>
        </Box>)}
      </Box>)}
      {program.roadmaps.map(roadmap => <Box key={roadmap.key} sx={{ ml: 2, mt: 2 }}>
        <Typography fontWeight={700}>Roadmap: {roadmap.name} for {roadmap.levelKey}</Typography>
        {roadmap.plannedSessions.map(session => <Box key={session.sequence} sx={{ ml: 2 }}>
          <Typography>Session {session.sequence}: {session.title}</Typography>
          <Typography variant="body2">Objectives: {session.objectives.map(objective => objective.title).join(', ') || 'None'}</Typography>
        </Box>)}
      </Box>)}
    </CardContent></Card>)}
  </Stack>;
}

function Editor({ initial, types, cancel, save }: {
  initial?: StandardPackage;
  types: OnboardingMetadata['organizationTypes'];
  cancel: () => void;
  save: (draft: StandardPackageDraftInput) => Promise<void>;
}) {
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<StandardPackageDraftInput>(() => initial ? {
    slug: initial.slug, name: initial.name, description: initial.description || '',
    version: initial.version, organizationTypes: initial.organizationTypes,
    definition: initial.definition || { programs: [] }
  } : blank());
  const mutate = (fn: (next: StandardPackageDraftInput) => void) =>
    setDraft(value => { const next = copy(value); fn(next); return next; });
  const programs = draft.definition.programs;

  const detailsProblem = () =>
    !draft.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) || draft.version < 1
      ? 'Enter a name, lowercase hyphenated slug and positive version.'
      : '';
  const problem = () => {
    const detailsIssue = detailsProblem();
    if (detailsIssue) return detailsIssue;
    if (!programs.length) return 'Add at least one Program.';
    for (const program of programs) {
      if (!program.key || !program.name) return 'Every Program needs a key and name.';
      for (const level of program.levels) {
        if (!level.key || !level.name) return 'Every Level needs a key and name.';
        for (const requirement of level.requirements) {
          if (!requirement.key || !requirement.name) return 'Every Requirement needs a key and name.';
          for (const parameter of requirement.parameters) {
            if (!parameter.key || !parameter.name || (parameter.type === 'select' && !parameter.options?.length)) return 'Complete every Parameter; select Parameters need options.';
          }
        }
      }
      for (const roadmap of program.roadmaps) {
        if (!roadmap.key || !roadmap.name || !roadmap.levelKey) return 'Every Roadmap needs a key, name and Level.';
        for (const session of roadmap.plannedSessions) {
          if (!session.title || session.sequence < 1 || session.objectives.some(objective => !objective.title)) return 'Complete every Planned Session and Objective.';
        }
      }
    }
    return '';
  };
  const next = () => { const issue = active === 0 ? detailsProblem() : problem(); if (issue) return setError(issue); setError(''); setActive(value => value + 1); };

  return <Box>
    <Button startIcon={<ArrowBack />} onClick={cancel}>Back to catalog</Button>
    <Typography variant="h4" mt={2}>{initial ? 'Edit Standard Package Draft' : 'Create Standard Package'}</Typography>
    <Stepper activeStep={active} alternativeLabel sx={{ my: 3 }}>{steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    {active === 0 && <Stack spacing={2}>
      <TextField label="Package name" required value={draft.name} onChange={event => mutate(nextDraft => { nextDraft.name = event.target.value; })} />
      <TextField label="Slug" required disabled={Boolean(initial)} value={draft.slug} helperText="Lowercase letters, numbers and hyphens." onChange={event => mutate(nextDraft => { nextDraft.slug = keyFrom(event.target.value); })} />
      <TextField label="Description" multiline minRows={3} value={draft.description} onChange={event => mutate(nextDraft => { nextDraft.description = event.target.value; })} />
      <TextField label="Version" type="number" required disabled={Boolean(initial)} value={draft.version} inputProps={{ min: 1 }} onChange={event => mutate(nextDraft => { nextDraft.version = Number(event.target.value); })} />
      <Typography fontWeight={700}>Compatible organization types</Typography>
      <Stack>{types.map(type => <FormControlLabel key={type.value} label={type.label} control={<Checkbox checked={draft.organizationTypes.includes(type.value)} onChange={event => mutate(nextDraft => {
        nextDraft.organizationTypes = event.target.checked
          ? [...nextDraft.organizationTypes, type.value]
          : nextDraft.organizationTypes.filter(value => value !== type.value);
      })} />} />)}</Stack>
      <Typography variant="body2">Leave all unchecked for all organization types.</Typography>
    </Stack>}

    {active === 1 && <Stack spacing={2}>
      <Button startIcon={<Add />} variant="outlined" onClick={() => mutate(nextDraft => {
        const number = nextDraft.definition.programs.length + 1;
        nextDraft.definition.programs.push({ key: `program-${number}`, name: '', description: '', displayOrder: number, levels: [], roadmaps: [] });
      })}>Add Program</Button>
      {programs.map((program, pi) => <Card key={pi} variant="outlined"><CardContent><Stack spacing={1}>
        <Stack direction="row" justifyContent="space-between"><Typography variant="h6">Program {pi + 1}</Typography><Button color="error" startIcon={<Delete />} onClick={() => mutate(nextDraft => { nextDraft.definition.programs.splice(pi, 1); })}>Remove</Button></Stack>
        <TextField label="Program key" required value={program.key} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].key = keyFrom(event.target.value); })} />
        <TextField label="Program name" required value={program.name} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].name = event.target.value; })} />
        <TextField label="Description" value={program.description || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].description = event.target.value; })} />
        <Button startIcon={<Add />} onClick={() => mutate(nextDraft => {
          const levels = nextDraft.definition.programs[pi].levels; const number = levels.length + 1;
          levels.push({ key: `${program.key || 'program'}-level-${number}`, name: '', description: '', sequence: number, requirements: [] });
        })}>Add Level</Button>
        {program.levels.map((level, li) => <Paper key={li} variant="outlined" sx={{ p: 2 }}><Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between"><Typography>Level {li + 1}</Typography><Button color="error" onClick={() => mutate(nextDraft => { nextDraft.definition.programs[pi].levels.splice(li, 1); })}>Remove</Button></Stack>
          <TextField label="Level key" required value={level.key} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].key = keyFrom(event.target.value); })} />
          <TextField label="Level name" required value={level.name} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].name = event.target.value; })} />
          <TextField label="Description" value={level.description || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].description = event.target.value; })} />
        </Stack></Paper>)}
      </Stack></CardContent></Card>)}
    </Stack>}

    {active === 2 && <Stack spacing={2}>{programs.map((program, pi) => <Card key={program.key} variant="outlined"><CardContent>
      <Typography variant="h6">{program.name}</Typography>
      {program.levels.map((level, li) => <Box key={level.key} sx={{ mt: 2 }}><Typography fontWeight={700}>{level.name}</Typography>
        <Button startIcon={<Add />} onClick={() => mutate(nextDraft => {
          const requirements = nextDraft.definition.programs[pi].levels[li].requirements; const number = requirements.length + 1;
          requirements.push({ key: `${level.key}-requirement-${number}`, name: '', description: '', sequence: number, isRequired: true, parameters: [] });
        })}>Add Requirement</Button>
        {level.requirements.map((requirement, ri) => <Paper key={ri} variant="outlined" sx={{ p: 2, my: 1 }}><Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between"><Typography>Requirement {ri + 1}</Typography><Button color="error" onClick={() => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements.splice(ri, 1); })}>Remove</Button></Stack>
          <TextField label="Requirement key" required value={requirement.key} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements[ri].key = keyFrom(event.target.value); })} />
          <TextField label="Requirement name" required value={requirement.name} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements[ri].name = event.target.value; })} />
          <TextField label="Description" value={requirement.description || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements[ri].description = event.target.value; })} />
          <Button startIcon={<Add />} onClick={() => mutate(nextDraft => {
            const parameters = nextDraft.definition.programs[pi].levels[li].requirements[ri].parameters; const number = parameters.length + 1;
            parameters.push({ key: `${requirement.key}-parameter-${number}`, name: '', type: 'text', sequence: number });
          })}>Add Parameter</Button>
          {requirement.parameters.map((parameter, xi) => <Box key={xi} sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}><Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between"><Typography>Parameter {xi + 1}</Typography><Button color="error" onClick={() => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements[ri].parameters.splice(xi, 1); })}>Remove</Button></Stack>
            <TextField label="Parameter key" required value={parameter.key} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements[ri].parameters[xi].key = keyFrom(event.target.value); })} />
            <TextField label="Parameter name" required value={parameter.name} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].levels[li].requirements[ri].parameters[xi].name = event.target.value; })} />
            <TextField select label="Parameter type" value={parameter.type} onChange={event => mutate(nextDraft => {
              const target = nextDraft.definition.programs[pi].levels[li].requirements[ri].parameters[xi];
              target.type = event.target.value as StandardParameterType;
              if (target.type !== 'select') delete target.options;
            })}>{parameterTypes.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField>
            {parameter.type === 'select' && <TextField label="Options" helperText="Comma-separated" value={(parameter.options || []).join(', ')} onChange={event => mutate(nextDraft => {
              nextDraft.definition.programs[pi].levels[li].requirements[ri].parameters[xi].options = event.target.value.split(',').map(value => value.trim()).filter(Boolean);
            })} />}
          </Stack></Box>)}
        </Stack></Paper>)}
      </Box>)}
    </CardContent></Card>)}</Stack>}

    {active === 3 && <Stack spacing={2}>{programs.map((program, pi) => {
      const requirements = program.levels.flatMap(level => level.requirements);
      const parameters = requirements.flatMap(requirement => requirement.parameters.map(parameter => ({ ...parameter, requirementKey: requirement.key })));
      return <Card key={program.key} variant="outlined"><CardContent><Typography variant="h6">{program.name}</Typography>
        <Button startIcon={<Add />} onClick={() => mutate(nextDraft => {
          const roadmaps = nextDraft.definition.programs[pi].roadmaps; const number = roadmaps.length + 1;
          roadmaps.push({ key: `${program.key}-roadmap-${number}`, levelKey: program.levels[0]?.key || '', name: '', version: 1, methodology: '', plannedSessions: [] });
        })}>Add Roadmap</Button>
        {program.roadmaps.map((roadmap, mi) => <Paper key={mi} variant="outlined" sx={{ p: 2, my: 1 }}><Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Roadmap {mi + 1}</Typography><Button color="error" onClick={() => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps.splice(mi, 1); })}>Remove</Button></Stack>
          <TextField label="Roadmap key" required value={roadmap.key} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].key = keyFrom(event.target.value); })} />
          <TextField label="Roadmap name" required value={roadmap.name} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].name = event.target.value; })} />
          <TextField select label="Level" required value={roadmap.levelKey} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].levelKey = event.target.value; })}>{program.levels.map(level => <MenuItem key={level.key} value={level.key}>{level.name}</MenuItem>)}</TextField>
          <TextField label="Methodology" value={roadmap.methodology || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].methodology = event.target.value; })} />
          <Button startIcon={<Add />} onClick={() => mutate(nextDraft => {
            const sessions = nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions;
            sessions.push({ sequence: sessions.length + 1, title: '', description: '', methodology: '', objectives: [] });
          })}>Add Planned Session</Button>
          {roadmap.plannedSessions.map((session, si) => <Box key={si} sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}><Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between"><Typography>Planned Session {si + 1}</Typography><Button color="error" onClick={() => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions.splice(si, 1); })}>Remove</Button></Stack>
            <TextField label="Sequence" type="number" value={session.sequence} inputProps={{ min: 1 }} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].sequence = Number(event.target.value); })} />
            <TextField label="Session title" required value={session.title} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].title = event.target.value; })} />
            <TextField label="Description" value={session.description || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].description = event.target.value; })} />
            <Button startIcon={<Add />} onClick={() => mutate(nextDraft => {
              const objectives = nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].objectives;
              objectives.push({ sequence: objectives.length + 1, title: '', expectedOutcome: '' });
            })}>Add Objective</Button>
            {session.objectives.map((objective, oi) => <Paper key={oi} variant="outlined" sx={{ p: 1 }}><Stack spacing={1}>
              <TextField label="Objective title" required value={objective.title} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].objectives[oi].title = event.target.value; })} />
              <TextField label="Expected outcome" value={objective.expectedOutcome || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].objectives[oi].expectedOutcome = event.target.value; })} />
              <TextField select label="Requirement (optional)" value={objective.requirementKey || ''} onChange={event => mutate(nextDraft => {
                const target = nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].objectives[oi];
                target.requirementKey = event.target.value || undefined; target.parameterKey = undefined;
              })}><MenuItem value="">None</MenuItem>{requirements.map(requirement => <MenuItem key={requirement.key} value={requirement.key}>{requirement.name}</MenuItem>)}</TextField>
              <TextField select label="Parameter (optional)" disabled={!objective.requirementKey} value={objective.parameterKey || ''} onChange={event => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].objectives[oi].parameterKey = event.target.value || undefined; })}><MenuItem value="">None</MenuItem>{parameters.filter(parameter => parameter.requirementKey === objective.requirementKey).map(parameter => <MenuItem key={parameter.key} value={parameter.key}>{parameter.name}</MenuItem>)}</TextField>
              <Button color="error" onClick={() => mutate(nextDraft => { nextDraft.definition.programs[pi].roadmaps[mi].plannedSessions[si].objectives.splice(oi, 1); })}>Remove Objective</Button>
            </Stack></Paper>)}
          </Stack></Box>)}
        </Stack></Paper>)}
      </CardContent></Card>;
    })}</Stack>}

    {active === 4 && <Review pkg={draft} />}
    <Stack direction="row" justifyContent="space-between" mt={3}>
      <Button disabled={active === 0} onClick={() => { setError(''); setActive(value => value - 1); }}>Back</Button>
      {active < 4
        ? <Button variant="contained" onClick={next}>Continue</Button>
        : <Button variant="contained" onClick={async () => { const issue = problem(); if (issue) return setError(issue); await save(draft); }}>Save Draft</Button>}
    </Stack>
  </Box>;
}

export default function StandardPackageCatalogManagement() {
  const { user, token } = useAuth();
  const api = useMemo(() => standardPackageService(token || ''), [token]);
  const [packages, setPackages] = useState<StandardPackage[]>([]);
  const [metadata, setMetadata] = useState<OnboardingMetadata>();
  const [selected, setSelected] = useState<StandardPackage>();
  const [mode, setMode] = useState<'catalog' | 'create' | 'edit' | 'view'>('catalog');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publishTarget, setPublishTarget] = useState<StandardPackage>();

  const load = useCallback(async () => {
    if (!token || user?.role !== 'super_admin') return;
    setLoading(true); setError('');
    try {
      const [catalog, response] = await Promise.all([api.listCatalog(), apiService.getOnboardingMetadata()]);
      if (!response.success || !response.data) throw new Error('metadata');
      setPackages(catalog); setMetadata(response.data);
    } catch (caught) { setError(safeError(caught)); } finally { setLoading(false); }
  }, [api, token, user?.role]);
  useEffect(() => { load(); }, [load]);

  if (user?.role !== 'super_admin') return <Alert severity="error">Platform Administrator access required.</Alert>;

  const open = async (pkg: StandardPackage, nextMode: 'edit' | 'view') => {
    setLoading(true); setError('');
    try { setSelected(await api.get(pkg._id)); setMode(nextMode); }
    catch (caught) { setError(safeError(caught)); }
    finally { setLoading(false); }
  };
  const save = async (input: StandardPackageDraftInput) => {
    setLoading(true); setError('');
    try {
      if (mode === 'edit' && selected) await api.updateDraft(selected._id, {
        name: input.name, description: input.description,
        organizationTypes: input.organizationTypes, definition: input.definition
      });
      else await api.createDraft(input);
      setNotice('Standard Package draft saved.'); setMode('catalog'); setSelected(undefined); await load();
    } catch (caught) { setError(safeError(caught)); } finally { setLoading(false); }
  };
  const publish = async () => {
    if (!publishTarget) return;
    setLoading(true); setError('');
    try {
      await api.publish(publishTarget._id);
      setNotice('Standard Package published. Existing organization-owned copies were not changed.');
      setPublishTarget(undefined); await load();
    } catch (caught) { setPublishTarget(undefined); setError(safeError(caught)); }
    finally { setLoading(false); }
  };

  if (mode === 'create' || mode === 'edit') return <Box>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Editor initial={mode === 'edit' ? selected : undefined} types={metadata?.organizationTypes || []}
      cancel={() => { setMode('catalog'); setSelected(undefined); setError(''); }} save={save} />
  </Box>;
  if (mode === 'view' && selected) return <Box>
    <Button startIcon={<ArrowBack />} onClick={() => { setMode('catalog'); setSelected(undefined); }}>Back to catalog</Button>
    <Typography variant="h4" my={2}>Standard Package Review</Typography>
    <Alert severity="info" sx={{ mb: 2 }}>This global definition is independent from organization-owned adopted copies.</Alert>
    <Review pkg={selected} />
  </Box>;

  const groups = packages.reduce<Record<string, StandardPackage[]>>((all, pkg) => {
    (all[pkg.slug] ||= []).push(pkg); return all;
  }, {});
  return <Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} mb={3}>
      <Box><Typography variant="h4">Standard Packages</Typography><Typography color="text.secondary">Create and publish global reusable Kidsible configuration.</Typography></Box>
      <Button variant="contained" startIcon={<Add />} disabled={!metadata} onClick={() => setMode('create')}>Create Package</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
    {loading && <CircularProgress aria-label="Loading Standard Package catalog" />}
    {!loading && !packages.length && <Alert severity="info">No Standard Packages exist yet.</Alert>}
    <Stack spacing={2}>{Object.entries(groups).map(([slug, versions]) => <Card key={slug} variant="outlined"><CardContent>
      <Typography variant="h6">{versions[0].name}</Typography><Typography color="text.secondary">{slug}</Typography><Divider sx={{ my: 1 }} />
      {versions.map(pkg => <Stack key={pkg._id} direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={1} py={1}>
        <Typography>Version {pkg.version}</Typography>
        <Chip label={pkg.status} color={pkg.status === 'published' ? 'success' : pkg.status === 'draft' ? 'warning' : 'default'} size="small" />
        <Typography sx={{ flex: 1 }}>{pkg.organizationTypes.length ? pkg.organizationTypes.map(type => type.replace(/_/g, ' ')).join(', ') : 'All organization types'}</Typography>
        <Typography variant="body2">
          Created {pkg.createdAt ? new Date(pkg.createdAt).toLocaleDateString() : 'unknown'} · Updated {pkg.updatedAt ? new Date(pkg.updatedAt).toLocaleDateString() : 'unknown'}
          {pkg.publishedAt ? ` · Published ${new Date(pkg.publishedAt).toLocaleDateString()}` : ''}
        </Typography>
        <Button startIcon={<Visibility />} onClick={() => open(pkg, 'view')}>View</Button>
        {pkg.status === 'draft' && <Button startIcon={<Edit />} onClick={() => open(pkg, 'edit')}>Edit</Button>}
        {pkg.status === 'draft' && <Button startIcon={<Publish />} onClick={() => setPublishTarget(pkg)}>Publish</Button>}
      </Stack>)}
    </CardContent></Card>)}</Stack>
    <Dialog open={Boolean(publishTarget)} onClose={() => setPublishTarget(undefined)}>
      <DialogTitle>Publish Standard Package?</DialogTitle>
      <DialogContent><Typography>Publish {publishTarget?.name} version {publishTarget?.version}? It becomes read-only and existing adopted copies remain unchanged.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setPublishTarget(undefined)}>Cancel</Button><Button variant="contained" onClick={publish}>Confirm Publish</Button></DialogActions>
    </Dialog>
  </Box>;
}
