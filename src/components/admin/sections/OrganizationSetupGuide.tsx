import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { organizationSetupReadinessService, OrganizationSetupReadiness } from '../../../services/organizationSetupReadinessService';

const schoolIdOf = (schoolId: unknown) => typeof schoolId === 'string' ? schoolId : (schoolId as { _id?: string } | undefined)?._id || '';

export type SetupGuideDestination = 'programs' | 'levels' | 'assessment' | 'plans' | 'activation';

// The existing configuration workflow nests every later setup area beneath a
// selected Program and Level, so all guide actions begin on the Programs tab.
export const configurationSectionForSetupDestination = (_destination: SetupGuideDestination) => 'programs' as const;

const actionLabels: Record<SetupGuideDestination, string> = {
  programs: 'Open Programs',
  levels: 'Open Programs and Levels',
  assessment: 'Open Requirements and Parameters',
  plans: 'Open Roadmaps and Planned Sessions',
  activation: 'Open Roadmap and Session Activation'
};

export default function OrganizationSetupGuide({ onOpenConfiguration }: { onOpenConfiguration: (destination: SetupGuideDestination) => void }) {
  const { user, token } = useAuth();
  const schoolId = schoolIdOf(user?.schoolId);
  const api = useMemo(() => token && schoolId ? organizationSetupReadinessService(token, schoolId) : null, [token, schoolId]);
  const [result, setResult] = useState<OrganizationSetupReadiness>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!api || user?.role !== 'school_admin') {
      setError('Organization Administrator access is required.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try { setResult(await api.load()); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to check setup readiness.'); }
    finally { setLoading(false); }
  }, [api, user?.role]);

  useEffect(() => { load(); }, [load]);

  return <Box sx={{ maxWidth: 900, mx: 'auto' }}>
    <Stack spacing={1} sx={{ mb: 3 }}>
      <Typography variant="h4">Organization Setup Guide</Typography>
      <Typography color="text.secondary">See what is ready and what needs attention before staff begin delivering sessions.</Typography>
    </Stack>
    {loading && <Stack alignItems="center" spacing={2} sx={{ py: 8 }}><CircularProgress /><Typography>Checking your setup…</Typography></Stack>}
    {!loading && error && <Alert severity="error" action={<Button color="inherit" onClick={load}>Retry</Button>}>{error}</Alert>}
    {!loading && !error && result && <Stack spacing={2}>
      <Alert severity={result.ready ? 'success' : 'info'}>
        {result.ready ? 'Your organization setup is ready for delivery.' : 'Complete the steps below before beginning normal delivery.'}
      </Alert>
      {result.steps.map((step, index) => <Card key={step.key} variant="outlined">
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            {step.status === 'complete' ? <CheckCircle color="success" /> : <RadioButtonUnchecked color="disabled" />}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">{index + 1}. {step.title}</Typography>
              <Typography color="text.secondary">{step.description}</Typography>
            </Box>
            <Chip label={step.status === 'complete' ? 'Complete' : 'Needs attention'} color={step.status === 'complete' ? 'success' : 'default'} />
            {step.status === 'needs_attention' && <Button onClick={() => onOpenConfiguration(step.key)}>
              {actionLabels[step.key]}
            </Button>}
          </Stack>
        </CardContent>
      </Card>)}
    </Stack>}
  </Box>;
}
