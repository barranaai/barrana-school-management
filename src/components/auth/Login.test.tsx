import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import Login from './Login';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: jest.fn() }));

let host: HTMLDivElement;
let root: Root;
const login = jest.fn();
const navigate = jest.fn();
const step = async (fn: () => void) => { await act(async () => { fn(); }); };

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  (useAuth as jest.Mock).mockReturnValue({ login });
  (useNavigate as jest.Mock).mockReturnValue(navigate);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function input(type: string) {
  return document.querySelector(`input[type="${type}"]`) as HTMLInputElement;
}
async function submit(email = 'user@example.invalid') {
  await step(() => Simulate.change(input('email'), { target: { value: email } } as any));
  await step(() => Simulate.change(input('password'), { target: { value: 'submitted-secret' } } as any));
  await step(() => Simulate.submit(document.querySelector('form')!));
}

test('login accepts only email and password and exposes no role selector', async () => {
  login.mockImplementation(async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify({ role: 'school_admin' }));
  });
  await step(() => root.render(<Login />));
  expect(document.body).not.toHaveTextContent('Role');
  await submit('admin@example.invalid');
  expect(login).toHaveBeenCalledWith({ email: 'admin@example.invalid', password: 'submitted-secret' });
  expect(navigate).toHaveBeenCalledWith('/admin');
});

test.each([
  ['super_admin', '/super-admin'],
  ['school_admin', '/admin'],
  ['teacher', '/teachers'],
  ['parent', '/parents']
])('navigates an authenticated %s using the backend-provided account role', async (role, destination) => {
  login.mockImplementation(async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify({ role }));
  });
  await step(() => root.render(<Login />));
  await submit();
  expect(navigate).toHaveBeenCalledWith(destination);
});

test('shows one safe message when authentication fails', async () => {
  login.mockRejectedValue(new Error('PRIVATE_BACKEND_DETAIL'));
  await step(() => root.render(<Login />));
  await submit();
  expect(document.body).toHaveTextContent('Login failed. Please check your credentials and try again.');
  expect(document.body).not.toHaveTextContent('PRIVATE_BACKEND_DETAIL');
  expect(navigate).not.toHaveBeenCalled();
});
