import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import DeliveredSessionManagement from './DeliveredSessionManagement';
import { useAuth } from '../../../contexts/AuthContext';
jest.mock('../../../contexts/AuthContext',()=>({useAuth:jest.fn()}));
const roadmap={_id:'r',schoolId:'s',programId:'p',levelId:'l',version:2,name:'Roadmap',status:'active' as const};
const planned={_id:'ps',schoolId:'s',roadmapId:'r',roadmapVersion:2,sequence:1,title:'Practice',status:'active' as const,objectives:[],expectedOutcomes:[]};
const props={schoolId:'s',program:{_id:'p',schoolId:'s',name:'Program',displayOrder:0,isActive:true},level:{_id:'l',schoolId:'s',programId:'p',name:'Level',sequence:1,isActive:true},roadmap,plannedSession:planned,onBack:jest.fn()};
const occurrence={_id:'d',schoolId:'s',programId:'p',levelId:'l',roadmapId:'r',roadmapVersion:2,plannedSessionId:'ps',classId:'c',deliveredBy:'admin',title:'Historical title',scheduledAt:'2026-09-19T09:00:00.000Z',status:'scheduled',deliveryNotes:'Notes',plannedSessionSnapshot:{title:'Historical title',methodology:'Original method',objectives:[],expectedOutcomes:['Original outcome']}};
const reply=(data:unknown)=>({ok:true,json:async()=>({success:true,data})});
let rows:any[],host:HTMLDivElement,root:Root;
beforeEach(()=>{
  rows=[{...occurrence}]; props.onBack.mockReset();
  (useAuth as jest.Mock).mockReturnValue({user:{_id:'admin',role:'school_admin',schoolId:'s'},token:'synthetic-token'});
  (fetch as jest.Mock).mockReset().mockImplementation((url:string,o:any)=>{
    if(o.method!=='GET')return Promise.resolve(reply(occurrence));
    return Promise.resolve(reply(url.includes('/planned-sessions/')?planned:url.includes('/classes/options')?[{_id:'c',schoolId:'s',name:'Assigned class'}]:rows));
  });
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const step=async(fn:()=>void)=>{await act(async()=>{fn();});};
const render=(changes:object={})=>step(()=>root.render(<DeliveredSessionManagement {...props} {...changes}/>));
const button=(name:string)=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent===name)!;
const click=(name:string)=>step(()=>Simulate.click(button(name)));
function field(name:string){const label=Array.from(document.querySelectorAll('label')).find(l=>l.textContent?.startsWith(name))!;return document.getElementById(label.htmlFor)!;}
const change=(name:string,value:string)=>step(()=>Simulate.change(field(name),{target:{value}} as any));
const writes=()=> (fetch as jest.Mock).mock.calls.filter(([,o])=>o.method!=='GET');
test('context, list, dates, class, creator and back navigation',async()=>{
  await render();expect(document.body).toHaveTextContent('Program → Level → Roadmap — Version 2 → Practice → Delivered Sessions');expect(document.body).toHaveTextContent('Assigned class');expect(document.body).toHaveTextContent('Delivered By: You');expect(document.body).toHaveTextContent('scheduled');expect(document.body).toHaveTextContent('09:00:00 UTC');await click('Back to Planned Sessions');expect(props.onBack).toHaveBeenCalled();
});
test('creation validates required fields, uses class options and refreshes',async()=>{
  await render();await click('Add Delivered Session');expect(button('Save Delivered Session')).toBeDisabled();
  await step(()=>Simulate.mouseDown(field('Class'),{button:0}));await step(()=>Simulate.click(document.querySelector('[role="option"]')!));
  expect(button('Save Delivered Session')).toBeDisabled();await change('Scheduled At','2026-09-19T09:00');await change('Delivery Notes','Practice notes');await click('Save Delivered Session');
  expect(JSON.parse(writes()[0][1].body)).toEqual({schoolId:'s',plannedSessionId:'ps',classId:'c',scheduledAt:'2026-09-19T09:00:00.000Z',deliveryNotes:'Practice notes',methodologyAdjustments:''});
  expect(document.body).toHaveTextContent('Delivered Session saved.');expect((fetch as jest.Mock).mock.calls.filter(([u])=>u.includes('/classes/options')).length).toBe(2);
});
test('edit preserves historical context and class',async()=>{
  await render();await click('Edit Occurrence');await change('Methodology Adjustments','Extra demonstration');await click('Save Delivered Session');expect(writes()[0][1].method).toBe('PUT');expect(JSON.parse(writes()[0][1].body)).not.toHaveProperty('plannedSessionSnapshot');expect(JSON.parse(writes()[0][1].body)).not.toHaveProperty('classId');
});
test.each([['scheduled','Start Session','in_progress'],['scheduled','Cancel Session','cancelled'],['in_progress','Complete Session','completed']])('%s confirms %s',async(status,label,next)=>{
  rows=[{...occurrence,status}];await render();await click(label);expect(writes()).toHaveLength(0);await click('Confirm status change');expect(writes()[0][1].method).toBe('PATCH');expect(JSON.parse(writes()[0][1].body).status).toBe(next);
});
test.each(['completed','cancelled'])('%s is read-only and snapshot remains historical',async status=>{
  rows=[{...occurrence,status}];await render();expect(button('Edit Occurrence')).toBeUndefined();expect(button('Start Session')).toBeUndefined();await click('View planned snapshot');expect(document.body).toHaveTextContent('Original method');expect(document.body).toHaveTextContent('Historical snapshot — read-only.');expect(writes()).toHaveLength(0);
});
test('super admin uses explicit school',async()=>{
  (useAuth as jest.Mock).mockReturnValue({user:{_id:'sa',role:'super_admin'},token:'t'});await render();expect((fetch as jest.Mock).mock.calls.every(([u])=>u.includes('schoolId=s'))).toBe(true);
});
test('teacher uses filtered selector and cannot manage another creator',async()=>{
  (useAuth as jest.Mock).mockReturnValue({user:{_id:'teacher',role:'teacher',schoolId:'s'},token:'t'});await render();expect(button('Add Delivered Session')).toBeEnabled();expect(button('Edit Occurrence')).toBeUndefined();expect((fetch as jest.Mock).mock.calls.some(([u])=>u.includes('/classes/options'))).toBe(true);
});
test('teacher can manage own occurrence',async()=>{
  (useAuth as jest.Mock).mockReturnValue({user:{_id:'teacher',role:'teacher',schoolId:'s'},token:'t'});rows=[{...occurrence,deliveredBy:'teacher'}];await render();expect(button('Edit Occurrence')).toBeEnabled();
});
test.each(['parent','student'])('%s cannot access',async role=>{
  (useAuth as jest.Mock).mockReturnValue({user:{role,schoolId:'s'},token:'t'});await render();expect(fetch).not.toHaveBeenCalled();
});
test('missing school prevents loading',async()=>{await render({schoolId:''});expect(fetch).not.toHaveBeenCalled();});
test('foreign context prevents loading',async()=>{await render({plannedSession:{...planned,schoolId:'foreign'}});expect(fetch).not.toHaveBeenCalled();});
test('safe load authorization failure',async()=>{(fetch as jest.Mock).mockResolvedValue({ok:false,status:403});await render();expect(document.body).toHaveTextContent('Unable to confirm');expect(button('Add Delivered Session')).toBeDisabled();});
test('uncertain write blocks retries and keeps input',async()=>{
  await render();await click('Edit Occurrence');await change('Delivery Notes','Keep input');(fetch as jest.Mock).mockRejectedValueOnce(new Error('PRIVATE'));await click('Save Delivered Session');expect(document.body).not.toHaveTextContent('PRIVATE');expect(field('Delivery Notes')).toHaveValue('Keep input');expect(button('Save Delivered Session')).toBeDisabled();
});
