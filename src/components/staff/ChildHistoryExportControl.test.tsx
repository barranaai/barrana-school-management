/* eslint-disable testing-library/no-unnecessary-act */
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import ChildHistoryDialog from './ChildHistoryDialog';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const history: any = {
  child: { id: 'child', firstName: 'Maya', lastName: 'Demo', participantId: 'P-1', legacyGrade: null, isActive: true },
  currentEnrollments: [], development: { contexts: [], timeline: [] }, events: []
};

let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function render(role: string) {
  (useAuth as jest.Mock).mockReturnValue({ user: { role } });
  await act(async () => { root.render(<ChildHistoryDialog open childId="child" schoolId="school" onClose={jest.fn()} loadHistory={jest.fn().mockResolvedValue(history)} />); });
  await act(async () => { await Promise.resolve(); });
}

test('administrators see the export action', async () => {
  await render('school_admin');
  expect(document.body).toHaveTextContent('Export history');
});

test('teachers do not see the organizational export action', async () => {
  await render('teacher');
  expect(document.body).not.toHaveTextContent('Export history');
});
