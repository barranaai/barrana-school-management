import { levelService } from './levelService';
beforeEach(() => { (fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) }); });
test.each([['', 'program'], ['school', '']])('missing school/program scope blocks requests', (school, program) => {
  expect(() => levelService('synthetic-token', school, program).list()).toThrow(); expect(fetch).not.toHaveBeenCalled();
});
test('creation includes selected school and Program in authenticated body and query', async () => {
  await levelService('synthetic-token', 'school', 'program').save(undefined, { name: ' Beginner ', description: '', sequence: 1 });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/levels?schoolId=school&programId=program'), expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }), body: JSON.stringify({ name: 'Beginner', description: '', sequence: 1, schoolId: 'school', programId: 'program' }) }));
});
