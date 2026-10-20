import fs from 'fs';
import path from 'path';

const sourceRoot = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8');

const sensitiveFrontendPaths = [
  'App.tsx',
  'components/admin/sections/AdminCommunicationCenter.tsx',
  'components/admin/sections/AllReports.tsx',
  'components/admin/sections/SchoolConfiguration.tsx',
  'components/admin/sections/StudentManagement.tsx',
  'components/admin/sections/TeacherManagement.tsx',
  'components/common/MediaUpload.tsx',
  'components/parents/CommunicationPage.tsx',
  'components/parents/ParentsUI.tsx',
  'components/super-admin/SuperAdminDashboard.tsx',
  'components/teachers/TeacherDashboard.tsx',
  'components/teachers/TeachersUI.tsx',
  'components/teachers/sections/IncidentReporting.tsx',
  'components/teachers/sections/Meetings.tsx',
  'components/teachers/sections/ReportsListing.tsx',
  'components/teachers/sections/StudentManagement.tsx',
  'components/teachers/sections/TeacherOverview.tsx',
  'config/firebase.ts',
  'contexts/DataContext.tsx',
  'services/aiService.ts',
  'services/analyticsService.ts',
  'services/databaseService.ts',
  'services/debugService.ts',
  'services/mediaService.ts',
  'services/messagingService.ts',
  'services/notificationService.ts',
  'services/reportService.ts'
];

test.each(sensitiveFrontendPaths)('%s does not write private operational data to the browser console', relativePath => {
  expect(read(relativePath)).not.toMatch(/console\.(?:log|debug|info|warn|error)\s*\(/);
});

test('communication credentials are write-only in the configuration screen', () => {
  const configuration = read('components/admin/sections/SchoolConfiguration.tsx');

  expect(configuration).toContain('inputRef={whatsappAccountSidRef}');
  expect(configuration).toContain('inputRef={whatsappAuthTokenRef}');
  expect(configuration).toContain('inputRef={smsAccountSidRef}');
  expect(configuration).toContain('inputRef={smsAuthTokenRef}');
  expect(configuration).not.toMatch(/value=\{communicationForm\.(?:whatsapp|sms)\.twilio/);
  expect(configuration).not.toContain("console.log('Communication data:'");
  expect(configuration).not.toContain("console.log('Save communication response:'");
});

test.each([
  'components/parents/ParentIncidents.tsx',
  'components/parents/ParentMeetings.tsx',
  'components/admin/sections/Expenses/ExpensesList.tsx',
  'components/admin/sections/IncidentManagement.tsx',
  'components/admin/sections/MeetingsManagement.tsx',
  'components/admin/sections/NotificationLogs.tsx',
  'utils/dueDateCalculations.ts',
  'utils/calculationLogger.ts'
])('%s does not pass raw errors or calculation data to the browser console', relativePath => {
  const source = read(relativePath);
  expect(source).not.toMatch(/console\.(?:log|warn|error)\([^\n]*,\s*(?:err|error|data)\s*\)/);
});
