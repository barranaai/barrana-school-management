import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import TeacherDashboard from './TeacherDashboard';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/DataContext', () => ({ useData: jest.fn() }));
jest.mock('./sections/DeliveredSessionWorkflow', () => ({ __esModule: true, default: () => <div>Teacher delivered-session workflow</div> }));
jest.mock('../staff/ProgressWorkflow', () => ({ __esModule: true, default: () => <div>Teacher progress workflow</div> }));
jest.mock('./sections/TeacherOverview', () => ({ __esModule: true, default: () => <div>Overview</div> }));
jest.mock('./sections/StudentManagement', () => ({ __esModule: true, default: () => <div>Students</div> }));
jest.mock('./sections/ReportsListing', () => ({ __esModule: true, default: () => <div>Reports</div> }));
jest.mock('./sections/IncidentReporting', () => ({ __esModule: true, default: () => <div>Incidents</div> }));
jest.mock('./sections/Meetings', () => ({ __esModule: true, default: () => <div>Meetings</div> }));
jest.mock('./sections/CommunicationCenter', () => ({ __esModule: true, default: () => <div>Teacher communication center</div> }));

let host: HTMLDivElement, root: Root;
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); };

beforeEach(() => {
  window.location.hash = '#delivered-sessions';
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'teacher', role: 'teacher', schoolId: 'school', firstName: 'Tia', lastName: 'Trainer' }, logout: jest.fn() });
  (useData as jest.Mock).mockReturnValue({ school: { _id: 'school', name: 'Kidsible Swim' } });
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { schoolName: 'Kidsible Swim' } }) });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); window.location.hash = ''; jest.restoreAllMocks(); });

test('exposes My Sessions and keeps Session Progress as a separate existing destination', async () => {
  await step(() => root.render(<TeacherDashboard />)); await settle();
  expect(document.body).toHaveTextContent('Teacher delivered-session workflow');
  const progress = Array.from(document.querySelectorAll('li')).find(row => row.textContent?.includes('Session Progress'))!;
  await step(() => Simulate.click(progress));
  expect(window.location.hash).toBe('#session-progress');
  expect(document.body).toHaveTextContent('Teacher progress workflow');
});

test('exposes the teacher Communication destination', async () => {
  window.location.hash = '#communication';
  await step(() => root.render(<TeacherDashboard />)); await settle();
  expect(document.body).toHaveTextContent('Teacher communication center');
  expect(document.body).toHaveTextContent('Communication');
});
