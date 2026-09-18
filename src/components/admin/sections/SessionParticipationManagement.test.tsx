import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import SessionParticipationManagement from './SessionParticipationManagement';
import { DeliveredSession } from '../../../services/deliveredSessionService';

const session = { _id: 'session', schoolId: 'school', title: 'Safe entry', status: 'in_progress' } as DeliveredSession;
const candidate = { childId: 'eligible-child', enrollmentId: 'eligible-enrollment', firstName: 'Leo', lastName: 'River' };
const active = { _id: 'participation', schoolId: 'school', deliveredSessionId: 'session', childId: 'child', enrollmentId: 'enrollment', status: 'active', firstName: 'Maya', lastName: 'River' };
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
let roster: any, root: Root, host: HTMLDivElement;

beforeEach(() => {
  roster = { eligible: [candidate], participations: [active] };
  (fetch as jest.Mock).mockReset().mockImplementation((_url: string, options: any) => Promise.resolve(reply(options.method === 'GET' ? roster : active)));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const render = (onRecordProgress?: (id: string) => void) => step(() => root.render(<SessionParticipationManagement token="token" schoolId="school" session={session} onClose={jest.fn()} onRecordProgress={onRecordProgress} />));
const button = (text: string) => Array.from(document.querySelectorAll('button')).find(item => item.textContent === text)!;
const field = (text: string) => { const label = Array.from(document.querySelectorAll('label')).find(item => item.textContent?.startsWith(text))!; return document.getElementById(label.htmlFor)!; };
async function chooseCandidate() { await step(() => Simulate.mouseDown(field('Eligible child'), { button: 0 })); await step(() => Simulate.click(Array.from(document.querySelectorAll('[role="option"]')).find(item => item.textContent === 'Leo River')!)); }

test('renders eligible children, current participants and status', async () => {
  await render(); expect(document.body).toHaveTextContent('Safe entry → Participants'); await step(() => Simulate.mouseDown(field('Eligible child'), { button: 0 })); expect(document.body).toHaveTextContent('Leo River');
  expect(document.body).toHaveTextContent('Maya River'); expect(document.body).toHaveTextContent('Active');
});

test('opens Progress only for an active authoritative participation', async () => {
  const open = jest.fn(); await render(open); await step(() => Simulate.click(button('Record / View Progress'))); expect(open).toHaveBeenCalledWith('participation');
  roster = { eligible: [], participations: [{ ...active, status: 'absent' }] }; await step(() => Simulate.click(button('Reload Participants'))); expect(button('Record / View Progress')).toBeUndefined();
});

test('adds an eligible enrolled child and refreshes the roster', async () => {
  await render(); await chooseCandidate(); await step(() => Simulate.click(button('Add Participant')));
  const write = (fetch as jest.Mock).mock.calls.find(([, options]) => options.method === 'POST');
  expect(JSON.parse(write[1].body)).toEqual({ schoolId: 'school', deliveredSessionId: 'session', childId: 'eligible-child', enrollmentId: 'eligible-enrollment' });
  expect(document.body).toHaveTextContent('Participant added to this Delivered Session.');
});

test('duplicate or stale add failure is safe, blocks retry, and requires reload', async () => {
  await render(); await chooseCandidate(); (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Child already has participation' }) });
  await step(() => Simulate.click(button('Add Participant')));
  expect(document.body).toHaveTextContent('Unable to confirm this participation operation'); expect(document.body).not.toHaveTextContent('Child already has participation');
  expect(button('Add Participant')).toBeDisabled(); expect(document.body).toHaveTextContent('Reload the roster before retrying');
});

test.each([['Mark Absent', 'absent', 'PUT'], ['Mark Excused', 'excused', 'PUT'], ['Cancel Participation', undefined, 'DELETE']] as const)('%s confirms the supported status operation', async (action, status, method) => {
  await render(); await step(() => Simulate.click(button(action))); expect((fetch as jest.Mock).mock.calls.filter(([, options]) => options.method !== 'GET')).toHaveLength(0);
  await step(() => Simulate.click(button('Confirm'))); const write = (fetch as jest.Mock).mock.calls.find(([, options]) => options.method !== 'GET');
  expect(write[1].method).toBe(method); expect(write[1].body ? JSON.parse(write[1].body).status : undefined).toBe(status);
});

test.each(['absent', 'excused'] as const)('%s participation can return to active', async status => {
  roster = { eligible: [], participations: [{ ...active, status }] }; await render(); await step(() => Simulate.click(button('Mark Active'))); await step(() => Simulate.click(button('Confirm')));
  const write = (fetch as jest.Mock).mock.calls.find(([, options]) => options.method === 'PUT'); expect(JSON.parse(write[1].body).status).toBe('active');
});

test('cancelled participation is final and empty eligibility is clear', async () => {
  roster = { eligible: [], participations: [{ ...active, status: 'cancelled' }] }; await render();
  expect(document.body).toHaveTextContent('No eligible enrolled children are available to add.'); expect(document.body).toHaveTextContent('Cancelled participation is final.'); expect(button('Mark Active')).toBeUndefined();
});

test('empty participation state and authorization failure are safe', async () => {
  roster = { eligible: [], participations: [] }; await render(); expect(document.body).toHaveTextContent('No children are participating');
  (fetch as jest.Mock).mockReset().mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'PRIVATE' }) }); await step(() => Simulate.click(button('Reload Participants')));
  expect(document.body).toHaveTextContent('Unable to confirm'); expect(document.body).not.toHaveTextContent('PRIVATE');
});

test('explicit school scope is present on every request', async () => {
  await render(); expect((fetch as jest.Mock).mock.calls.every(([url]) => url.includes('schoolId=school'))).toBe(true);
});
