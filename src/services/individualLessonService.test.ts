import { getIndividualLessonEnrollments, individualLessonFailure } from './individualLessonService';

const rows = [{ _id: 'enrollment', child: { _id: 'child', firstName: 'Leo', lastName: 'Demo' }, program: { _id: 'program', name: 'Swimming' }, level: { _id: 'level', name: 'Foundation' }, status: 'active', startDate: '2026-01-01' }];

beforeEach(() => (fetch as jest.Mock).mockReset());

test('requests only the authenticated teacher individual options for the selected date', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, data: rows }) });
  await expect(getIndividualLessonEnrollments('token', '2026-10-11T10:00:00.000Z')).resolves.toEqual(rows);
  expect(fetch).toHaveBeenCalledWith('/api/teachers/me/individual-enrollments?scheduledAt=2026-10-11T10%3A00%3A00.000Z', { headers: { Authorization: 'Bearer token' } });
});

test.each([400, 401, 403, 500])('HTTP %s fails without exposing server details', async status => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status, json: async () => ({ message: 'private detail' }) });
  await expect(getIndividualLessonEnrollments('token', '2026-10-11T10:00:00.000Z')).rejects.toThrow(individualLessonFailure);
});
