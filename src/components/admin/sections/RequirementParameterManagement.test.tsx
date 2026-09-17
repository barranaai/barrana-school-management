import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import RequirementParameterManagement from './RequirementParameterManagement';
import { useAuth } from '../../../contexts/AuthContext';
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
const swimming = { _id: 'program', schoolId: 'school', programId: 'parent-program', levelId: 'level', isRequired: true, name: 'Swimming', description: 'Water safety', sequence: 0, isActive: true };
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'admin', role: 'school_admin', schoolId: 'school' }, token: 'synthetic-token' });
  (fetch as jest.Mock).mockReset().mockResolvedValue(reply([swimming]));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const render = () => step(() => root.render(<RequirementParameterManagement schoolId="school" level={{ _id: 'level', schoolId: 'school', programId: 'parent-program', name: 'Custom Level', sequence: 1, isActive: true }} program={{ _id: 'parent-program', schoolId: 'school', name: 'Custom Program', isActive: true, displayOrder: 0 }} />));
function button(text: string) { return Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!; }
function input(label: string) { const l = Array.from(document.querySelectorAll('label')).find(x => x.textContent?.startsWith(label))!; return document.getElementById(l.htmlFor)!; }
test('lists Requirements for the authenticated School Admin school', async () => {
  await render(); expect(document.body).toHaveTextContent('Swimming');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/config/requirements?schoolId=school&programId=parent-program&levelId=level'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }) }));
});
async function openParameters() {
  await render();
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ _id: 'parameter', schoolId: 'school', programId: 'parent-program', requirementId: 'program', name: 'Measurement', type: 'number', sequence: 1, isRequired: false, isActive: true }]));
  await step(() => Simulate.click(button('Parameters')));
}
async function chooseType(type: string) {
  await step(() => Simulate.mouseDown(input('Type'), { button: 0 }));
  await step(() => Simulate.click(Array.from(document.querySelectorAll('[role="option"]')).find(x => x.textContent === type)!));
}
test('lists Parameters under the selected Requirement', async () => {
  await openParameters(); expect(document.body).toHaveTextContent('Measurement'); expect(document.body).toHaveTextContent('Type: number');
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/config/parameters?schoolId=school&programId=parent-program&requirementId=program'), expect.anything());
});
test('select Parameter requires options, creates through API and refreshes', async () => {
  await openParameters(); await step(() => Simulate.click(button('Add Parameter')));
  expect(button('Save Parameter')).toBeDisabled();
  await step(() => Simulate.change(input('Parameter name'), { target: { value: 'Choice' } } as any));
  await chooseType('select'); expect(button('Save Parameter')).toBeDisabled();
  await step(() => Simulate.change(input('Options'), { target: { value: ' First\n\nSecond ' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply([{ _id: 'p', schoolId: 'school', programId: 'parent-program', requirementId: 'program', name: 'Choice', type: 'select', options: ['First','Second'], sequence: 0, isRequired: false }]));
  await step(() => Simulate.click(button('Save Parameter')));
  expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('/config/parameters?schoolId=school&programId=parent-program&requirementId=program'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Choice', sequence: 0, isRequired: false, schoolId: 'school', programId: 'parent-program', requirementId: 'program', type: 'select', options: ['First', 'Second'] }) }));
  expect(document.body).toHaveTextContent('Parameter created.'); expect(document.body).toHaveTextContent('Options: First, Second');
});
test('Parameter error is safe and preserves unsaved input', async () => {
  await openParameters(); await step(() => Simulate.click(button('Add Parameter')));
  await step(() => Simulate.change(input('Parameter name'), { target: { value: 'Measure' } } as any));
  (fetch as jest.Mock).mockRejectedValueOnce(new Error('PRIVATE_VALUE'));
  await step(() => Simulate.click(button('Save Parameter')));
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('PRIVATE_VALUE'); expect(input('Parameter name')).toHaveValue('Measure');
});
test('Parameter edit and confirmed deactivation use supported API', async () => {
  await openParameters(); await step(() => Simulate.click(button('Edit')));
  expect(input('Parameter name')).toHaveValue('Measurement');
  (fetch as jest.Mock).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply([{ _id: 'parameter', schoolId: 'school', programId: 'parent-program', requirementId: 'program', name: 'Measurement', type: 'number', sequence: 1 }]));
  await step(() => Simulate.click(button('Save Parameter')));
  expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('/config/parameters/parameter?'), expect.objectContaining({ method: 'PUT' }));
  await step(() => Simulate.click(button('Deactivate'))); expect(fetch).toHaveBeenCalledTimes(4);
  (fetch as jest.Mock).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Confirm deactivation')));
  expect(fetch).toHaveBeenNthCalledWith(5, expect.stringContaining('/config/parameters/parameter?'), expect.objectContaining({ method: 'DELETE' })); expect(document.body).toHaveTextContent('Parameter deactivated.');
});
test('Super Admin selected school is retained for Requirement writes', async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'super', role: 'super_admin' }, token: 'synthetic-token' });
  await render(); await step(() => Simulate.click(button('Add Requirement')));
  await step(() => Simulate.change(input('Requirement name'), { target: { value: 'Customer objective' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Save Requirement')));
  const body = JSON.parse((fetch as jest.Mock).mock.calls[1][1].body);
  expect(body).toMatchObject({ schoolId: 'school', programId: 'parent-program', levelId: 'level' });
});
test.each(['text','rating','percentage','number','checkbox'])('supports %s Parameter creation without select options', async type => {
  await openParameters(); await step(() => Simulate.click(button('Add Parameter')));
  await step(() => Simulate.change(input('Parameter name'), { target: { value: 'Customer measurement' } } as any));
  await chooseType(type);
  (fetch as jest.Mock).mockResolvedValueOnce(reply({})).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Save Parameter')));
  expect(JSON.parse((fetch as jest.Mock).mock.calls[2][1].body)).toMatchObject({ type, options: [], requirementId: 'program', schoolId: 'school' });
});
test('rejects Parameters from another Requirement', async () => {
  await render(); (fetch as jest.Mock).mockResolvedValueOnce(reply([{ _id:'p', schoolId:'school', programId:'parent-program', requirementId:'other', name:'Unrelated' }]));
  await step(() => Simulate.click(button('Parameters')));
  expect(document.body).not.toHaveTextContent('Unrelated'); expect(button('Add Parameter')).toBeDisabled();
});
test('Add Requirement validates required name and submits supported fields then refreshes', async () => {
  await render(); await step(() => Simulate.click(button('Add Requirement')));
  expect(button('Save Requirement')).toBeDisabled();
  await step(() => Simulate.change(input('Requirement name'), { target: { value: '   ' } } as any)); expect(button('Save Requirement')).toBeDisabled();
  await step(() => Simulate.change(input('Requirement name'), { target: { value: ' Karate ' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...swimming, name: 'Karate' })).mockResolvedValueOnce(reply([{ ...swimming, name: 'Karate' }]));
  await step(() => Simulate.click(button('Save Requirement')));
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/config/requirements?schoolId=school&programId=parent-program&levelId=level'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Karate', sequence: 0, isRequired: true, schoolId: 'school', programId: 'parent-program', levelId: 'level', description: '' }) }));
  expect(document.body).toHaveTextContent('Requirement created.'); expect(document.body).toHaveTextContent('Karate'); expect(fetch).toHaveBeenCalledTimes(3);
});
test('API failure keeps input and never renders raw errors', async () => {
  await render(); await step(() => Simulate.click(button('Add Requirement')));
  await step(() => Simulate.change(input('Requirement name'), { target: { value: 'Dance' } } as any));
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'PRIVATE_DATABASE_ERROR' }) });
  await step(() => Simulate.click(button('Save Requirement')));
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_ERROR'); expect(input('Requirement name')).toHaveValue('Dance');
});
test.each(['teacher', 'parent'])('%s cannot load management data', async role => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role }, token: 'synthetic-token' }); await render();
  expect(document.body).toHaveTextContent('Administrator access to this configuration required'); expect(fetch).not.toHaveBeenCalled();
});
test('editing uses PUT and deactivation requires confirmation and uses soft-delete API', async () => {
  await render(); await step(() => Simulate.click(button('Edit'))); expect(input('Requirement name')).toHaveValue('Swimming');
  (fetch as jest.Mock).mockResolvedValueOnce(reply(swimming)).mockResolvedValueOnce(reply([swimming]));
  await step(() => Simulate.click(button('Save Requirement')));
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/config/requirements/program?schoolId=school&programId=parent-program&levelId=level'), expect.objectContaining({ method: 'PUT' }));
  await step(() => Simulate.click(button('Deactivate'))); expect(fetch).toHaveBeenCalledTimes(3);
  (fetch as jest.Mock).mockResolvedValueOnce(reply({ ...swimming, isActive: false })).mockResolvedValueOnce(reply([]));
  await step(() => Simulate.click(button('Confirm deactivation')));
  expect(fetch).toHaveBeenNthCalledWith(4, expect.stringContaining('/config/requirements/program?schoolId=school&programId=parent-program&levelId=level'), expect.objectContaining({ method: 'DELETE' }));
  expect(document.body).toHaveTextContent('Requirement deactivated.');
});
test('rejects list data belonging to another tenant', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ ...swimming, schoolId: 'other' }])); await render();
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(document.body).not.toHaveTextContent('Water safety'); expect(button('Add Requirement')).toBeDisabled();
});
test('rejects Levels from another Program in the same school', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce(reply([{ ...swimming, programId: 'other-program' }])); await render();
  expect(document.body).toHaveTextContent('Unable to complete the request'); expect(button('Add Requirement')).toBeDisabled();
});
test('blank sequence prevents submission', async () => {
  await render(); await step(() => Simulate.click(button('Add Requirement')));
  await step(() => Simulate.change(input('Requirement name'), { target: { value: 'Beginner' } } as any));
  await step(() => Simulate.change(input('Sequence'), { target: { value: '' } } as any));
  expect(button('Save Requirement')).toBeDisabled(); expect(fetch).toHaveBeenCalledTimes(1);
});
