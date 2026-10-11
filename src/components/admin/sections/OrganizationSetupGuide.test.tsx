import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import OrganizationSetupGuide, { configurationSectionForSetupDestination } from './OrganizationSetupGuide';
import { useAuth } from '../../../contexts/AuthContext';
import { organizationSetupReadinessService } from '../../../services/organizationSetupReadinessService';

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/organizationSetupReadinessService', () => ({ organizationSetupReadinessService: jest.fn() }));

let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'school_admin', schoolId: 'school' }, token: 'token' });
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllMocks(); });
const mountGuide = async (onOpenConfiguration = jest.fn()) => {
  // This test uses React DOM directly; act is required to flush the component's loading effect.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => root.render(<OrganizationSetupGuide onOpenConfiguration={onOpenConfiguration} />));
  return { onOpenConfiguration };
};

test('shows setup readiness and opens the existing configuration workflow', async () => {
  (organizationSetupReadinessService as jest.Mock).mockReturnValue({ load: async () => ({ ready: false, steps: [{ key: 'programs', title: 'Choose what you offer', description: 'Add a Program.', status: 'needs_attention' }] }) });
  const { onOpenConfiguration } = await mountGuide();
  expect(document.body).toHaveTextContent('Complete the steps below');
  expect(document.body).toHaveTextContent('Needs attention');
  const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent === 'Open Programs')!;
  Simulate.click(button);
  expect(onOpenConfiguration).toHaveBeenCalledWith('programs');
});

test('opens the correct existing configuration destination for every incomplete step', async () => {
  const steps = [
    { key: 'programs', title: 'Programs', description: 'Add a Program.', status: 'needs_attention' },
    { key: 'levels', title: 'Levels', description: 'Add a Level.', status: 'needs_attention' },
    { key: 'assessment', title: 'Assessment', description: 'Add Requirements and Parameters.', status: 'needs_attention' },
    { key: 'plans', title: 'Plans', description: 'Add Roadmaps and Planned Sessions.', status: 'needs_attention' },
    { key: 'activation', title: 'Activation', description: 'Activate the plan.', status: 'needs_attention' }
  ];
  (organizationSetupReadinessService as jest.Mock).mockReturnValue({ load: async () => ({ ready: false, steps }) });
  const { onOpenConfiguration } = await mountGuide();
  const expectations = [
    ['Open Programs', 'programs'],
    ['Open Programs and Levels', 'levels'],
    ['Open Requirements and Parameters', 'assessment'],
    ['Open Roadmaps and Planned Sessions', 'plans'],
    ['Open Roadmap and Session Activation', 'activation']
  ];
  for (const [label, destination] of expectations) {
    const button = Array.from(document.querySelectorAll('button')).find(item => item.textContent === label)!;
    Simulate.click(button);
    expect(onOpenConfiguration).toHaveBeenCalledWith(destination);
  }
});

test('does not show correction actions for completed steps', async () => {
  (organizationSetupReadinessService as jest.Mock).mockReturnValue({ load: async () => ({
    ready: true,
    steps: [{ key: 'programs', title: 'Programs', description: 'Configured.', status: 'complete' }]
  }) });
  const { onOpenConfiguration } = await mountGuide();
  expect(document.body).toHaveTextContent('Complete');
  expect(document.querySelector('button')).toBeNull();
  expect(onOpenConfiguration).not.toHaveBeenCalled();
});

test.each(['programs', 'levels', 'assessment', 'plans', 'activation'] as const)(
  'maps the %s action to the existing Programs configuration workflow',
  destination => expect(configurationSectionForSetupDestination(destination)).toBe('programs')
);

test('handles loading failures without exposing backend details', async () => {
  (organizationSetupReadinessService as jest.Mock).mockReturnValue({ load: async () => { throw new Error('Unable to check setup readiness. Check your access and connection, then retry.'); } });
  await mountGuide();
  expect(document.body).toHaveTextContent('Unable to check setup readiness');
  expect(document.body).toHaveTextContent('Retry');
});

test('fails closed without Organization Administrator context', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'teacher', schoolId: 'school' }, token: 'token' });
  await mountGuide();
  expect(document.body).toHaveTextContent('Organization Administrator access is required.');
  expect(organizationSetupReadinessService).toHaveBeenCalledWith('token', 'school');
});
