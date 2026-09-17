import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import RoadmapManagement from './RoadmapManagement';
import { useAuth } from '../../../contexts/AuthContext';
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
const swimming = { _id: 'program', schoolId: 'school', programId: 'parent-program', levelId: 'level', name: 'Customer Roadmap', description: 'Description', methodology: 'Practice', version: 1, status: 'draft', __v: 3 };
const reply = (data: unknown) => ({ ok: true, json: async () => ({ success: true, data }) });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ user: { _id: 'admin', role: 'school_admin', schoolId: 'school' }, token: 'synthetic-token' });
  (fetch as jest.Mock).mockReset().mockImplementation((url: string) => Promise.resolve(reply(url.includes('status=draft') ? [swimming] : [])));
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const step = async (fn: () => void) => { await act(async () => { fn(); }); };
const render = () => step(() => root.render(<RoadmapManagement schoolId="school" level={{ _id: 'level', schoolId: 'school', programId: 'parent-program', name: 'Custom Level', sequence: 1, isActive: true }} program={{ _id: 'parent-program', schoolId: 'school', name: 'Custom Program', isActive: true, displayOrder: 0 }} />));
function button(text: string) { return Array.from(document.querySelectorAll('button')).find(b => b.textContent === text)!; }
function input(label: string) { const l = Array.from(document.querySelectorAll('label')).find(x => x.textContent?.startsWith(label))!; return document.getElementById(l.htmlFor)!; }
test('list shows name, version, status, description and context', async () => {
  await render(); expect(document.body).toHaveTextContent('Custom Program'); expect(document.body).toHaveTextContent('Customer Roadmap — Version 1'); expect(document.body).toHaveTextContent('draft');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/roadmaps?schoolId=school&programId=parent-program&levelId=level&status=archived'), expect.anything());
});
test('Add validates name and creates a scoped draft without client version/status/end date', async () => {
  await render(); await step(() => Simulate.click(button('Add Roadmap'))); expect(button('Save draft')).toBeDisabled();
  await step(() => Simulate.change(input('Name'), { target: { value: ' New plan ' } } as any));
  await step(() => Simulate.click(button('Save draft')));
  const [,options] = (fetch as jest.Mock).mock.calls.find(([,o]) => o.method === 'POST');
  expect(JSON.parse(options.body)).toEqual({name:'New plan',description:'',methodology:'',programId:'parent-program',levelId:'level',schoolId:'school'});
  expect(document.body).toHaveTextContent('Roadmap draft saved.'); expect(fetch).toHaveBeenCalledTimes(7);
});
test('draft editing echoes the loaded revision', async () => {
  await render(); await step(() => Simulate.click(button('Edit draft'))); expect(input('Name')).toHaveValue('Customer Roadmap');
  await step(() => Simulate.click(button('Save draft')));
  const [,options] = (fetch as jest.Mock).mock.calls.find(([,o]) => o.method === 'PUT'); expect(JSON.parse(options.body).__v).toBe(3);
});
test('first activation requires confirmation and null predecessor', async () => {
  await render(); await step(() => Simulate.click(button('Activate'))); expect(fetch).toHaveBeenCalledTimes(3);
  await step(() => Simulate.click(button('Confirm operation')));
  const [url,options] = (fetch as jest.Mock).mock.calls.find(([,o]) => o.method === 'PATCH'); expect(url).toContain('/activate?');
  expect(JSON.parse(options.body)).toMatchObject({ __v:3,expectedPredecessor:null,schoolId:'school' });
});
test('replacement activation echoes exact predecessor identity and revision', async () => {
  (fetch as jest.Mock).mockImplementation((url: string) => Promise.resolve(reply(url.includes('status=draft') ? [{...swimming,version:2}] : url.includes('status=active') ? [{...swimming,_id:'old',status:'active',__v:8}] : [])));
  await render(); await step(() => Simulate.click(button('Activate'))); expect(document.body).toHaveTextContent('This archives');
  await step(() => Simulate.click(button('Confirm operation')));
  const [,o] = (fetch as jest.Mock).mock.calls.find(([,o]) => o.method === 'PATCH'); expect(JSON.parse(o.body).expectedPredecessor).toEqual({_id:'old',__v:8});
});
test('409 blocks stale retry, preserves edit content, and provides explicit reload', async () => {
  await render(); await step(() => Simulate.click(button('Edit draft')));
  await step(() => Simulate.change(input('Name'), { target:{value:'Unsaved name'} } as any));
  (fetch as jest.Mock).mockResolvedValueOnce({ok:false,status:409});
  await step(() => Simulate.click(button('Save draft')));
  expect(document.body).toHaveTextContent('This Roadmap changed'); expect(input('Name')).toHaveValue('Unsaved name'); expect(button('Save draft')).toBeDisabled();
  await step(() => Simulate.click(button('Reload and discard unsaved changes'))); expect(button('Add Roadmap')).not.toBeDisabled();
});
test('active Roadmaps cannot be edited; archival is confirmed', async () => {
  (fetch as jest.Mock).mockImplementation((url:string) => Promise.resolve(reply(url.includes('status=active') ? [{...swimming,status:'active'}] : [])));
  await render(); expect(button('Edit draft')).toBeUndefined(); await step(() => Simulate.click(button('Archive'))); expect(fetch).toHaveBeenCalledTimes(3);
  await step(() => Simulate.click(button('Confirm operation')));
  const [url,o] = (fetch as jest.Mock).mock.calls.find(([,o]) => o.method === 'PATCH'); expect(url).toContain('/deactivate?'); expect(JSON.parse(o.body).__v).toBe(3);
});
test('new version uses versions endpoint, never changes existing status', async () => {
  await render(); await step(() => Simulate.click(button('New version'))); await step(() => Simulate.click(button('Confirm operation')));
  const [url,o] = (fetch as jest.Mock).mock.calls.find(([,o]) => o.method === 'POST'); expect(url).toContain('/versions?'); expect(JSON.parse(o.body)).toEqual({schoolId:'school'});
});
test.each(['teacher','parent'])('%s cannot load management APIs', async role => {
  (useAuth as jest.Mock).mockReturnValue({user:{role},token:'synthetic-token'}); await render(); expect(fetch).not.toHaveBeenCalled();
});
test('Super Admin operates in selected context', async () => {
  (useAuth as jest.Mock).mockReturnValue({user:{role:'super_admin'},token:'synthetic-token'}); await render(); expect(button('Add Roadmap')).not.toBeDisabled();
});
test('raw server errors stay hidden and require reload', async () => {
  await render(); await step(() => Simulate.click(button('Activate'))); (fetch as jest.Mock).mockRejectedValueOnce(new Error('PRIVATE_DATABASE_DETAILS'));
  await step(() => Simulate.click(button('Confirm operation'))); expect(document.body).not.toHaveTextContent('PRIVATE_DATABASE_DETAILS'); expect(document.body).toHaveTextContent('could not be confirmed'); expect(button('Confirm operation')).toBeDisabled();
});
test('Roadmap opens Planned Sessions with back navigation', async () => {
  await render();
  (fetch as jest.Mock).mockImplementation((url:string) => Promise.resolve(reply(url.includes('/sessions?') || url.includes('/config/') ? [] : swimming)));
  await step(() => Simulate.click(button('Planned Sessions')));
  expect(document.body).toHaveTextContent('Customer Roadmap — Version 1 → Planned Sessions');
  expect(button('Add Planned Session')).toBeDisabled();
  (fetch as jest.Mock).mockImplementation((url:string) => Promise.resolve(reply(url.includes('status=draft') ? [swimming] : [])));
  await step(() => Simulate.click(button('Back to Roadmaps'))); expect(button('Add Roadmap')).toBeInTheDocument();
});
