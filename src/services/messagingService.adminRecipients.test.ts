import messagingService from './messagingService';

describe('administrator communication recipients', () => {
  beforeEach(() => {
    (localStorage.getItem as jest.Mock).mockReturnValue('test-token');
    global.fetch = jest.fn();
  });

  afterEach(() => jest.restoreAllMocks());

  it('loads only the recipients returned by the authorized backend endpoint', async () => {
    const recipients = [{ _id: 'guardian-a', firstName: 'Gina', lastName: 'Guardian', email: 'g@example.invalid' }];
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, data: recipients }) });

    await expect(messagingService.getAdminRecipients()).resolves.toEqual(recipients);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/messages/admin-recipients'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
    );
  });

  it('reports backend recipient lookup failures', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ message: 'Recipients unavailable' }) });
    await expect(messagingService.getAdminRecipients()).rejects.toThrow('Recipients unavailable');
  });
});
