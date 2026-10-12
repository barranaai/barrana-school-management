import { reportService } from './reportService';

beforeEach(() => {
  (localStorage.getItem as jest.Mock).mockReturnValue('test-token');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:report') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
});
afterEach(() => jest.restoreAllMocks());

test('downloads a report through the authenticated staff endpoint', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true, blob: async () => new Blob(['pdf'], { type: 'application/pdf' }),
    headers: { get: () => 'attachment; filename="Report_2026-10-11.pdf"' }
  });
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  await reportService.downloadReportPdf('report-a');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/reports/report-a/pdf'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  expect(click).toHaveBeenCalledTimes(1);
});

test('adds explicit organization scope for Super Admin downloads and reports safe failures', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Report not found' }) });
  await expect(reportService.downloadReportPdf('report-a', 'school-a')).rejects.toThrow('Report not found');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/reports/report-a/pdf?schoolId=school-a'), expect.anything());
});
