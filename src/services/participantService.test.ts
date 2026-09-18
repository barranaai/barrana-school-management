import apiService from './apiService';

describe('participant enrollment context API', () => {
  beforeEach(() => {
    apiService.clearToken();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [{ _id: 'enrollment-1', status: 'active' }] }),
    });
  });

  it('requests the participant enrollment history in an explicit organization context', async () => {
    const response = await apiService.getParticipantEnrollments('participant-1', 'school-1');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/students/participant-1/enrollments?schoolId=school-1',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) })
    );
    expect(response.success).toBe(true);
    expect(response.data).toEqual([{ _id: 'enrollment-1', status: 'active' }]);
  });
});
