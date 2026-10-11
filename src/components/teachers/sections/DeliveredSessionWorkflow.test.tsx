import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import DeliveredSessionWorkflow from './DeliveredSessionWorkflow';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService } from '../../../services/apiService';
import { roadmapService } from '../../../services/roadmapService';
import { plannedSessionService } from '../../../services/plannedSessionService';
import { levelService } from '../../../services/levelService';
import { getIndividualLessonEnrollments } from '../../../services/individualLessonService';

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/roadmapService', () => ({ roadmapService: jest.fn() }));
jest.mock('../../../services/plannedSessionService', () => ({ plannedSessionService: jest.fn() }));
jest.mock('../../../services/levelService', () => ({ levelService: jest.fn() }));
jest.mock('../../../services/individualLessonService', () => ({ getIndividualLessonEnrollments: jest.fn() }));
jest.mock('../../admin/sections/DeliveredSessionManagement', () => ({ __esModule: true, default: (props: any) => <div>Delivered workflow for {props.program.name} / {props.level.name} / {props.plannedSession.title}{props.individualTarget ? ` / Individual learner ${props.individualTarget.childName}` : ''}<button onClick={props.onBack}>Back to selector</button></div> }));

const group = { _id: 'group', name: 'Thursday Swimming', schoolId: 'school', programId: { _id: 'program', name: 'Learn to Swim' }, levelIds: [{ _id: 'level', name: 'Water Confidence', programId: 'program' }] };
const roadmap = { _id: 'roadmap', schoolId: 'school', programId: 'program', levelId: 'level', name: 'Foundation Roadmap', version: 1, status: 'active' };
const planned = { _id: 'planned', schoolId: 'school', roadmapId: 'roadmap', roadmapVersion: 1, sequence: 1, title: 'Safe Entry', status: 'active', objectives: [], expectedOutcomes: [] };
let host: HTMLDivElement, root: Root;
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); }); };
const field = (name: string) => document.getElementById(Array.from(document.querySelectorAll('label')).find(label => label.textContent?.startsWith(name))!.htmlFor)!;
async function choose(name: string, label: RegExp) {
  await step(() => Simulate.mouseDown(field(name), { button: 0 }));
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(row => label.test(row.textContent || ''))!;
  await step(() => Simulate.click(option)); await settle();
}

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'teacher', role: 'teacher', schoolId: 'school' }, token: 'token' });
  jest.spyOn(apiService, 'getTeacherAssignedClasses').mockResolvedValue({ success: true, data: [group] as any });
  (levelService as jest.Mock).mockReturnValue({ list: jest.fn().mockResolvedValue([{ _id: 'level', schoolId: 'school', programId: 'program', name: 'Water Confidence', sequence: 1, isActive: true }]) });
  (roadmapService as jest.Mock).mockReturnValue({ list: jest.fn().mockResolvedValue([roadmap]) });
  (plannedSessionService as jest.Mock).mockReturnValue({ load: jest.fn().mockResolvedValue({ roadmap, sessions: [planned], requirements: [], parameters: [] }) });
  (getIndividualLessonEnrollments as jest.Mock).mockResolvedValue([{ _id: 'enrollment', child: { _id: 'child', firstName: 'Leo', lastName: 'Demo' }, program: { _id: 'program', name: 'Learn to Swim' }, level: { _id: 'level', name: 'Water Confidence' }, status: 'active', startDate: '2026-01-01' }]);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); jest.restoreAllMocks(); });

test('selects only assigned group context and opens the existing Delivered Session workflow', async () => {
  await step(() => root.render(<DeliveredSessionWorkflow />));
  await settle();
  expect(apiService.getTeacherAssignedClasses).toHaveBeenCalled();
  await choose('Assigned Delivery Group', /Thursday Swimming/);
  await choose('Level', /Water Confidence/);
  expect(roadmapService).toHaveBeenCalledWith('token', 'school', 'program', 'level');
  await choose('Roadmap', /Foundation Roadmap/);
  await choose('Planned Session', /Safe Entry/);
  expect(document.body).toHaveTextContent('Delivered workflow for Learn to Swim / Water Confidence / Safe Entry');
});

test('shows safe gaps instead of inventing Program context', async () => {
  (apiService.getTeacherAssignedClasses as jest.Mock).mockResolvedValue({ success: true, data: [{ _id: 'legacy', name: 'Legacy Group', schoolId: 'school', levelIds: [] }] });
  await step(() => root.render(<DeliveredSessionWorkflow />));
  await settle();
  await choose('Assigned Delivery Group', /Legacy Group/);
  expect(document.body).toHaveTextContent('needs a Program');
  expect(roadmapService).not.toHaveBeenCalled();
});

test('a Program-wide group can use any active Level returned by the existing API', async () => {
  (apiService.getTeacherAssignedClasses as jest.Mock).mockResolvedValue({ success: true, data: [{ ...group, levelIds: [] }] });
  await step(() => root.render(<DeliveredSessionWorkflow />)); await settle();
  await choose('Assigned Delivery Group', /Thursday Swimming/);
  expect(levelService).toHaveBeenCalledWith('token', 'school', 'program');
  await choose('Level', /Water Confidence/);
  expect(roadmapService).toHaveBeenCalledWith('token', 'school', 'program', 'level');
});

test('rejects non-teacher access without loading assignments', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'parent', schoolId: 'school' }, token: 'token' });
  await step(() => root.render(<DeliveredSessionWorkflow />));
  expect(document.body).toHaveTextContent('Instructor access');
  expect(apiService.getTeacherAssignedClasses).not.toHaveBeenCalled();
});

test('loads date-authorized individual Enrollments and derives Program and Level from the selected Enrollment', async () => {
  await step(() => root.render(<DeliveredSessionWorkflow />)); await settle();
  await step(() => Simulate.click(Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Individual Lesson')!)); await settle();
  expect(getIndividualLessonEnrollments).toHaveBeenCalledWith('token', expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
  await choose('Assigned learner and Enrollment', /Leo Demo/);
  expect(document.body).toHaveTextContent('Program: Learn to Swim. Level: Water Confidence.');
  expect(roadmapService).toHaveBeenCalledWith('token', 'school', 'program', 'level');
  await choose('Roadmap', /Foundation Roadmap/);
  await choose('Planned Session', /Safe Entry/);
  expect(document.body).toHaveTextContent('Individual learner Leo Demo');
});

test('shows safe empty and API-error states for individual assignments', async () => {
  (getIndividualLessonEnrollments as jest.Mock).mockResolvedValue([]);
  await step(() => root.render(<DeliveredSessionWorkflow />)); await settle();
  await step(() => Simulate.click(Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Individual Lesson')!)); await settle();
  expect(document.body).toHaveTextContent('No active individual lesson assignments cover this date.');
  (getIndividualLessonEnrollments as jest.Mock).mockRejectedValue(new Error('denied'));
  const date = field('Lesson date and time') as HTMLInputElement;
  await step(() => Simulate.change(date, { target: { value: '2026-11-12T10:00' } })); await settle();
  expect(document.body).toHaveTextContent('Unable to confirm your authorized session options.');
});
