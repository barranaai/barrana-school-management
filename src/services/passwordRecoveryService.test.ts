import { PasswordRecoveryError, passwordRecoveryService } from './passwordRecoveryService';

beforeEach(() => (fetch as jest.Mock).mockReset());

test('sends recovery values only in POST bodies', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
  await passwordRecoveryService.forgotPassword('teacher@example.invalid');
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/forgot-password', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'teacher@example.invalid' }) }));
  await passwordRecoveryService.resetPassword('one-time-token', 'new-password');
  expect(fetch).toHaveBeenLastCalledWith('/api/auth/reset-password', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'one-time-token', password: 'new-password' }) }));
  expect((fetch as jest.Mock).mock.calls[1][0]).not.toContain('one-time-token');
});

test.each([[503, 'DELIVERY_UNAVAILABLE'], [429, 'RATE_LIMITED'], [500, 'REQUEST_FAILED']])('maps forgot status %s safely', async (status, code) => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status });
  await expect(passwordRecoveryService.forgotPassword('teacher@example.invalid')).rejects.toMatchObject({ code });
});

test('maps an invalid reset token without exposing a backend response', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'PRIVATE' }) });
  await expect(passwordRecoveryService.resetPassword('bad-token', 'new-password')).rejects.toEqual(new PasswordRecoveryError('INVALID_OR_EXPIRED'));
});
