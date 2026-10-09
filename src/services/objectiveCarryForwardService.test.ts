import { objectiveCarryForwardService, carryForwardFailure } from './objectiveCarryForwardService';
const reply = (data: unknown) => Promise.resolve({ ok: true, json: async () => ({ success: true, data }) });
beforeEach(() => (fetch as jest.Mock).mockReset().mockImplementation(() => reply([])));
test('loads scoped suggestions and accepts only the selected objective and target', async () => {
  const api = objectiveCarryForwardService('token', 'school');
  await api.suggestions('progress');
  expect(fetch).toHaveBeenLastCalledWith('/api/objective-carry-forward/progress?schoolId=school', expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer token' }) }));
  const objective = { title: 'Edited objective', description: '', expectedOutcome: 'Try again', instructionalGuidance: 'Use support' };
  await api.accept('progress', 'objective', 'target', objective);
  expect(fetch).toHaveBeenLastCalledWith('/api/objective-carry-forward/progress/accept?schoolId=school', expect.objectContaining({ method: 'POST', body: JSON.stringify({ objectiveId: 'objective', targetPlannedSessionId: 'target', objective, schoolId: 'school' }) }));
});
test('uses a safe failure message', async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ message: 'PRIVATE' }) });
  await expect(objectiveCarryForwardService('token', 'school').suggestions('progress')).rejects.toThrow(carryForwardFailure);
});
