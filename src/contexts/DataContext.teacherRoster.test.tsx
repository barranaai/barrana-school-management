import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { DataProvider, useData } from './DataContext';
import { useAuth } from './AuthContext';
import { apiService } from '../services/apiService';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));

const teacher = {
  _id: 'teacher-1', id: 'teacher-1', firstName: 'Tia', lastName: 'Trainer', email: 'teacher@test.local',
  role: 'teacher', schoolId: 'school-1', isEmailVerified: true
};

const rosterParticipant = {
  _id: 'child-1', firstName: 'Current', lastName: 'Participant', name: 'Current Participant', age: 8,
  grade: '', studentId: 'P-1', schoolId: 'school-1', studentClass: 'Legacy Group Name', lastReport: 'Never',
  createdAt: '', updatedAt: '', currentEnrollments: [{
    _id: 'enrollment-1', programId: 'program-1', currentClassId: 'group-1', currentGroupName: 'Current Group',
    status: 'active' as const, startDate: ''
  }]
};

const assignedGroup = {
  _id: 'group-1', name: 'Current Group', schoolId: 'school-1', status: 'active', isActive: true,
  assignedTeachers: [{ teacherId: { _id: 'teacher-1', firstName: 'Tia', lastName: 'Trainer' }, role: 'primary' }],
  schedule: {}, capacity: 10, currentEnrollment: 1, subjects: [], createdBy: 'admin', createdAt: '', updatedAt: ''
};

let host: HTMLDivElement;
let root: Root;

const Consumer = () => {
  const { students, getStudentsByTeacherClasses } = useData();
  const roster = getStudentsByTeacherClasses('teacher-1');
  return <div data-testid="result">{students.length}:{roster.map(student => student.name).join(',')}</div>;
};

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true, isLoading: false, user: teacher });
  jest.spyOn(apiService, 'getTeacherCurrentParticipants').mockResolvedValue({ success: true, data: [rosterParticipant] as any });
  jest.spyOn(apiService, 'getStudents').mockResolvedValue({ success: true, data: [] });
  jest.spyOn(apiService, 'getTeachers').mockResolvedValue({ success: true, data: [] });
  jest.spyOn(apiService, 'getReports').mockResolvedValue({ success: true, data: [] });
  jest.spyOn(apiService, 'getTeacherAssignedClasses').mockResolvedValue({ success: true, data: [assignedGroup] as any });
  jest.spyOn(apiService, 'getClasses').mockResolvedValue({ success: true, data: [] });
  jest.spyOn(apiService, 'getSchool').mockResolvedValue({ success: false, data: null as any });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  jest.restoreAllMocks();
});

test('teacher dashboard data uses the enrollment roster endpoint without legacy class-name matching', async () => {
  // React 18 requires the provider's initial asynchronous refresh to be wrapped.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    root.render(<DataProvider><Consumer /></DataProvider>);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  expect(apiService.getTeacherCurrentParticipants).toHaveBeenCalled();
  expect(apiService.getStudents).not.toHaveBeenCalled();
  expect(host).toHaveTextContent('1:Current Participant');
});
