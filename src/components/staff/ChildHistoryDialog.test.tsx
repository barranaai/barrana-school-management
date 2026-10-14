/* eslint-disable testing-library/no-unnecessary-act, testing-library/render-result-naming-convention */
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import ChildHistoryDialog from './ChildHistoryDialog';
import { ChildHistoryData } from '../../services/childHistoryService';
import { useAuth } from '../../contexts/AuthContext';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const history: ChildHistoryData = {
  child: { id: 'child', firstName: 'Maya', lastName: 'Demo', participantId: 'P-001', legacyGrade: null, isActive: true },
  currentEnrollments: [{ enrollmentId: 'enrollment', program: { id: 'program', name: 'Learn-to-Swim' }, level: { id: 'level', name: 'Water Confidence' }, group: { id: 'group', name: 'Saturday Group' }, status: 'active', startDate: '2026-09-01T00:00:00.000Z' }],
  development: {
    contexts: [{ program: { id: 'program', name: 'Learn-to-Swim' }, level: { id: 'level', name: 'Water Confidence' }, sessionCount: 1, objectiveStatusCounts: { achieved: 1, partially_achieved: 0, not_achieved: 0, needs_improvement: 0, not_observed: 1 } }],
    timeline: [{ progressId: 'progress', participationId: 'participation', deliveredSessionId: 'session', date: '2026-09-05T09:00:00.000Z', session: { id: 'session', name: 'Safe Entry' }, program: { id: 'program', name: 'Learn-to-Swim' }, level: { id: 'level', name: 'Water Confidence' }, group: { id: 'group', name: 'Saturday Group' }, overallStatus: 'partially_achieved', objectiveResults: [{ objectiveId: 'objective', title: 'Safe pool entry', status: 'achieved', expectedOutcome: 'Enter safely' }, { objectiveId: 'objective-2', title: 'Floating', status: 'not_observed', expectedOutcome: null }], parameterResults: [{ parameterId: 'parameter', requirementLabel: 'Safe entry', parameterLabel: 'Confidence', type: 'rating', value: 3 }], revisionNumber: 2, priorRevisionCount: 1 }]
  },
  events: [
    { type: 'session', date: '2026-09-05T09:00:00.000Z', title: 'Delivered session', description: 'Safe Entry', details: { program: { name: 'Learn-to-Swim' }, level: { name: 'Water Confidence' }, group: { name: 'Saturday Group' }, participationStatus: 'active' } },
    { type: 'progress', date: '2026-09-05T10:00:00.000Z', title: 'Progress recorded', description: 'Safe Entry', details: { overallStatus: 'partially_achieved', objectiveResults: [{ objectiveId: 'objective', title: 'Safe pool entry', status: 'achieved' }], parameterResults: [{ parameterId: 'parameter', parameterLabel: 'Confidence', value: 3 }], observations: 'Calm entry' } },
    { type: 'report', date: '2026-09-08T12:00:00.000Z', title: 'Report', description: 'September progress', details: { reportType: 'progress', status: 'approved', finalizedAt: '2026-09-08T12:00:00.000Z' } }
  ]
};

let host: HTMLDivElement; let root: Root;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); (useAuth as jest.Mock).mockReturnValue({ user: { role: 'school_admin' } }); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = async (loadHistory: any, onClose = jest.fn()) => {
  await act(async () => { root.render(<ChildHistoryDialog open childId="child" schoolId="school" onClose={onClose} loadHistory={loadHistory} />); });
  await act(async () => { await Promise.resolve(); });
  return onClose;
};

test('renders current enrollment and chronological history entries', async () => {
  await render(jest.fn().mockResolvedValue(history));
  expect(document.body).toHaveTextContent('Maya Demo');
  expect(document.body).toHaveTextContent('Learn-to-Swim');
  expect(document.body).toHaveTextContent('Safe Entry');
  expect(document.body).toHaveTextContent('Safe pool entry: Achieved');
  expect(document.body).toHaveTextContent('Development over time');
  expect(document.body).toHaveTextContent('Not Observed: 1');
  expect(document.body).toHaveTextContent('Revised 1 time');
  expect(document.body).toHaveTextContent('September progress');
});

test('shows an empty history state', async () => {
  await render(jest.fn().mockResolvedValue({ ...history, currentEnrollments: [], development: { contexts: [], timeline: [] }, events: [] }));
  expect(document.body).toHaveTextContent('No current enrollment.');
  expect(document.body).toHaveTextContent('No history is available for this participant yet.');
  expect(document.body).toHaveTextContent('No developmental progress has been recorded yet.');
});

test('shows loading and safe error states', async () => {
  let reject!: (reason: Error) => void;
  const pending = new Promise((_resolve, fail) => { reject = fail; });
  await act(async () => { root.render(<ChildHistoryDialog open childId="child" onClose={jest.fn()} loadHistory={() => pending as any} />); });
  expect(document.body).toHaveTextContent('Loading history');
  await act(async () => reject(new Error('Participant history could not be loaded. Please try again.')));
  expect(document.body).toHaveTextContent('Participant history could not be loaded. Please try again.');
});

test('back action returns to participant management', async () => {
  const onClose = await render(jest.fn().mockResolvedValue(history));
  const button = [...document.body.querySelectorAll('button')].find(item => item.textContent?.includes('Back to participants'))!;
  await act(async () => button.click());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('export control is available only to organization and platform administrators', async () => {
  await render(jest.fn().mockResolvedValue(history));
  expect(document.body).toHaveTextContent('Export history');
  await act(async () => root.unmount()); root = createRoot(host);
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'teacher' } });
  await render(jest.fn().mockResolvedValue(history));
  expect(document.body).not.toHaveTextContent('Export history');
});
