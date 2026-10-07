import fs from 'fs';
import path from 'path';

const source = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

test('history is exposed from admin and teacher participant details only', () => {
  const admin = source('../admin/sections/StudentManagement.tsx');
  const teacher = source('../teachers/sections/StudentManagement.tsx');
  const parent = source('../parents/ParentsUI.tsx');

  expect(admin).toContain("import ChildHistoryDialog from '../../staff/ChildHistoryDialog'");
  expect(admin).toContain('View History');
  expect(teacher).toContain("import ChildHistoryDialog from '../../staff/ChildHistoryDialog'");
  expect(teacher).toContain('View History');
  expect(parent).not.toContain('ChildHistoryDialog');
});
