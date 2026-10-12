import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import TeacherReportHistoryDialog from './TeacherReportHistoryDialog';
import { reportService } from '../../../services/reportService';

jest.mock('../../../services/reportService', () => ({ reportService: { getReports: jest.fn(), downloadReportPdf: jest.fn() } }));
let host: HTMLDivElement, root: Root;
const settle = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const report = { _id: 'report-a', title: 'Autumn Progress', status: 'approved', content: 'Strong progress', createdAt: '2026-10-11T00:00:00Z' };
beforeEach(() => {
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  (reportService.getReports as jest.Mock).mockResolvedValue({ success: true, data: [report], pages: 1 });
  (reportService.downloadReportPdf as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.clearAllMocks(); });

test('loads only the selected participant report history and opens a report', async () => {
  root.render(<TeacherReportHistoryDialog open participantId="child-a" participantName="Casey Child" onClose={jest.fn()} />); await settle();
  expect(reportService.getReports).toHaveBeenCalledWith({ studentId: 'child-a', limit: 100 });
  expect(document.body).toHaveTextContent('Autumn Progress');
  const view = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'View')!;
  await act(async () => Simulate.click(view));
  expect(document.body).toHaveTextContent('Strong progress');
});

test('downloads finalized reports and displays API failures', async () => {
  (reportService.downloadReportPdf as jest.Mock).mockRejectedValue(new Error('PDF unavailable'));
  root.render(<TeacherReportHistoryDialog open participantId="child-a" participantName="Casey Child" onClose={jest.fn()} />); await settle();
  const download = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Download')!;
  await act(async () => Simulate.click(download)); await settle();
  expect(reportService.downloadReportPdf).toHaveBeenCalledWith('report-a');
  expect(document.body).toHaveTextContent('PDF unavailable');
});

test('shows empty and loading-error states', async () => {
  (reportService.getReports as jest.Mock).mockResolvedValueOnce({ success: true, data: [] });
  root.render(<TeacherReportHistoryDialog open participantId="child-a" participantName="Casey Child" onClose={jest.fn()} />); await settle();
  expect(document.body).toHaveTextContent('No reports are available');
});

test('shows a history loading error and retries the authorized participant query', async () => {
  (reportService.getReports as jest.Mock)
    .mockRejectedValueOnce(new Error('History unavailable'))
    .mockResolvedValueOnce({ success: true, data: [report], pages: 1 });
  root.render(<TeacherReportHistoryDialog open participantId="child-a" participantName="Casey Child" onClose={jest.fn()} />); await settle();
  expect(document.body).toHaveTextContent('History unavailable');
  const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry')!;
  await act(async () => Simulate.click(retry)); await settle();
  expect(reportService.getReports).toHaveBeenCalledTimes(2);
  expect(document.body).toHaveTextContent('Autumn Progress');
});

test('loads every server-authorized history page instead of silently truncating at 100', async () => {
  const second = { ...report, _id: 'report-b', title: 'Spring Progress' };
  (reportService.getReports as jest.Mock)
    .mockResolvedValueOnce({ success: true, data: [report], pages: 2 })
    .mockResolvedValueOnce({ success: true, data: [second], pages: 2 });
  root.render(<TeacherReportHistoryDialog open participantId="child-a" participantName="Casey Child" onClose={jest.fn()} />); await settle();
  expect(reportService.getReports).toHaveBeenNthCalledWith(1, { studentId: 'child-a', limit: 100 });
  expect(reportService.getReports).toHaveBeenNthCalledWith(2, { studentId: 'child-a', limit: 100, page: 2 });
  expect(document.body).toHaveTextContent('Autumn Progress');
  expect(document.body).toHaveTextContent('Spring Progress');
});

test('disables history downloads for draft reports', async () => {
  (reportService.getReports as jest.Mock).mockResolvedValueOnce({ success: true, data: [{ ...report, status: 'draft' }], pages: 1 });
  root.render(<TeacherReportHistoryDialog open participantId="child-a" participantName="Casey Child" onClose={jest.fn()} />); await settle();
  const download = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Download')!;
  expect(download).toBeDisabled();
});

test.each([
  ['Admin', path.resolve(__dirname, '../../admin/sections/AllReports.tsx'), /downloadReportPdf\(selectedReport\._id, schoolId\)/],
  ['Teacher', path.resolve(__dirname, './ReportsListing.tsx'), /downloadReportPdf\(report\._id\)/]
])('%s report action keeps authenticated download, finalized-state disabling, and failure feedback', (_name, filename, callPattern) => {
  const source = fs.readFileSync(filename, 'utf8');
  expect(source).toMatch(callPattern);
  expect(source).toMatch(/\['approved', 'sent'\]\.includes/);
  expect(source).toMatch(/toast\.error\(error instanceof Error \? error\.message/);
  expect(source).toMatch(/Preparing Download/);
});
