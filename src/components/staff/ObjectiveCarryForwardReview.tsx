import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { CarryForwardSuggestion, carryForwardFailure, objectiveCarryForwardService } from '../../services/objectiveCarryForwardService';

export default function ObjectiveCarryForwardReview({ token, schoolId, progressId }: { token: string; schoolId: string; progressId: string }) {
  const api = useMemo(() => objectiveCarryForwardService(token, schoolId), [token, schoolId]);
  const [suggestions, setSuggestions] = useState<CarryForwardSuggestion[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { title: string; description: string; expectedOutcome: string; instructionalGuidance: string }>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    api.suggestions(progressId).then(rows => { if (active) { setSuggestions(rows); setEdits(Object.fromEntries(rows.map(row => [row.objectiveId, { title: row.title, description: row.description || '', expectedOutcome: row.expectedOutcome || '', instructionalGuidance: '' }]))); } }).catch(() => { if (active) setError(carryForwardFailure); });
    return () => { active = false; };
  }, [api, progressId]);
  async function accept(suggestion: CarryForwardSuggestion) {
    const target = targets[suggestion.objectiveId];
    if (!target) return;
    setBusy(suggestion.objectiveId); setError(''); setNotice('');
    try {
      await api.accept(progressId, suggestion.objectiveId, target, edits[suggestion.objectiveId]);
      setDismissed(previous => new Set(previous).add(suggestion.objectiveId));
      setNotice('Objective added to the selected draft Planned Session for review and editing.');
    } catch (_) { setError(carryForwardFailure); } finally { setBusy(''); }
  }
  const visible = suggestions.filter(suggestion => !dismissed.has(suggestion.objectiveId));
  if (!visible.length && !error && !notice) return null;
  return <Stack spacing={2}>
    <Typography variant="h6">Unfinished objective review</Typography>
    <Typography>Only saved “not achieved” and “partially achieved” results appear here. Review each suggestion before adding it to a compatible draft session.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{notice && <Alert severity="success">{notice}</Alert>}
    {visible.map(suggestion => <Paper key={suggestion.objectiveId} variant="outlined" sx={{ p: 2 }}><Stack spacing={1.5}>
      <Typography variant="subtitle1">{suggestion.title}</Typography>
      <Typography>Status: {suggestion.status.replace(/_/g, ' ')}</Typography>
      <TextField label="Objective title" value={edits[suggestion.objectiveId]?.title || ''} onChange={event => setEdits({ ...edits, [suggestion.objectiveId]: { ...edits[suggestion.objectiveId], title: event.target.value } })} />
      <TextField label="Description" multiline value={edits[suggestion.objectiveId]?.description || ''} onChange={event => setEdits({ ...edits, [suggestion.objectiveId]: { ...edits[suggestion.objectiveId], description: event.target.value } })} />
      <TextField label="Expected outcome" multiline value={edits[suggestion.objectiveId]?.expectedOutcome || ''} onChange={event => setEdits({ ...edits, [suggestion.objectiveId]: { ...edits[suggestion.objectiveId], expectedOutcome: event.target.value } })} />
      <TextField label="Instructional guidance" multiline value={edits[suggestion.objectiveId]?.instructionalGuidance || ''} onChange={event => setEdits({ ...edits, [suggestion.objectiveId]: { ...edits[suggestion.objectiveId], instructionalGuidance: event.target.value } })} />
      <TextField select label={'Future session for ' + suggestion.title} value={targets[suggestion.objectiveId] || ''} onChange={event => setTargets({ ...targets, [suggestion.objectiveId]: event.target.value })}>
        {suggestion.targets.map(target => <MenuItem key={target._id} value={target._id}>{target.sequence}. {target.title}</MenuItem>)}
      </TextField>
      <Stack direction="row" spacing={1}><Button variant="contained" disabled={!targets[suggestion.objectiveId] || !edits[suggestion.objectiveId]?.title.trim() || !!busy} onClick={() => accept(suggestion)}>Carry forward</Button><Button disabled={!!busy} onClick={() => setDismissed(previous => new Set(previous).add(suggestion.objectiveId))}>Reject suggestion</Button></Stack>
    </Stack></Paper>)}
  </Stack>;
}
