import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { OnboardingStart, OnboardingVerify } from './Onboarding';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: jest.fn() }));

let host: HTMLDivElement;
let root: Root;
const navigate = jest.fn();
const authenticateWithToken = jest.fn();
const token = 'v'.repeat(64);
const packageRecord = {
  _id: '507f1f77bcf86cd799439011',
  slug: 'generic-training',
  name: 'Generic Training Foundation',
  description: 'A configurable training starting point',
  version: 2,
  organizationTypes: ['sports_club']
};
const onboardingMetadata = {
  accountTypes: [
    { value: 'organization' as const, label: 'Organization', description: 'For an organization.' },
    { value: 'solo_practitioner' as const, label: 'Solo Practitioner', description: 'For an independent practitioner.' }
  ],
  organizationTypes: [
    { value: 'school', label: 'School', accountTypes: ['organization' as const], requiresSchoolDetails: true },
    { value: 'early_childhood_center', label: 'Early childhood center', accountTypes: ['organization' as const], requiresSchoolDetails: true },
    { value: 'sports_club', label: 'Sports club', accountTypes: ['organization' as const], requiresSchoolDetails: false },
    { value: 'independent_practice', label: 'Independent practice', accountTypes: ['solo_practitioner' as const], requiresSchoolDetails: false },
    { value: 'other', label: 'Other', accountTypes: ['organization' as const], requiresSchoolDetails: false }
  ],
  schoolTypes: [
    { value: 'licensed_daycare', label: 'Licensed daycare' },
    { value: 'montessori_school', label: 'Montessori school' },
    { value: 'public_private_school', label: 'Public or private school' }
  ]
};

const step = async (action?: () => void) => {
  await act(async () => { if (action) action(); });
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  (useNavigate as jest.Mock).mockReturnValue(navigate);
  (useAuth as jest.Mock).mockReturnValue({ authenticateWithToken });
  jest.spyOn(apiService, 'startOnboarding').mockResolvedValue({ success: true });
  jest.spyOn(apiService, 'resendOnboarding').mockResolvedValue({ success: true });
  jest.spyOn(apiService, 'verifyOnboarding').mockResolvedValue({ success: true, data: { valid: true, expiresAt: '2030-01-01T00:00:00.000Z' } });
  jest.spyOn(apiService, 'getOnboardingMetadata').mockResolvedValue({ success: true, data: onboardingMetadata });
  jest.spyOn(apiService, 'listOnboardingPackages').mockResolvedValue({ success: true, data: [packageRecord] });
  jest.spyOn(apiService, 'completeOnboarding').mockResolvedValue({
    success: true,
    data: { user: {} as any, token: 'server-auth-token', standardPackageAdopted: true }
  });
  authenticateWithToken.mockResolvedValue({ role: 'school_admin' });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

function button(text: string) {
  const match = Array.from(document.querySelectorAll('button')).find(item => item.textContent?.trim() === text);
  if (!match) throw new Error(`Button not found: ${text}`);
  return match as HTMLButtonElement;
}

function field(label: string) {
  const element = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.replace(' *', '').trim() === label);
  const id = element?.getAttribute('for');
  const input = id ? document.getElementById(id) : undefined;
  if (!input) throw new Error(`Field not found: ${label}`);
  return input as HTMLInputElement;
}

function radio(value: string) {
  const input = document.querySelector(`input[type="radio"][value="${value}"]`);
  if (!input) throw new Error(`Radio not found: ${value}`);
  return input as HTMLInputElement;
}

async function change(label: string, value: string) {
  await step(() => Simulate.change(field(label), { target: { value } } as any));
}

async function click(text: string) {
  await step(() => Simulate.click(button(text)));
}

async function renderVerified() {
  window.history.replaceState(null, '', `/onboarding/verify#token=${token}`);
  await step(() => root.render(<OnboardingVerify />));
  await step();
  await step();
}

async function reachWorkspace(account: 'organization' | 'solo' = 'organization', setup: 'blank' | 'standard' = 'blank') {
  await renderVerified();
  if (account === 'solo') await step(() => Simulate.change(radio('solo_practitioner'), { target: { value: 'solo_practitioner', checked: true } } as any));
  await click('Continue');
  if (account === 'organization') {
    await change('Organization type', 'sports_club');
    await click('Continue');
  }
  if (setup === 'standard') {
    await step(() => Simulate.change(radio('standard'), { target: { value: 'standard', checked: true } } as any));
    await step();
    await step(() => Simulate.change(radio(packageRecord._id), { target: { value: packageRecord._id, checked: true } } as any));
  }
  await click('Continue');
}

async function finishFromWorkspace(name: string) {
  await change(document.body.textContent?.includes('Practice name') ? 'Practice name' : 'Workspace name', name);
  await click('Continue');
  await change('Password', 'safe-password-123');
  await change('Confirm password', 'safe-password-123');
  await click('Continue');
}

test('start request collects only owner identity and shows a non-enumerating success state', async () => {
  await step(() => root.render(<OnboardingStart />));
  await change('First name', 'Avery');
  await change('Last name', 'Owner');
  await change('Work email', 'owner@example.invalid');
  await step(() => Simulate.submit(document.querySelector('form')!));

  expect(apiService.startOnboarding).toHaveBeenCalledWith({ firstName: 'Avery', lastName: 'Owner', email: 'owner@example.invalid' });
  expect(apiService.startOnboarding).not.toHaveBeenCalledWith(expect.objectContaining({ role: expect.anything(), schoolId: expect.anything() }));
  expect(document.body).toHaveTextContent('If this email can be used');
});

test('start validation prevents an invalid email and displays a safe API failure', async () => {
  await step(() => root.render(<OnboardingStart />));
  await change('First name', 'A');
  await change('Last name', 'B');
  await change('Work email', 'invalid');
  await step(() => Simulate.submit(document.querySelector('form')!));
  expect(apiService.startOnboarding).not.toHaveBeenCalled();
  expect(document.body).toHaveTextContent('Enter your name and a valid email address.');

  (apiService.startOnboarding as jest.Mock).mockResolvedValueOnce({ success: false, error: 'PRIVATE_DATABASE_DETAIL' });
  await change('First name', 'Avery');
  await change('Last name', 'Owner');
  await change('Work email', 'owner@example.invalid');
  await step(() => Simulate.submit(document.querySelector('form')!));
  expect(document.body).toHaveTextContent('We could not send the setup email');
  expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_DETAIL');
});

test('invalid, expired or used verification links expose no token and offer safe recovery', async () => {
  (apiService.verifyOnboarding as jest.Mock).mockResolvedValueOnce({ success: false, error: 'PRIVATE_TOKEN_DETAIL' });
  window.history.replaceState(null, '', `/onboarding/verify#token=${token}`);
  await step(() => root.render(<OnboardingVerify />));
  await step();
  expect(window.location.hash).toBe('');
  expect(document.body).toHaveTextContent('invalid, expired or has already been used');
  expect(document.body).not.toHaveTextContent(token);
  expect(document.body).not.toHaveTextContent('PRIVATE_TOKEN_DETAIL');
});

test('invalid-link recovery can safely request a resend without exposing verification details', async () => {
  (apiService.verifyOnboarding as jest.Mock).mockResolvedValueOnce({ success: false });
  window.history.replaceState(null, '', `/onboarding/verify#token=${token}`);
  await step(() => root.render(<OnboardingVerify />));
  await step();
  await change('Email', 'owner@example.invalid');
  await click('Resend setup link');
  expect(apiService.resendOnboarding).toHaveBeenCalledWith('owner@example.invalid');
  expect(document.body).toHaveTextContent('If this email can continue onboarding');
});
test('organization can select a backend package and completes with no client-controlled role or tenant', async () => {
  await reachWorkspace('organization', 'standard');
  expect(apiService.listOnboardingPackages).toHaveBeenCalledWith('sports_club');
  await finishFromWorkspace('Example Sports Organization');
  expect(document.body).toHaveTextContent('Review your setup');
  expect(document.body).toHaveTextContent('Generic Training Foundation — version 2');
  await click('Create workspace');

  const payload = (apiService.completeOnboarding as jest.Mock).mock.calls[0][0];
  expect(payload).toEqual(expect.objectContaining({
    token,
    accountType: 'organization',
    organizationType: 'sports_club',
    workspaceName: 'Example Sports Organization',
    standardPackageId: packageRecord._id,
    password: 'safe-password-123'
  }));
  expect(payload).not.toHaveProperty('role');
  expect(payload).not.toHaveProperty('schoolId');
  expect(payload).not.toHaveProperty('ownerUserId');
  expect(authenticateWithToken).toHaveBeenCalledWith('server-auth-token');
  expect(document.body).toHaveTextContent('Your workspace is ready');
});

test('solo practitioner can start blank without organization or school-only fields', async () => {
  await reachWorkspace('solo', 'blank');
  expect(document.body).toHaveTextContent('Practice name');
  expect(document.body).not.toHaveTextContent('School type');
  expect(document.body).not.toHaveTextContent('Estimated students');
  await finishFromWorkspace('Independent Music Practice');
  await click('Create workspace');

  const payload = (apiService.completeOnboarding as jest.Mock).mock.calls[0][0];
  expect(payload).toEqual(expect.objectContaining({ accountType: 'solo_practitioner', workspaceName: 'Independent Music Practice' }));
  expect(payload).not.toHaveProperty('organizationType');
  expect(payload).not.toHaveProperty('schoolType');
  expect(payload).not.toHaveProperty('address');
  expect(payload).not.toHaveProperty('standardPackageId');
});

test('blank organization setup does not require or submit a package', async () => {
  await reachWorkspace('organization', 'blank');
  await finishFromWorkspace('Blank Training Organization');
  await click('Create workspace');
  expect((apiService.completeOnboarding as jest.Mock).mock.calls[0][0]).not.toHaveProperty('standardPackageId');
  expect(apiService.listOnboardingPackages).not.toHaveBeenCalled();
});

test('password mismatch blocks completion', async () => {
  await reachWorkspace('solo', 'blank');
  await change('Practice name', 'Independent Practice');
  await click('Continue');
  await change('Password', 'safe-password-123');
  await change('Confirm password', 'different-password');
  await click('Continue');
  expect(document.body).toHaveTextContent('Passwords do not match.');
  expect(apiService.completeOnboarding).not.toHaveBeenCalled();
});

test('package and completion failures stay customer-readable', async () => {
  (apiService.listOnboardingPackages as jest.Mock).mockResolvedValueOnce({ success: false, error: 'PRIVATE_PACKAGE_DETAIL' });
  await renderVerified();
  await click('Continue');
  await change('Organization type', 'sports_club');
  await click('Continue');
  await step(() => Simulate.change(radio('standard'), { target: { value: 'standard', checked: true } } as any));
  await step();
  expect(document.body).toHaveTextContent('Standard Packages are unavailable');
  expect(document.body).not.toHaveTextContent('PRIVATE_PACKAGE_DETAIL');
});

test('organization setup preserves standard-package and workspace values across Back and Continue', async () => {
  await reachWorkspace('organization', 'standard');
  await change('Workspace name', 'Persistent Sports Club');
  await change('Phone (optional)', '+1 555 0100');
  await change('Estimated participants (optional)', '42');
  await click('Continue');
  await change('Password', 'safe-password-123');
  await change('Confirm password', 'safe-password-123');

  await click('Back');
  expect(field('Workspace name')).toHaveValue('Persistent Sports Club');
  expect(field('Phone (optional)')).toHaveValue('+1 555 0100');
  expect(field('Estimated participants (optional)')).toHaveValue(42);

  await click('Back');
  expect(radio('standard')).toBeChecked();
  expect(radio(packageRecord._id)).toBeChecked();

  await click('Continue');
  expect(field('Workspace name')).toHaveValue('Persistent Sports Club');
  await click('Continue');
  expect(field('Password')).toHaveValue('safe-password-123');
  expect(field('Confirm password')).toHaveValue('safe-password-123');
});

test('solo setup preserves the selected path, blank choice and workspace values across Back and Continue', async () => {
  await reachWorkspace('solo', 'blank');
  await change('Practice name', 'Persistent Music Practice');
  await change('Phone (optional)', '+1 555 0200');
  await change('Estimated participants (optional)', '12');
  await click('Continue');
  await change('Password', 'safe-password-456');
  await change('Confirm password', 'safe-password-456');

  await click('Back');
  expect(field('Practice name')).toHaveValue('Persistent Music Practice');
  await click('Back');
  expect(radio('blank')).toBeChecked();
  await click('Back');
  expect(radio('solo_practitioner')).toBeChecked();

  await click('Continue');
  expect(radio('blank')).toBeChecked();
  await click('Continue');
  expect(field('Practice name')).toHaveValue('Persistent Music Practice');
  expect(field('Phone (optional)')).toHaveValue('+1 555 0200');
  expect(field('Estimated participants (optional)')).toHaveValue(12);
});

test.each(['school', 'early_childhood_center'])(
  '%s uses backend metadata to show every required school-style field',
  async organizationType => {
    await renderVerified();
    await click('Continue');
    await change('Organization type', organizationType);
    await click('Continue');
    await click('Continue');

    for (const label of ['School type', 'Estimated students', 'Street', 'City', 'State/Province', 'Postal code', 'Country']) {
      expect(field(label)).toBeInTheDocument();
    }
    expect(document.body).not.toHaveTextContent('Estimated participants (optional)');
  }
);

test('solo practitioner capability metadata keeps school-style fields hidden', async () => {
  await reachWorkspace('solo', 'blank');
  for (const label of ['School type', 'Estimated students', 'Street', 'City', 'State/Province', 'Postal code', 'Country']) {
    expect(() => field(label)).toThrow();
  }
  expect(field('Estimated participants (optional)')).toBeInTheDocument();
});

test('organization type options and labels are rendered from backend metadata', async () => {
  (apiService.getOnboardingMetadata as jest.Mock).mockResolvedValueOnce({
    success: true,
    data: {
      ...onboardingMetadata,
      organizationTypes: [
        { value: 'backend_defined_type', label: 'Backend-defined organization', accountTypes: ['organization'], requiresSchoolDetails: false },
        { value: 'independent_practice', label: 'Backend solo practice', accountTypes: ['solo_practitioner'], requiresSchoolDetails: false }
      ]
    }
  });
  await renderVerified();
  await click('Continue');

  expect(document.body).toHaveTextContent('Backend-defined organization');
  expect(document.body).not.toHaveTextContent('Sports club');
});

test('metadata loading failure is safe and retryable', async () => {
  (apiService.getOnboardingMetadata as jest.Mock)
    .mockResolvedValueOnce({ success: false, error: 'PRIVATE_METADATA_DETAIL' })
    .mockResolvedValueOnce({ success: true, data: onboardingMetadata });
  await renderVerified();

  expect(document.body).toHaveTextContent('Workspace options are temporarily unavailable');
  expect(document.body).not.toHaveTextContent('PRIVATE_METADATA_DETAIL');
  await click('Retry');
  await step();
  expect(document.body).toHaveTextContent('How will you use Kidsible?');
});