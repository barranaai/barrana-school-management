import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import ClassManagement from './ClassManagement';
import { useData } from '../../../contexts/DataContext';
import { apiService } from '../../../services/apiService';
import { programService } from '../../../services/programService';

jest.mock('../../../contexts/DataContext', () => ({ useData: jest.fn() }));
jest.mock('../../../services/apiService', () => ({
  apiService: {
    getClasses: jest.fn(),
    getTeachers: jest.fn(),
    getToken: jest.fn(),
    createClass: jest.fn(),
    updateClass: jest.fn(),
    deleteClass: jest.fn()
  }
}));
jest.mock('../../../services/programService', () => ({ programService: jest.fn() }));
jest.mock('../../common/NotificationIcon', () => () => null);

const program = {
  _id: 'program-1',
  schoolId: 'school-1',
  name: 'Learn to Swim',
  description: '',
  displayOrder: 0,
  isActive: true
};

let root: Root;
let host: HTMLDivElement;
const listPrograms = jest.fn();

const schoolProfile = {
  id: 'school-1',
  name: 'Learning School',
  type: 'public_private_school',
  status: 'Active',
  gradeLevels: ['grade1'],
  settings: {},
  workspaceProfile: {
    terminology: {
      workspace: 'School',
      administrator: 'School Administrator',
      trainer: 'Teacher',
      participant: 'Student',
      guardian: 'Parent',
      group: 'Class'
    },
    capabilities: { requiresAcademicGroupFields: true }
  }
};

const trainingProfile = {
  ...schoolProfile,
  name: 'Community Swim Club',
  type: 'Unknown',
  gradeLevels: [],
  workspaceProfile: {
    terminology: {
      workspace: 'Organization',
      administrator: 'Organization Administrator',
      trainer: 'Trainer',
      participant: 'Participant',
      guardian: 'Guardian',
      group: 'Group'
    },
    capabilities: { requiresAcademicGroupFields: false }
  }
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  (useData as jest.Mock).mockReturnValue({ school: schoolProfile });
  (apiService.getClasses as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (apiService.getTeachers as jest.Mock).mockResolvedValue({ success: true, data: [] });
  (apiService.getToken as jest.Mock).mockReturnValue('test-token');
  (apiService.createClass as jest.Mock).mockResolvedValue({ success: true, data: {} });
  listPrograms.mockResolvedValue([program]);
  (programService as jest.Mock).mockReturnValue({ list: listPrograms });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.clearAllMocks();
});

const step = async (fn: () => void) => {
  await act(async () => { fn(); });
};

const renderComponent = () => step(() => root.render(<ClassManagement />));

function button(text: string) {
  return Array.from(document.querySelectorAll('button')).filter(element => element.textContent === text).at(-1)!;
}

function input(label: string) {
  const labelElement = Array.from(document.querySelectorAll('label')).find(element => element.textContent?.startsWith(label))!;
  return document.getElementById(labelElement.htmlFor)!;
}

test('school workspace keeps academic Class fields required', async () => {
  await renderComponent();
  await step(() => Simulate.click(button('Add Class')));

  expect(document.body).toHaveTextContent('Add New Class');
  expect(document.body).toHaveTextContent('Grade');
  expect(document.body).toHaveTextContent('Academic Year');
  expect(document.body).toHaveTextContent('Semester');
  expect(document.body).toHaveTextContent('Program (optional)');

  await step(() => Simulate.change(input('Class Name'), { target: { value: 'Grade One' } } as any));
  expect(button('Add Class')).toBeDisabled();
});

test('non-school workspace uses Group terminology and omits academic fields', async () => {
  (useData as jest.Mock).mockReturnValue({ school: trainingProfile });
  await renderComponent();
  await step(() => Simulate.click(button('Add Group')));

  expect(document.body).toHaveTextContent('Add New Group');
  expect(document.body).toHaveTextContent('Program (optional)');
  expect(document.body).not.toHaveTextContent('Academic Year');
  expect(document.body).not.toHaveTextContent('Semester');
  expect(Array.from(document.querySelectorAll('label')).some(element => element.textContent?.startsWith('Grade'))).toBe(false);

  await step(() => Simulate.change(input('Group Name'), { target: { value: 'Saturday Swimmers' } } as any));
  expect(button('Add Group')).toBeEnabled();
});

test('non-school Program selection submits Program without academic placeholders', async () => {
  (useData as jest.Mock).mockReturnValue({ school: trainingProfile });
  await renderComponent();
  await step(() => Simulate.click(button('Add Group')));
  await step(() => Simulate.change(input('Group Name'), { target: { value: 'Saturday Swimmers' } } as any));

  const programLabel = Array.from(document.querySelectorAll('label')).find(element => element.textContent?.startsWith('Program (optional)'))!;
  const programSelect = programLabel.closest('.MuiFormControl-root')!.querySelector('[role="button"], [role="combobox"]')!;
  await step(() => Simulate.mouseDown(programSelect, { button: 0 }));
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(element => element.textContent === 'Learn to Swim')!;
  await step(() => Simulate.click(option));
  await step(() => Simulate.click(button('Add Group')));

  expect(programService).toHaveBeenCalledWith('test-token', 'school-1');
  expect(apiService.createClass).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Saturday Swimmers',
    programId: 'program-1'
  }));
  const payload = (apiService.createClass as jest.Mock).mock.calls[0][0];
  expect(payload).not.toHaveProperty('grade');
  expect(payload).not.toHaveProperty('academicYear');
  expect(payload).not.toHaveProperty('semester');
  expect(payload).not.toHaveProperty('subjects');
});
