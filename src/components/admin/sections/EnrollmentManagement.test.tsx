import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import EnrollmentManagement from './EnrollmentManagement';
import { useAuth } from '../../../contexts/AuthContext';
import { enrollmentService } from '../../../services/enrollmentService';

jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../../services/enrollmentService', () => ({ enrollmentService: jest.fn() }));

const child = { _id: 'child', schoolId: 'school', firstName: 'Maya', lastName: 'River' };
const program = { _id: 'program', schoolId: 'school', name: 'Swimming', isActive: true };
const level = { _id: 'level', schoolId: 'school', programId: 'program', name: 'Beginner', isActive: true, sequence: 1 };
const nextLevel = { ...level, _id: 'level-2', name: 'Intermediate', sequence: 2 };
const classOption = { _id: 'class', schoolId: 'school', name: 'Saturday Group' };
const nextClass = { _id: 'class-2', schoolId: 'school', name: 'Sunday Group' };
const enrollment = {
  _id: 'enrollment', schoolId: 'school', childId: 'child', programId: 'program', currentLevelId: 'level', currentClassId: 'class', status: 'active', startDate: '2026-09-19',
  levelHistory: [{ levelId: 'level', effectiveFrom: '2026-09-19' }],
  classAssignments: [{ classId: 'class', effectiveFrom: '2026-09-19', status: 'active' }],
  statusHistory: [{ status: 'active', changedAt: '2026-09-19' }]
};

let root: Root, host: HTMLDivElement, api: any;
beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'admin', role: 'school_admin', schoolId: 'school' }, token: 'token' });
  api = {
    schools: jest.fn().mockResolvedValue([{ _id: 'school', name: 'Demo Organization' }]),
    children: jest.fn().mockResolvedValue([child]), programs: jest.fn().mockResolvedValue([program]),
    levels: jest.fn().mockResolvedValue([level, nextLevel]), classes: jest.fn().mockResolvedValue([classOption, nextClass]),
    list: jest.fn().mockResolvedValue([enrollment]), create: jest.fn().mockResolvedValue(enrollment),
    changeLevel: jest.fn().mockResolvedValue(enrollment), changeClass: jest.fn().mockResolvedValue(enrollment), changeStatus: jest.fn().mockResolvedValue(enrollment), end: jest.fn().mockResolvedValue({ ...enrollment, status: 'withdrawn' })
  };
  (enrollmentService as jest.Mock).mockImplementation(() => api);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const render = () => step(() => root.render(<EnrollmentManagement />));
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === text)!;
const input = (label: string) => {
  const node = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.startsWith(label))!;
  return document.getElementById(node.htmlFor)!;
};
async function choose(label: string, option: string) {
  await step(() => Simulate.mouseDown(input(label), { button: 0 }));
  const item = Array.from(document.querySelectorAll('[role="option"]')).find(node => node.textContent === option)!;
  await step(() => Simulate.click(item));
}
async function openChild() { await render(); await choose('Participant', 'Maya River'); }

test('renders the selected child enrollment and preserved history', async () => {
  await openChild();
  expect(document.body).toHaveTextContent('Swimming'); expect(document.body).toHaveTextContent('Current level: Beginner');
  expect(document.body).toHaveTextContent('Current class: Saturday Group'); expect(document.body).toHaveTextContent('Level: Beginner');
  expect(document.body).toHaveTextContent('Status: Active');
});

test('shows an empty enrollment state', async () => {
  api.list.mockResolvedValueOnce([]); await openChild();
  expect(document.body).toHaveTextContent('No enrollment history for this participant.');
});

test('create requires Program and Level, submits their relationship, then refreshes', async () => {
  await openChild(); await step(() => Simulate.click(button('Add Enrollment')));
  expect(button('Save Enrollment')).toBeDisabled();
  await choose('Program', 'Swimming'); await choose('Level', 'Beginner');
  expect(document.body).toHaveTextContent('current backend does not define a safe Program/Level-to-Class relationship');
  api.list.mockResolvedValueOnce([enrollment]); await step(() => Simulate.click(button('Save Enrollment')));
  expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ childId: 'child', programId: 'program', currentLevelId: 'level', status: 'active' }));
  expect(document.body).toHaveTextContent('Enrollment created.');
});

test('pause and resume use only supported lifecycle status changes', async () => {
  await openChild(); await step(() => Simulate.click(button('Pause'))); await step(() => Simulate.click(button('Confirm')));
  expect(api.changeStatus).toHaveBeenCalledWith('enrollment', 'paused', '');
  api.list.mockResolvedValueOnce([{ ...enrollment, status: 'paused' }]); await step(() => Simulate.click(button('Refresh')));
  await step(() => Simulate.click(button('Resume'))); await step(() => Simulate.click(button('Confirm')));
  expect(api.changeStatus).toHaveBeenCalledWith('enrollment', 'active', '');
});

test('change Level offers only Levels from the enrollment Program', async () => {
  await openChild(); await step(() => Simulate.click(button('Change Level'))); await choose('New level', 'Intermediate'); await step(() => Simulate.click(button('Confirm')));
  expect(api.changeLevel).toHaveBeenCalledWith('enrollment', 'level-2', expect.any(String), '');
});

test('changes Class on the existing enrollment with an effective date and preserves history display', async () => {
  await openChild(); await step(() => Simulate.click(button('Change Class')));
  expect(document.body).toHaveTextContent("Confirm this class is appropriate for the enrollment's Program and Level");
  await choose('Class', 'Sunday Group');
  await step(() => Simulate.change(input('Effective date'), { target: { value: '2026-09-20' } }));
  await step(() => Simulate.click(button('Confirm')));
  expect(api.changeClass).toHaveBeenCalledWith('enrollment', 'class-2', '2026-09-20', '');
  expect(document.body).toHaveTextContent('Enrollment updated.');
});

test('shows safe class-assignment validation returned by the service', async () => {
  api.changeClass.mockRejectedValueOnce(new Error('Class is already the current assignment'));
  await openChild(); await step(() => Simulate.click(button('Change Class'))); await choose('Class', 'Sunday Group');
  await step(() => Simulate.click(button('Confirm')));
  expect(document.body).toHaveTextContent('Class is already the current assignment');
});

test('ending requires confirmation and keeps the history message', async () => {
  await openChild(); expect(api.end).not.toHaveBeenCalled(); await step(() => Simulate.click(button('End Enrollment')));
  expect(document.body).toHaveTextContent('history will be retained'); await step(() => Simulate.click(button('Confirm')));
  expect(api.end).toHaveBeenCalledWith('enrollment', ''); expect(document.body).toHaveTextContent('Enrollment ended and retained in history.');
});

test('safe errors are shown and raw service details are not rendered', async () => {
  api.list.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_ERROR')); await openChild();
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_ERROR');
});

test.each(['teacher', 'parent'])('%s cannot access enrollment management', async role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role }, token: 'token' }); await render();
  expect(document.body).toHaveTextContent('Administrator access required'); expect(api.children).not.toHaveBeenCalled();
});

test('Super Admin must choose an organization and selected scope is used', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'super', role: 'super_admin' }, token: 'token' }); await render();
  expect(document.body).toHaveTextContent('Choose an organization to manage enrollments.'); expect(api.children).not.toHaveBeenCalled();
  await choose('Organization', 'Demo Organization'); expect(enrollmentService).toHaveBeenCalledWith('token', 'school'); expect(api.children).toHaveBeenCalled();
});
