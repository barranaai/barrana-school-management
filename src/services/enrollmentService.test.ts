import { enrollmentService } from './enrollmentService';

const reply = (data: unknown) => Promise.resolve({ ok: true, json: async () => ({ success: true, data }) });

beforeEach(() => (fetch as jest.Mock).mockReset().mockImplementation(() => reply([])));

test('uses explicit school and child scope for enrollment reads', async () => {
  const api = enrollmentService('token', 'school');
  await api.list('child');
  expect(fetch).toHaveBeenCalledWith('/api/enrollments?schoolId=school&childId=child', expect.objectContaining({ method: 'GET' }));
});

test('creates and changes enrollment through supported lifecycle payloads', async () => {
  const api = enrollmentService('token', 'school');
  await api.create({ childId: 'child', programId: 'program', currentLevelId: 'level', startDate: '2026-09-19', status: 'active' });
  expect(fetch).toHaveBeenLastCalledWith('/api/enrollments', expect.objectContaining({ method: 'POST', body: JSON.stringify({ childId: 'child', programId: 'program', currentLevelId: 'level', startDate: '2026-09-19', status: 'active', schoolId: 'school' }) }));
  await api.changeClass('enrollment', 'class-2', '2026-09-20', 'Schedule change');
  expect(fetch).toHaveBeenLastCalledWith('/api/enrollments/enrollment/class-assignment?schoolId=school', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ schoolId: 'school', classId: 'class-2', effectiveDate: '2026-09-20', reason: 'Schedule change' }) }));
  await api.changeStatus('enrollment', 'paused', 'Break');
  expect(fetch).toHaveBeenLastCalledWith('/api/enrollments/enrollment?schoolId=school', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ schoolId: 'school', status: 'paused', reason: 'Break' }) }));
  await api.end('enrollment', 'Finished elsewhere');
  expect(fetch).toHaveBeenLastCalledWith('/api/enrollments/enrollment?schoolId=school', expect.objectContaining({ method: 'DELETE', body: JSON.stringify({ schoolId: 'school', reason: 'Finished elsewhere' }) }));
});

test('filters participant options to the selected school and hides raw API failures', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(await reply([{ _id: 'a', schoolId: 'school' }, { _id: 'b', schoolId: 'other' }]));
  expect(await enrollmentService('token', 'school').children()).toEqual([{ _id: 'a', schoolId: 'school' }]);
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'PRIVATE_DATABASE_ERROR' }) });
  await expect(enrollmentService('token', 'school').programs()).rejects.toThrow('Unable to complete the request');
});


test('surfaces allowlisted class validation while hiding arbitrary backend details', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, message: 'Class is already the current assignment' }) });
  await expect(enrollmentService('token', 'school').changeClass('enrollment', 'class', '2026-09-20', '')).rejects.toThrow('Class is already the current assignment');
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ success: false, message: 'PRIVATE_DATABASE_ERROR' }) });
  await expect(enrollmentService('token', 'school').changeClass('enrollment', 'class-2', '2026-09-20', '')).rejects.toThrow('Unable to complete the request');
});
