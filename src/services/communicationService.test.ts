// Use Axios's installed CommonJS build with an in-memory adapter: no HTTP requests.
export {};
jest.mock('axios', () => jest.requireActual('../../node_modules/axios/dist/node/axios.cjs'));
jest.mock('./apiService', () => ({ apiService: { getToken: jest.fn() } }));

const originalApi = process.env.REACT_APP_API_URL;
function setup(url?: string) {
  jest.resetModules();
  if (url === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = url;
  const axios = require('axios');
  const adapter = jest.fn(async (config: any) => ({
    data: { data: { success: true, sentCount: 1, failedCount: 0 } },
    status: 200, statusText: 'OK', headers: {}, config
  }));
  axios.defaults.adapter = adapter;
  const { apiService } = require('./apiService');
  apiService.getToken.mockReturnValue('synthetic-test-token');
  const { communicationService } = require('./communicationService');
  return { service: communicationService, adapter, apiService };
}
afterEach(() => {
  if (originalApi === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = originalApi;
  jest.restoreAllMocks();
});

test.each(['http://localhost:5052/api', 'http://localhost:5051/api'])('routes report notifications through %s with authentication', async url => {
  const { service, adapter } = setup(url);
  const report = { reportId: 'r', studentName: 'Student', teacherName: 'Teacher', reportTitle: 'Report', createdAt: '2026-09-15' };
  await expect(service.sendReportApprovalNotification('school', report)).resolves.toEqual({ success: true, sentCount: 1, failedCount: 0 });
  const request = adapter.mock.calls[0][0];
  expect(request.url).toBe(`${url}/communication/report-approval-notification`);
  expect(request.url).not.toContain('5050');
  expect(request.url).not.toContain('/api/api/');
  expect(request.method).toBe('post');
  expect(request.headers.get('Authorization')).toBe('Bearer synthetic-test-token');
  expect(JSON.parse(request.data)).toEqual({ schoolId: 'school', reportData: report, timestamp: expect.any(String) });
});

test.each([undefined, 'http://localhost:5052/api/'])('preserves path semantics for %s', async url => {
  const { service, adapter } = setup(url);
  await service.getMessages({ userId: 'user', unreadOnly: true });
  const request = adapter.mock.calls[0][0];
  expect(request.url).toBe(`${url ? url.replace(/\/+$/, '') : '/api'}/communication/messages`);
  expect(request.params).toEqual({ userId: 'user', unreadOnly: true });
});

test('reads current authentication for each request and drops it after logout', async () => {
  const { service, adapter, apiService } = setup();
  await service.getEmailTemplates();
  apiService.getToken.mockReturnValue('synthetic-refreshed-token');
  await service.markMessageAsRead('message');
  apiService.getToken.mockReturnValue(null);
  await service.deleteMessage('message');
  expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe('Bearer synthetic-test-token');
  expect(adapter.mock.calls[1][0].headers.get('Authorization')).toBe('Bearer synthetic-refreshed-token');
  expect(adapter.mock.calls[2][0].headers.has('Authorization')).toBe(false);
  expect(adapter.mock.calls[1][0].method).toBe('patch');
  expect(adapter.mock.calls[2][0].method).toBe('delete');
});

test('preserves read fallback on transport failure', async () => {
  const { service, adapter } = setup();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  adapter.mockRejectedValue(new Error('Synthetic failure'));
  await expect(service.getMessages()).resolves.toEqual([]);
});

test('preserves notification failure behavior', async () => {
  const { service, adapter } = setup();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  adapter.mockRejectedValue(new Error('Synthetic failure'));
  await expect(service.sendReportApprovalNotification('school', {})).rejects.toThrow('Failed to send report approval notification');
  expect(console.error).toHaveBeenCalledWith('Error sending report approval notification:');
});
