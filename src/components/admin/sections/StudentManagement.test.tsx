import fs from 'fs';
import path from 'path';

const participantSource = fs.readFileSync(path.resolve(__dirname, 'StudentManagement.tsx'), 'utf8');
const adminSource = fs.readFileSync(path.resolve(__dirname, '..', 'AdminDashboard.tsx'), 'utf8');

test('admin navigation and participant surface use neutral terminology', () => {
  expect(adminSource).toContain("text: 'Participant Management'");
  expect(participantSource).toContain('Participant Management');
  expect(participantSource).toContain('Add Participant');
  expect(participantSource).toContain('Participant ID');
  expect(participantSource).toContain('Guardian Contact');
  expect(participantSource).not.toContain('Student Management');
  expect(participantSource).not.toContain('Add New Student');
});

test('legacy compatibility fields remain explicit and separate from modern enrollment context', () => {
  expect(participantSource).toContain('Legacy grade (required for compatibility)');
  expect(participantSource).toContain('Legacy class (optional)');
  expect(participantSource).toContain('studentGrade: formData.grade');
  expect(participantSource).toContain('studentClass: formData.class');
  expect(participantSource).toContain('Programs and Enrollments');
  expect(participantSource).toContain('Current level:');
  expect(participantSource).toContain('Current class/group:');
});

test('modern participant details retain Enrollment navigation and hide misleading legacy profile labels', () => {
  expect(participantSource).toContain("window.location.hash = 'enrollments'");
  expect(participantSource).toContain('Manage Enrollments');
  expect(participantSource).not.toContain('label="Enrollment Date"');
  expect(participantSource).not.toContain('label="Academic Level"');
});
