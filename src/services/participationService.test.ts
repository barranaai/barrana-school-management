import { DeliveredSession } from './deliveredSessionService';
import { participationFailure, participationService } from './participationService';

const session = { _id: 'session', schoolId: 'school', status: 'in_progress' } as DeliveredSession;
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
const participant = { _id: 'participation', schoolId: 'school', deliveredSessionId: 'session', childId: 'child', enrollmentId: 'enrollment', status: 'active' as const, firstName: 'Maya', lastName: 'Test' };
const candidate = { childId: 'child-2', enrollmentId: 'enrollment-2', firstName: 'Leo', lastName: 'Test' };

beforeEach(() => (fetch as jest.Mock).mockReset().mockResolvedValue(reply({ eligible: [candidate], participations: [participant] })));

test('loads the authoritative scoped session roster', async () => {
  const roster = await participationService('token', 'school', session).load();
  expect(roster.eligible).toEqual([candidate]);
  expect(fetch).toHaveBeenCalledWith('/api/child-participations/eligible?deliveredSessionId=session&schoolId=school', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer token' }) }));
});

test('adds only the server-provided child and enrollment identity', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply(participant));
  await participationService('token', 'school', session).add(candidate);
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ schoolId: 'school', deliveredSessionId: 'session', childId: 'child-2', enrollmentId: 'enrollment-2' });
});

test.each([['absent', 'PUT'], ['excused', 'PUT'], ['cancelled', 'DELETE']] as const)('active to %s uses the supported %s lifecycle operation', async (status, method) => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...participant, status }));
  await participationService('token', 'school', session).changeStatus(participant, status);
  expect((fetch as jest.Mock).mock.calls[0][1].method).toBe(method);
});

test('rejects duplicate roster identity, invalid transition and foreign session data locally', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ eligible: [{ ...candidate, childId: 'child' }], participations: [participant] }));
  await expect(participationService('token', 'school', session).load()).rejects.toThrow(participationFailure);
  expect(() => participationService('token', 'school', session).changeStatus({ ...participant, status: 'cancelled' }, 'active')).toThrow(participationFailure);
  expect(() => participationService('token', 'school', session).changeStatus({ ...participant, schoolId: 'other' }, 'absent')).toThrow(participationFailure);
});

test('authorization and backend errors are replaced with a safe message', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ message: 'PRIVATE_AUTH_DETAIL' }) });
  await expect(participationService('token', 'school', session).load()).rejects.toThrow(participationFailure);
});
