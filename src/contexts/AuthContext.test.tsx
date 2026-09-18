import React, { useState } from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { AuthProvider, useAuth } from './AuthContext';
import { apiService } from '../services/apiService';

let host: HTMLDivElement;
let root: Root;

function Probe() {
  const auth = useAuth();
  const [failure, setFailure] = useState(false);
  return (
    <div>
      <span>{auth.user?.email || 'anonymous'}</span>
      <button onClick={() => auth.authenticateWithToken('server-auth-token').catch(() => setFailure(true))}>Accept onboarding session</button>
      {failure && <span>session failed</span>}
    </div>
  );
}

const step = async (action?: () => void) => {
  await act(async () => { if (action) action(); });
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  (localStorage.getItem as jest.Mock).mockReturnValue(null);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

test('onboarding session is accepted only after auth/me returns the server-derived user and workspace', async () => {
  jest.spyOn(apiService, 'setToken');
  jest.spyOn(apiService, 'clearToken');
  jest.spyOn(apiService, 'getCurrentUser').mockResolvedValue({
    success: true,
    data: {
      id: 'owner-id',
      firstName: 'Avery',
      lastName: 'Owner',
      email: 'owner@example.invalid',
      role: 'school_admin',
      schoolId: {
        _id: 'workspace-id',
        name: 'Example Workspace',
        accountType: 'organization',
        organizationType: 'sports_club'
      },
      isEmailVerified: true
    }
  });

  await step(() => root.render(<AuthProvider><Probe /></AuthProvider>));
  await step();
  await step(() => Simulate.click(document.querySelector('button')!));

  expect(apiService.setToken).toHaveBeenCalledWith('server-auth-token');
  expect(apiService.getCurrentUser).toHaveBeenCalled();
  expect(localStorage.setItem).toHaveBeenCalledWith('token', 'server-auth-token');
  expect(localStorage.setItem).toHaveBeenCalledWith('user', expect.stringContaining('workspace-id'));
  expect(document.body).toHaveTextContent('owner@example.invalid');
});

test('failed auth/me validation clears the onboarding auth token and does not authenticate', async () => {
  jest.spyOn(apiService, 'setToken');
  jest.spyOn(apiService, 'clearToken');
  jest.spyOn(apiService, 'getCurrentUser').mockResolvedValue({ success: false, error: 'PRIVATE_AUTH_DETAIL' });

  await step(() => root.render(<AuthProvider><Probe /></AuthProvider>));
  await step();
  await step(() => Simulate.click(document.querySelector('button')!));

  expect(apiService.clearToken).toHaveBeenCalled();
  expect(localStorage.removeItem).toHaveBeenCalledWith('token');
  expect(localStorage.removeItem).toHaveBeenCalledWith('user');
  expect(document.body).toHaveTextContent('anonymous');
  expect(document.body).toHaveTextContent('session failed');
  expect(document.body).not.toHaveTextContent('PRIVATE_AUTH_DETAIL');
});
