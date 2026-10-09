const base = process.env.REACT_APP_API_URL || '/api';

export type RecoveryErrorCode = 'DELIVERY_UNAVAILABLE' | 'INVALID_OR_EXPIRED' | 'RATE_LIMITED' | 'REQUEST_FAILED';

export class PasswordRecoveryError extends Error {
  constructor(public code: RecoveryErrorCode) { super(code); }
}

async function request(path: string, body: object) {
  let response: Response;
  try {
    response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (_) { throw new PasswordRecoveryError('REQUEST_FAILED'); }
  if (response.ok) return;
  if (response.status === 503) throw new PasswordRecoveryError('DELIVERY_UNAVAILABLE');
  if (response.status === 429) throw new PasswordRecoveryError('RATE_LIMITED');
  if (path === '/auth/reset-password' && response.status === 400) throw new PasswordRecoveryError('INVALID_OR_EXPIRED');
  throw new PasswordRecoveryError('REQUEST_FAILED');
}

export const passwordRecoveryService = {
  forgotPassword: (email: string) => request('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => request('/auth/reset-password', { token, password })
};
