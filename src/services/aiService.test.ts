import { aiService } from './aiService';

describe('aiService transcription authorization context', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it('sends the selected participant ID before the multipart audio body', async () => {
    (localStorage.getItem as jest.Mock).mockImplementation((key: string) =>
      key === 'token' ? 'authorized-test-token' : null
    );
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { transcription: 'Observation' } })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await aiService.transcribeAudio({
      audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
      studentId: 'participant/id with spaces',
      studentName: 'Ignored Client Name'
    });

    expect(result).toEqual({ success: true, data: 'Observation' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/process-voice?studentId=participant%2Fid%20with%20spaces');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ Authorization: 'Bearer authorized-test-token' });
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).has('studentName')).toBe(false);
  });

  it('rejects missing participant context without uploading audio', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(aiService.transcribeAudio({
      audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
      studentId: '   '
    })).resolves.toEqual({ success: false, error: 'Participant context is required' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a safe backend error without exposing response content in logs', async () => {
    (localStorage.getItem as jest.Mock).mockReturnValue('authorized-test-token');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Participant context not found', privateDetail: 'hidden transcription' })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(aiService.transcribeAudio({
      audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
      studentId: 'participant-a'
    })).resolves.toEqual({ success: false, error: 'Participant context not found' });
    expect(console.error).not.toHaveBeenCalled();
  });
});
