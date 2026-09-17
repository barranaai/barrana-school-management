import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import ProgramManagement from './ProgramManagement';
import { useAuth } from '../../../contexts/AuthContext';
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
const swimming = { _id: 'program', schoolId: 'school', name: 'Swimming', description: 'Water safety', displayOrder: 0, isActive: true };
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'admin', role: 'school_admin', schoolId: 'school' }, token: 'synthetic-token' });
  (fetch as jest.Mock).mockReset().mockResolvedValue(reply([swimming]));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const render = () => step(() => root.render(<ProgramManagement />));
function button(text: string) { return Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!; }
function input(label: string) { const l = Array.from(document.querySelectorAll('label')).find(x => x.textContent?.startsWith(label))!; return document.getElementById(l.htmlFor)!; }
test('lists Programs for the authenticated School Admin school', async () => {
  await render(); expect(document.body).toHaveTextContent('Swimming');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/programs?schoolId=school'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }) }));
});
test('Add Program validates required name and submits supported fields then refreshes', async () => {
  await render(); await step(() => Simulate.click(button('Add Program')));
  expect(button('Save Program')).toBeDisabled();
  await step(() => Simulate.change(input('Program name'), { target: { value: '   ' } } as any)); expect(button('Save Program')).toBeDisabled();
  await step(() => Simulate.change(input('Program name'), { target: { value: ' Karate ' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...swimming, name: 'Karate' })).mockResolvedValueOnce(reply([{ ...swimming, name: 'Karate' }]));
  await step(() => Simulate.click(button('Save Program')));
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/config/programs?schoolId=school'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Karate', description: '', displayOrder: 0, schoolId: 'school' }) }));
  expect(document.body).toHaveTextContent('Program created.'); expect(document.body).toHaveTextContent('Karate'); expect(fetch).toHaveBeenCalledTimes(3);
});
test('API failure keeps input and never renders raw errors', async () => {
  await render(); await step(() => Simulate.click(button('Add Program')));
  await step(() => Simulate.change(input('Program name'), { target: { value: 'Dance' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'PRIVATE_DATABASE_ERROR' }) });
  await step(() => Simulate.click(button('Save Program')));
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_ERROR'); expect(input('Program name')).toHaveValue('Dance');
});
test.each(['teacher', 'parent'])('%s cannot load management data', async role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role }, token: 'synthetic-token' }); await render();
  expect(document.body).toHaveTextContent('Administrator access required'); expect(fetch).not.toHaveBeenCalled();
});
test('Super Admin must select a school before loading Programs', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'super', role: 'super_admin' }, token: 'synthetic-token' });
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ _id: 'school', name: 'Demo school' }]));
  await render(); expect(fetch).toHaveBeenCalledTimes(1); expect(document.body).toHaveTextContent('Choose a school to manage Programs');
  await step(() => Simulate.mouseDown(input('School'), { button: 0 }));
  const option = Array.from(document.querySelectorAll('[role="option"]')).find(x => x.textContent === 'Demo school')!;
  await step(() => Simulate.click(option)); expect(document.body).toHaveTextContent('Swimming');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/config/programs?schoolId=school'), expect.anything());
});
test('editing uses PUT and deactivation requires confirmation and uses soft-delete API', async () => {
  await render(); await step(() => Simulate.click(button('Edit'))); expect(input('Program name')).toHaveValue('Swimming');
  (fetch as jest.Mock).mockResolvedValueOnce(reply(swimming)).mockResolvedValueOnce(reply([swimming]));
  await step(() => Simulate.click(button('Save Program')));
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/config/programs/program?schoolId=school'), expect.objectContaining({ method: 'PUT' }));
  await step(() => Simulate.click(button('Deactivate'))); expect(fetch).toHaveBeenCalledTimes(3);
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...swimming, isActive: false })).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Confirm deactivation')));
  expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/config/programs/program?schoolId=school'), expect.objectContaining({ method: 'DELETE' }));
  expect(document.body).toHaveTextContent('Program deactivated.');
});
test('rejects list data belonging to another tenant', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ ...swimming, schoolId: 'other' }])); await render();
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('Water safety'); expect(button('Add Program')).toBeDisabled();
});
test('selected Program opens its Levels and Back returns to Programs', async () => {
  await render(); (fetch as jest.Mock).mockResolvedValueOnce(reply([{ _id: 'level', schoolId: 'school', programId: 'program', name: 'Beginner', sequence: 1, isActive: true }]));
  await step(() => Simulate.click(button('Levels')));
  expect(document.body).toHaveTextContent('Levels — Swimming'); expect(document.body).toHaveTextContent('Beginner');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/config/levels?schoolId=school&programId=program'), expect.anything());
  await step(() => Simulate.click(button('Back to Programs'))); expect(button('Add Program')).toBeInTheDocument();
});
test('Super Admin school scope carries through Program selection to Level creation', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'super', role: 'super_admin' }, token: 'synthetic-token' });
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ _id: 'school', name: 'Demo school' }]));
  await render(); await step(() => Simulate.mouseDown(input('School'), { button: 0 }));
  await step(() => Simulate.click(Array.from(document.querySelectorAll('[role="option"]')).find(x => x.textContent === 'Demo school')!));
  (fetch as jest.Mock).mockResolvedValueOnce(reply([])); await step(() => Simulate.click(button('Levels')));
  await step(() => Simulate.click(button('Add Level'))); await step(() => Simulate.change(input('Level name'), { target: { value: 'Intermediate' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Save Level')));
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/levels?schoolId=school&programId=program'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Intermediate', description: '', sequence: 0, schoolId: 'school', programId: 'program' }) }));
});
