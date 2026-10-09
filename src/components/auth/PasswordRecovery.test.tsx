import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { useNavigate } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import { PasswordRecoveryError, passwordRecoveryService } from '../../services/passwordRecoveryService';

jest.mock('react-router-dom', () => ({ useNavigate: jest.fn() }));
jest.mock('../../services/passwordRecoveryService', () => ({ ...jest.requireActual('../../services/passwordRecoveryService'), passwordRecoveryService: { forgotPassword: jest.fn(), resetPassword: jest.fn() } }));
let host: HTMLDivElement, root: Root;
const navigate = jest.fn();
const step = async (fn: () => void | Promise<void>) => { await act(async () => { await fn(); }); };
beforeEach(() => { window.history.replaceState({}, '', '/'); (useNavigate as jest.Mock).mockReturnValue(navigate); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === text) as HTMLButtonElement;

test('forgot password shows a generic success and loading state', async () => {
  let finish!: () => void; (passwordRecoveryService.forgotPassword as jest.Mock).mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  await step(() => root.render(<ForgotPassword />));
  await step(() => Simulate.change(document.querySelector('input[type="email"]')!, { target: { value: 'teacher@example.invalid' } }));
  await step(() => Simulate.submit(document.querySelector('form')!));
  expect(document.body).toHaveTextContent('Requesting…'); expect(button('Requesting…')).toBeDisabled();
  await step(() => finish());
  expect(document.body).toHaveTextContent('If an account with that email exists');
});

test('forgot password reports unavailable delivery without account details', async () => {
  (passwordRecoveryService.forgotPassword as jest.Mock).mockRejectedValue(new PasswordRecoveryError('DELIVERY_UNAVAILABLE'));
  await step(() => root.render(<ForgotPassword />));
  await step(() => Simulate.change(document.querySelector('input[type="email"]')!, { target: { value: 'teacher@example.invalid' } }));
  await step(() => Simulate.submit(document.querySelector('form')!));
  expect(document.body).toHaveTextContent('currently unavailable'); expect(document.body).not.toHaveTextContent('teacher@example.invalid');
});

test('reset removes the token from the URL, validates confirmation and never uses browser storage', async () => {
  window.history.replaceState({}, '', '/reset-password?token=one-time-token');
  (passwordRecoveryService.resetPassword as jest.Mock).mockResolvedValue(undefined);
  await step(() => root.render(<ResetPassword />));
  expect(window.location.search).toBe('');
  const fields = document.querySelectorAll('input[type="password"]');
  await step(() => Simulate.change(fields[0], { target: { value: 'new-password' } }));
  await step(() => Simulate.change(fields[1], { target: { value: 'different-password' } }));
  await step(() => Simulate.submit(document.querySelector('form')!));
  expect(document.body).toHaveTextContent('Passwords do not match'); expect(passwordRecoveryService.resetPassword).not.toHaveBeenCalled();
  await step(() => Simulate.change(fields[1], { target: { value: 'new-password' } }));
  await step(() => Simulate.submit(document.querySelector('form')!));
  expect(passwordRecoveryService.resetPassword).toHaveBeenCalledWith('one-time-token', 'new-password');
  expect(document.body).toHaveTextContent('reset successfully');
  expect(localStorage.setItem).not.toHaveBeenCalled(); expect(sessionStorage.setItem).not.toHaveBeenCalled();
});

test('reset handles missing and expired links safely', async () => {
  await step(() => root.render(<ResetPassword />));
  const fields = document.querySelectorAll('input[type="password"]');
  await step(() => Simulate.change(fields[0], { target: { value: 'new-password' } })); await step(() => Simulate.change(fields[1], { target: { value: 'new-password' } }));
  await step(() => Simulate.submit(document.querySelector('form')!)); expect(document.body).toHaveTextContent('invalid or has expired');
  act(() => root.unmount()); host.remove(); window.history.replaceState({}, '', '/reset-password?token=expired-token'); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  (passwordRecoveryService.resetPassword as jest.Mock).mockRejectedValue(new PasswordRecoveryError('INVALID_OR_EXPIRED'));
  await step(() => root.render(<ResetPassword />)); const retry = document.querySelectorAll('input[type="password"]');
  await step(() => Simulate.change(retry[0], { target: { value: 'new-password' } })); await step(() => Simulate.change(retry[1], { target: { value: 'new-password' } })); await step(() => Simulate.submit(document.querySelector('form')!));
  expect(document.body).toHaveTextContent('invalid or has expired');
});
