import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import LevelManagement from './LevelManagement';
import { useAuth } from '../../../contexts/AuthContext';
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
const swimming = { _id: 'program', schoolId: 'school', programId: 'parent-program', name: 'Swimming', description: 'Water safety', sequence: 0, isActive: true };
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'admin', role: 'school_admin', schoolId: 'school' }, token: 'synthetic-token' });
  (fetch as jest.Mock).mockReset().mockResolvedValue(reply([swimming]));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const render = () => step(() => root.render(<LevelManagement schoolId="school" program={{ _id: 'parent-program', schoolId: 'school', name: 'Custom Program', isActive: true, displayOrder: 0 }} />));
function button(text: string) { return Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!; }
function input(label: string) { const l = Array.from(document.querySelectorAll('label')).find(x => x.textContent?.startsWith(label))!; return document.getElementById(l.htmlFor)!; }
test('lists Programs for the authenticated School Admin school', async () => {
  await render(); expect(document.body).toHaveTextContent('Swimming');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/levels?schoolId=school&programId=parent-program'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }) }));
});
test('Add Level validates required name and submits supported fields then refreshes', async () => {
  await render(); await step(() => Simulate.click(button('Add Level')));
  expect(button('Save Level')).toBeDisabled();
  await step(() => Simulate.change(input('Level name'), { target: { value: '   ' } } as any)); expect(button('Save Level')).toBeDisabled();
  await step(() => Simulate.change(input('Level name'), { target: { value: ' Karate ' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...swimming, name: 'Karate' })).mockResolvedValueOnce(reply([{ ...swimming, name: 'Karate' }]));
  await step(() => Simulate.click(button('Save Level')));
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/config/levels?schoolId=school&programId=parent-program'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Karate', description: '', sequence: 0, schoolId: 'school', programId: 'parent-program' }) }));
  expect(document.body).toHaveTextContent('Level created.'); expect(document.body).toHaveTextContent('Karate'); expect(fetch).toHaveBeenCalledTimes(3);
});
test('API failure keeps input and never renders raw errors', async () => {
  await render(); await step(() => Simulate.click(button('Add Level')));
  await step(() => Simulate.change(input('Level name'), { target: { value: 'Dance' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'PRIVATE_DATABASE_ERROR' }) });
  await step(() => Simulate.click(button('Save Level')));
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_ERROR'); expect(input('Level name')).toHaveValue('Dance');
});
test.each(['teacher', 'parent'])('%s cannot load management data', async role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role }, token: 'synthetic-token' }); await render();
  expect(document.body).toHaveTextContent('Administrator access to this school required'); expect(fetch).not.toHaveBeenCalled();
});
test('editing uses PUT and deactivation requires confirmation and uses soft-delete API', async () => {
  await render(); await step(() => Simulate.click(button('Edit'))); expect(input('Level name')).toHaveValue('Swimming');
  (fetch as jest.Mock).mockResolvedValueOnce(reply(swimming)).mockResolvedValueOnce(reply([swimming]));
  await step(() => Simulate.click(button('Save Level')));
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/config/levels/program?schoolId=school&programId=parent-program'), expect.objectContaining({ method: 'PUT' }));
  await step(() => Simulate.click(button('Deactivate'))); expect(fetch).toHaveBeenCalledTimes(3);
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...swimming, isActive: false })).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Confirm deactivation')));
  expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/config/levels/program?schoolId=school&programId=parent-program'), expect.objectContaining({ method: 'DELETE' }));
  expect(document.body).toHaveTextContent('Level deactivated.');
});
test('rejects list data belonging to another tenant', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ ...swimming, schoolId: 'other' }])); await render();
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('Water safety'); expect(button('Add Level')).toBeDisabled();
});
test('rejects Levels from another Program in the same school', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ ...swimming, programId: 'other-program' }])); await render();
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(button('Add Level')).toBeDisabled();
});
test('blank sequence prevents submission', async () => {
  await render(); await step(() => Simulate.click(button('Add Level')));
  await step(() => Simulate.change(input('Level name'), { target: { value: 'Beginner' } } as any));
  await step(() => Simulate.change(input('Sequence'), { target: { value: '' } } as any));
  expect(button('Save Level')).toBeDisabled(); expect(fetch).toHaveBeenCalledTimes(1);
});
test('Level navigation opens Requirements in the selected context', async () => {
  await render(); (fetch as jest.Mock).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Requirements')));
  expect(document.body).toHaveTextContent('Custom Program → Swimming → Requirements');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/config/requirements?schoolId=school&programId=parent-program&levelId=program'), expect.anything());
  expect(button('Add Requirement')).toBeInTheDocument();
});
test('Level navigation opens Roadmaps without changing Requirements navigation', async () => {
  await render(); (fetch as jest.Mock).mockResolvedValue(reply([]));
  await step(() => Simulate.click(button('Roadmaps')));
  expect(document.body).toHaveTextContent('Custom Program → Swimming → Roadmaps');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/roadmaps?schoolId=school&programId=parent-program&levelId=program'), expect.anything());
});
