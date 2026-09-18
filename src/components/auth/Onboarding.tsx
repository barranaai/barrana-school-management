import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PLATFORM } from '../../constants/platformBranding';
import { useAuth } from '../../contexts/AuthContext';
import {
  CompleteOnboardingInput,
  OnboardingAccountType,
  OnboardingMetadata,
  OnboardingPackage,
  apiService
} from '../../services/apiService';

const steps = ['Workspace type', 'Organization type', 'Setup', 'Workspace details', 'Secure account', 'Review'];
const safeStartError = 'We could not send the setup email. Please check your information and try again.';
const safeCompleteError = 'We could not create your workspace. Please review the information and try again.';

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', background: `linear-gradient(135deg, ${PLATFORM.colors.primary} 0%, ${PLATFORM.colors.secondary} 100%)`, py: { xs: 2, md: 5 }, px: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 900, mx: 'auto', borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Box component="img" src={PLATFORM.logo} alt={PLATFORM.name} sx={{ height: 58, maxWidth: '100%', objectFit: 'contain' }} />
            <Typography color="text.secondary" align="center">{PLATFORM.tagline}</Typography>
          </Stack>
          {children}
        </CardContent>
      </Card>
    </Box>
  );
}

function ResendPanel({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function resend() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    const response = await apiService.resendOnboarding(email.trim());
    setBusy(false);
    if (response.success) setSent(true);
    else setError('We could not resend the setup email. Please try again later.');
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {sent && <Alert severity="success">If this email can continue onboarding, a new setup link has been sent.</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Email" type="email" value={email} onChange={event => setEmail(event.target.value)} fullWidth />
      <Button variant="outlined" onClick={resend} disabled={busy}>{busy ? 'Sending...' : 'Resend setup link'}</Button>
    </Stack>
  );
}

export function OnboardingStart() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.firstName.trim().length < 2 || form.lastName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Enter your name and a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    const response = await apiService.startOnboarding({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim()
    });
    setBusy(false);
    if (response.success) setSubmitted(true);
    else setError(safeStartError);
  }

  return (
    <PageShell>
      <Typography variant="h4" align="center" fontWeight={700}>Create your Kidsible workspace</Typography>
      <Typography align="center" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Start an organization or an independent practice. We will verify your email before creating anything.
      </Typography>
      {submitted ? (
        <Stack spacing={2}>
          <Alert severity="success">If this email can be used, Kidsible has sent the next step. Check your inbox for a secure setup link.</Alert>
          <ResendPanel initialEmail={form.email} />
          <Button onClick={() => navigate('/login')}>Back to sign in</Button>
        </Stack>
      ) : (
        <Box component="form" onSubmit={submit} noValidate>
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="First name" value={form.firstName} onChange={event => setForm(value => ({ ...value, firstName: event.target.value }))} fullWidth required />
              <TextField label="Last name" value={form.lastName} onChange={event => setForm(value => ({ ...value, lastName: event.target.value }))} fullWidth required />
            </Stack>
            <TextField label="Work email" type="email" value={form.email} onChange={event => setForm(value => ({ ...value, email: event.target.value }))} fullWidth required />
            <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Sending...' : 'Send secure setup link'}</Button>
            <Button onClick={() => navigate('/login')}>Already have an account? Sign in</Button>
          </Stack>
        </Box>
      )}
    </PageShell>
  );
}

type SetupChoice = 'standard' | 'blank';

type WorkspaceForm = {
  accountType: OnboardingAccountType;
  organizationType: string;
  customOrganizationTypeLabel: string;
  setupChoice: SetupChoice;
  standardPackageId: string;
  workspaceName: string;
  phone: string;
  estimatedParticipants: string;
  schoolType: string;
  estimatedStudents: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  password: string;
  confirmPassword: string;
};

const initialWorkspace: WorkspaceForm = {
  accountType: 'organization',
  organizationType: '',
  customOrganizationTypeLabel: '',
  setupChoice: 'blank',
  standardPackageId: '',
  workspaceName: '',
  phone: '',
  estimatedParticipants: '',
  schoolType: '',
  estimatedStudents: '',
  street: '', city: '', state: '', zipCode: '', country: '',
  password: '', confirmPassword: ''
};


export function OnboardingVerify() {
  const navigate = useNavigate();
  const { authenticateWithToken } = useAuth();
  const [verificationToken] = useState(() => {
    const value = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || '';
    if (window.location.hash) window.history.replaceState(null, '', '/onboarding/verify');
    return value;
  });
  const [verification, setVerification] = useState<'checking' | 'valid' | 'invalid'>(verificationToken ? 'checking' : 'invalid');
  const [metadata, setMetadata] = useState<OnboardingMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const [metadataAttempt, setMetadataAttempt] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState<WorkspaceForm>(initialWorkspace);
  const [packages, setPackages] = useState<OnboardingPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packagesError, setPackagesError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!verificationToken) return;
    let active = true;
    apiService.verifyOnboarding(verificationToken).then(response => {
      if (active) setVerification(response.success && response.data?.valid ? 'valid' : 'invalid');
    });
    return () => { active = false; };
  }, [verificationToken]);

  useEffect(() => {
    if (verification !== 'valid') return;
    let active = true;
    setMetadataLoading(true);
    setMetadataError('');
    apiService.getOnboardingMetadata().then(response => {
      if (!active) return;
      if (response.success && response.data) setMetadata(response.data);
      else setMetadataError('Workspace options are temporarily unavailable. Please try again.');
    }).finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; };
  }, [verification, metadataAttempt]);

  const organizationTypes = useMemo(
    () => metadata?.organizationTypes.filter(item => item.accountTypes.includes('organization')) || [],
    [metadata]
  );
  const soloOrganizationType = useMemo(
    () => metadata?.organizationTypes.find(item => item.accountTypes.includes('solo_practitioner')),
    [metadata]
  );
  const selectedOrganizationType = useMemo(
    () => metadata?.organizationTypes.find(item => item.value === form.organizationType),
    [metadata, form.organizationType]
  );
  const effectiveOrganizationType = form.accountType === 'solo_practitioner'
    ? soloOrganizationType?.value || ''
    : form.organizationType;

  useEffect(() => {
    if (verification !== 'valid' || form.setupChoice !== 'standard' || !effectiveOrganizationType) return;
    let active = true;
    setPackagesLoading(true);
    setPackagesError('');
    setPackages([]);
    setForm(value => ({ ...value, standardPackageId: '' }));
    apiService.listOnboardingPackages(effectiveOrganizationType).then(response => {
      if (!active) return;
      if (response.success && response.data) setPackages(response.data);
      else setPackagesError('Standard Packages are unavailable. You can start blank or try again later.');
    }).finally(() => { if (active) setPackagesLoading(false); });
    return () => { active = false; };
  }, [verification, form.setupChoice, effectiveOrganizationType]);

  const selectedPackage = useMemo(
    () => packages.find(item => item._id === form.standardPackageId),
    [packages, form.standardPackageId]
  );
  const requiresSchoolDetails = form.accountType === 'organization' && selectedOrganizationType?.requiresSchoolDetails === true;

  function update<K extends keyof WorkspaceForm>(key: K, value: WorkspaceForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
  }

  function validateStep(step: number): string {
    if (step === 0 && !form.accountType) return 'Choose a workspace type.';
    if (step === 1 && form.accountType === 'organization') {
      if (!form.organizationType) return 'Choose an organization type.';
      if (form.organizationType === 'other' && form.customOrganizationTypeLabel.trim().length < 2) return 'Describe the organization type.';
    }
    if (step === 2 && form.setupChoice === 'standard' && !form.standardPackageId) return 'Choose a Standard Package or start blank.';
    if (step === 3) {
      if (form.workspaceName.trim().length < 2 || form.workspaceName.trim().length > 100) return 'Workspace name must be between 2 and 100 characters.';
      if (form.estimatedParticipants && (!/^\d+$/.test(form.estimatedParticipants) || Number(form.estimatedParticipants) < 0)) return 'Estimated participants cannot be negative.';
      if (requiresSchoolDetails) {
        if (!form.schoolType || !/^\d+$/.test(form.estimatedStudents) || Number(form.estimatedStudents) < 1) return 'Complete the school type and estimated student count.';
        if (![form.street, form.city, form.state, form.zipCode, form.country].every(value => value.trim())) return 'Complete the required school address.';
      }
    }
    if (step === 4) {
      if (form.password.length < 8 || form.password.length > 128) return 'Password must be between 8 and 128 characters.';
      if (form.password !== form.confirmPassword) return 'Passwords do not match.';
    }
    return '';
  }

  function next() {
    const issue = validateStep(activeStep);
    if (issue) { setError(issue); return; }
    if (activeStep === 0 && form.accountType === 'solo_practitioner') setActiveStep(2);
    else setActiveStep(step => Math.min(step + 1, 5));
  }

  function back() {
    setError('');
    if (activeStep === 2 && form.accountType === 'solo_practitioner') setActiveStep(0);
    else setActiveStep(step => Math.max(step - 1, 0));
  }

  async function complete() {
    const payload: CompleteOnboardingInput = {
      token: verificationToken,
      password: form.password,
      accountType: form.accountType,
      workspaceName: form.workspaceName.trim()
    };
    if (form.accountType === 'organization') payload.organizationType = form.organizationType;
    if (form.organizationType === 'other') payload.customOrganizationTypeLabel = form.customOrganizationTypeLabel.trim();
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.estimatedParticipants) payload.estimatedParticipants = Number(form.estimatedParticipants);
    if (requiresSchoolDetails) {
      payload.schoolType = form.schoolType;
      payload.estimatedStudents = Number(form.estimatedStudents);
      payload.address = {
        street: form.street.trim(), city: form.city.trim(), state: form.state.trim(),
        zipCode: form.zipCode.trim(), country: form.country.trim()
      };
    }
    if (form.setupChoice === 'standard') payload.standardPackageId = form.standardPackageId;

    setBusy(true);
    setError('');
    const response = await apiService.completeOnboarding(payload);
    if (!response.success || !response.data) {
      setBusy(false);
      setError(safeCompleteError);
      return;
    }

    try {
      await authenticateWithToken(response.data.token);
      setAuthenticated(true);
    } catch {
      setAuthenticated(false);
    }
    setBusy(false);
    setCompleted(true);
  }

  if (verification === 'checking') {
    return <PageShell><Stack alignItems="center" spacing={2}><CircularProgress /><Typography>Verifying your secure setup link...</Typography></Stack></PageShell>;
  }

  if (verification === 'invalid') {
    return (
      <PageShell>
        <Typography variant="h4" align="center" fontWeight={700}>Setup link unavailable</Typography>
        <Alert severity="error" sx={{ mt: 3 }}>This setup link is invalid, expired or has already been used.</Alert>
        <ResendPanel />
        <Button fullWidth sx={{ mt: 2 }} onClick={() => navigate('/onboarding')}>Start a new workspace request</Button>
      </PageShell>
    );
  }

  if (metadataLoading || (verification === 'valid' && !metadata && !metadataError)) {
    return <PageShell><Stack alignItems="center" spacing={2}><CircularProgress /><Typography>Loading workspace options...</Typography></Stack></PageShell>;
  }

  if (metadataError || !metadata) {
    return (
      <PageShell>
        <Typography variant="h4" align="center" fontWeight={700}>Workspace options unavailable</Typography>
        <Alert severity="error" sx={{ mt: 3 }}>{metadataError || 'Workspace options are temporarily unavailable. Please try again.'}</Alert>
        <Button fullWidth sx={{ mt: 2 }} onClick={() => setMetadataAttempt(value => value + 1)}>Retry</Button>
      </PageShell>
    );
  }

  if (completed) {
    return (
      <PageShell>
        <Stack spacing={3} alignItems="center">
          <Typography variant="h4" fontWeight={700}>Your workspace is ready</Typography>
          <Alert severity="success" sx={{ width: '100%' }}>
            {authenticated ? 'Your account is verified and signed in.' : 'Your workspace was created. Sign in with the password you just created.'}
          </Alert>
          <Button variant="contained" size="large" onClick={() => navigate(authenticated ? '/admin' : '/login')}>
            {authenticated ? 'Open your workspace' : 'Go to sign in'}
          </Button>
        </Stack>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Typography variant="h4" align="center" fontWeight={700}>Set up your Kidsible workspace</Typography>
      <Typography align="center" color="text.secondary" sx={{ mt: 1, mb: 3 }}>Your email is verified. Choose how Kidsible should start for you.</Typography>
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, display: { xs: 'none', sm: 'flex' } }}>
        {steps.map((label, index) => <Step key={label} completed={index < activeStep || (index === 1 && form.accountType === 'solo_practitioner' && activeStep > 1)}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>
      <Typography variant="overline" color="text.secondary">Step {activeStep + 1} of {steps.length}</Typography>
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}

      <Box sx={{ minHeight: 320, py: 2 }}>
        {activeStep === 0 && (
          <FormControl fullWidth>
            <FormLabel>How will you use Kidsible?</FormLabel>
            <RadioGroup value={form.accountType} onChange={event => update('accountType', event.target.value as OnboardingAccountType)}>
              {metadata.accountTypes.map(item => (
                <FormControlLabel key={item.value} value={item.value} control={<Radio />} label={<Box><Typography fontWeight={700}>{item.label}</Typography><Typography variant="body2" color="text.secondary">{item.description}</Typography></Box>} />
              ))}
            </RadioGroup>
          </FormControl>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <TextField select fullWidth label="Organization type" value={form.organizationType} onChange={event => update('organizationType', event.target.value)} required SelectProps={{ native: true }}>
              <option value="" />
              {organizationTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </TextField>
            {form.organizationType === 'other' && <TextField label="Describe your organization type" value={form.customOrganizationTypeLabel} onChange={event => update('customOrganizationTypeLabel', event.target.value)} required fullWidth />}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            <FormControl>
              <FormLabel>Choose your starting point</FormLabel>
              <RadioGroup value={form.setupChoice} onChange={event => update('setupChoice', event.target.value as SetupChoice)}>
                <FormControlLabel value="standard" control={<Radio />} label="Start with a Standard Package" />
                <FormControlLabel value="blank" control={<Radio />} label="Start blank" />
              </RadioGroup>
            </FormControl>
            {form.setupChoice === 'blank' && <Alert severity="info">Your workspace will be ready for you to configure Programs, Levels and workflows.</Alert>}
            {form.setupChoice === 'standard' && packagesLoading && <CircularProgress aria-label="Loading Standard Packages" />}
            {packagesError && <Alert severity="warning">{packagesError}</Alert>}
            {form.setupChoice === 'standard' && !packagesLoading && !packagesError && packages.length === 0 && <Alert severity="info">No compatible Standard Packages are currently available. Choose Start blank to continue.</Alert>}
            {form.setupChoice === 'standard' && packages.map(item => (
              <Card key={item._id} variant={form.standardPackageId === item._id ? 'elevation' : 'outlined'}>
                <CardContent>
                  <FormControlLabel value={item._id} control={<Radio checked={form.standardPackageId === item._id} onChange={() => update('standardPackageId', item._id)} />} label={<Box><Stack direction="row" spacing={1} alignItems="center"><Typography fontWeight={700}>{item.name}</Typography><Chip size="small" label={`Version ${item.version}`} /></Stack><Typography variant="body2" color="text.secondary">{item.description || 'Ready-made Kidsible configuration'}</Typography></Box>} />
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={2}>
            <TextField label={form.accountType === 'solo_practitioner' ? 'Practice name' : 'Workspace name'} value={form.workspaceName} onChange={event => update('workspaceName', event.target.value)} fullWidth required />
            <TextField label="Phone (optional)" value={form.phone} onChange={event => update('phone', event.target.value)} fullWidth />
            {!requiresSchoolDetails && <TextField label="Estimated participants (optional)" type="number" value={form.estimatedParticipants} onChange={event => update('estimatedParticipants', event.target.value)} fullWidth inputProps={{ min: 0 }} />}
            {requiresSchoolDetails && <>
              <TextField select label="School type" value={form.schoolType} onChange={event => update('schoolType', event.target.value)} fullWidth required SelectProps={{ native: true }}><option value="" />{metadata.schoolTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</TextField>
              <TextField label="Estimated students" type="number" value={form.estimatedStudents} onChange={event => update('estimatedStudents', event.target.value)} fullWidth required inputProps={{ min: 1 }} />
              <Divider><Typography variant="body2">Address</Typography></Divider>
              <TextField label="Street" value={form.street} onChange={event => update('street', event.target.value)} fullWidth required />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="City" value={form.city} onChange={event => update('city', event.target.value)} fullWidth required /><TextField label="State/Province" value={form.state} onChange={event => update('state', event.target.value)} fullWidth required /></Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}><TextField label="Postal code" value={form.zipCode} onChange={event => update('zipCode', event.target.value)} fullWidth required /><TextField label="Country" value={form.country} onChange={event => update('country', event.target.value)} fullWidth required /></Stack>
            </>}
          </Stack>
        )}

        {activeStep === 4 && (
          <Stack spacing={2}>
            <Alert severity="info">Create a password between 8 and 128 characters. Kidsible will never email or display it.</Alert>
            <TextField label="Password" type="password" value={form.password} onChange={event => update('password', event.target.value)} fullWidth required inputProps={{ minLength: 8, maxLength: 128 }} />
            <TextField label="Confirm password" type="password" value={form.confirmPassword} onChange={event => update('confirmPassword', event.target.value)} fullWidth required />
          </Stack>
        )}

        {activeStep === 5 && (
          <Stack spacing={2}>
            <Typography variant="h6">Review your setup</Typography>
            <ReviewRow label="Workspace type" value={metadata.accountTypes.find(item => item.value === form.accountType)?.label || form.accountType} />
            <ReviewRow label="Organization type" value={form.accountType === 'solo_practitioner' ? soloOrganizationType?.label || effectiveOrganizationType : form.organizationType === 'other' ? form.customOrganizationTypeLabel : selectedOrganizationType?.label || form.organizationType} />
            <ReviewRow label="Workspace name" value={form.workspaceName} />
            <ReviewRow label="Setup" value={form.setupChoice === 'blank' ? 'Start blank' : selectedPackage ? `${selectedPackage.name} — version ${selectedPackage.version}` : 'Standard Package'} />
            <ReviewRow label="Owner" value="Verified workspace owner" />
            <Alert severity="info">You will become the Organization Administrator for this workspace. Roles and tenant ownership are assigned securely by Kidsible.</Alert>
          </Stack>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Button onClick={activeStep === 0 ? () => navigate('/login') : back}>{activeStep === 0 ? 'Cancel' : 'Back'}</Button>
        {activeStep < 5 ? <Button variant="contained" onClick={next}>Continue</Button> : <Button variant="contained" onClick={complete} disabled={busy}>{busy ? 'Creating workspace...' : 'Create workspace'}</Button>}
      </Stack>
    </PageShell>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography color="text.secondary">{label}</Typography><Typography fontWeight={700}>{value}</Typography></Stack>;
}
