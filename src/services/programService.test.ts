import { programService } from './programService';
beforeEach(() => { (fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: {} }) }); });
test('Super Admin selected school is included in both query and creation body', async () => {
  await programService('synthetic-super-token', 'selected-school').save(undefined, { name: 'Swimming', description: '', displayOrder: 2 });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/programs?schoolId=selected-school'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Swimming', description: '', displayOrder: 2, schoolId: 'selected-school' }) }));
});
test('missing school never sends an unscoped request', () => {
  expect(() => programService('synthetic-token', '').list()).toThrow('Choose a school first.'); expect(fetch).not.toHaveBeenCalled();
});
test('network and raw API errors are replaced with safe messages', async () => {
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('PRIVATE_VALUE'));
  await expect(programService('synthetic-token', 'school').list()).rejects.toThrow('Unable to complete the request.');
});
