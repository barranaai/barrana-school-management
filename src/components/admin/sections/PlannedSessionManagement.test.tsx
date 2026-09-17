import React from 'react';
import { act, Simulate } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import PlannedSessionManagement from './PlannedSessionManagement';
import { useAuth } from '../../../contexts/AuthContext';
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./DeliveredSessionManagement', () => ({ __esModule: true, default: (props: any) => <div>Occurrences for {props.plannedSession.title}<button onClick={props.onBack}>Back to Planned Sessions</button></div> }));
const roadmap = { _id:'roadmap',schoolId:'school',programId:'program',levelId:'level',name:'Customer Roadmap',version:2,status:'active' as const };
const session = { _id:'session',schoolId:'school',roadmapId:'roadmap',roadmapVersion:2,sequence:2,title:'Practice',status:'draft',expectedOutcomes:['Confidence'],methodology:'Guided practice',objectives:[{_id:'objective',sequence:1,title:'Observe',requirementId:'r1',parameterId:'p1'}] };
const reqs = ['r1','r2'].map((id,i) => ({_id:id,schoolId:'school',programId:'program',levelId:'level',name:'Requirement '+(i+1),isActive:true}));
const params = ['p1','p2'].map((id,i) => ({_id:id,schoolId:'school',programId:'program',requirementId:'r'+(i+1),name:'Parameter '+(i+1),isActive:true}));
const reply = (data: unknown) => ({ok:true,json:async()=>({success:true,data})});
let currentRoadmap:any, sessions:any[], root:Root,host:HTMLDivElement;
beforeEach(() => {
  currentRoadmap={...roadmap};sessions=[session];
  (useAuth as jest.Mock).mockReturnValue({user:{_id:'admin',role:'school_admin',schoolId:'school'},token:'synthetic-token'});
  (fetch as jest.Mock).mockReset().mockImplementation((url:string,options:any) => {
    if(options.method!=='GET')return Promise.resolve(reply(session));
    if(url.includes('/sessions?'))return Promise.resolve(reply(sessions));
    if(url.includes('/config/requirements'))return Promise.resolve(reply(reqs));
    if(url.includes('/config/parameters'))return Promise.resolve(reply(params.filter(p=>url.includes('requirementId='+p.requirementId))));
    return Promise.resolve(reply(currentRoadmap));
  });
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();});
const step=async(fn:()=>void)=>{await act(async()=>{fn();});};
const render=()=>step(()=>root.render(<PlannedSessionManagement schoolId="school" program={{_id:'program',schoolId:'school',name:'Program',displayOrder:0,isActive:true}} level={{_id:'level',schoolId:'school',programId:'program',name:'Level',sequence:1,isActive:true}} roadmap={roadmap}/>));
function button(name:string){return Array.from(document.querySelectorAll('button')).find(b=>b.textContent===name)!;}
function field(name:string){const label=Array.from(document.querySelectorAll('label')).find(l=>l.textContent?.startsWith(name))!;return document.getElementById(label.htmlFor)!;}
const change=(name:string,value:string)=>step(()=>Simulate.change(field(name),{target:{value}} as any));
async function choose(name:string,value:string){await step(()=>Simulate.mouseDown(field(name),{button:0}));await step(()=>Simulate.click(Array.from(document.querySelectorAll('[role="option"]')).find(e=>e.textContent===value)!));}
const writes=()=> (fetch as jest.Mock).mock.calls.filter(([,o])=>o.method!=='GET');

test('opens Delivered Sessions for the selected session and returns',async()=>{
  await render();await step(()=>Simulate.click(button('Delivered Sessions')));expect(document.body).toHaveTextContent('Occurrences for Practice');
  await step(()=>Simulate.click(button('Back to Planned Sessions')));expect(button('Add Planned Session')).toBeDefined();expect(writes()).toHaveLength(0);
});
test('lists sorted sessions, objectives, configuration labels and Roadmap context',async()=>{
  sessions=[session,{...session,_id:'first',sequence:1,title:'Preparation'}];await render();
  expect(document.body).toHaveTextContent('Customer Roadmap — Version 2');expect(document.body).toHaveTextContent('Requirement 1 · Parameter: Parameter 1');
  expect(document.body.textContent!.indexOf('Preparation')).toBeLessThan(document.body.textContent!.indexOf('2. Practice'));
});
test('Add requires title, creates via selected Roadmap and refreshes',async()=>{
  await render();await step(()=>Simulate.click(button('Add Planned Session')));expect(button('Save Planned Session')).toBeDisabled();
  await change('Title','New session');await change('Expected Outcomes','Outcome one\nOutcome two');await step(()=>Simulate.click(button('Save Planned Session')));
  const [url,o]=writes()[0];expect(url).toContain('/roadmaps/roadmap/sessions?schoolId=school');expect(o.method).toBe('POST');
  expect(JSON.parse(o.body)).toMatchObject({schoolId:'school',title:'New session',sequence:3,expectedOutcomes:['Outcome one','Outcome two'],objectives:[]});
  expect(JSON.parse(o.body)).not.toHaveProperty('status');expect(document.body).toHaveTextContent('Planned Session draft saved.');
});
test('draft editing fixes sequence and preserves existing objective identity',async()=>{
  await render();await step(()=>Simulate.click(button('Edit session / Objectives')));expect(field('Sequence')).toBeDisabled();
  await step(()=>Simulate.click(button('Edit Objective')));await change('Objective title','Revised objective');await step(()=>Simulate.click(button('Apply Objective')));await step(()=>Simulate.click(button('Save Planned Session')));
  expect(writes()[0][1].method).toBe('PUT');const body=JSON.parse(writes()[0][1].body);expect(body).not.toHaveProperty('sequence');expect(body.objectives[0]).toMatchObject({_id:'objective',title:'Revised objective'});
});
test('Add Objective validates title and filters Parameters by Requirement',async()=>{
  await render();await step(()=>Simulate.click(button('Add Planned Session')));await change('Title','Practice two');await step(()=>Simulate.click(button('Add Objective')));
  expect(button('Apply Objective')).toBeDisabled();expect(field('Parameter')).toHaveAttribute('aria-disabled','true');
  await change('Objective title','Measure');await choose('Requirement','Requirement 1');await choose('Parameter','Parameter 1');
  await choose('Requirement','Requirement 2');expect(field('Parameter')).toHaveTextContent('None');
  await step(()=>Simulate.mouseDown(field('Parameter'),{button:0}));expect(Array.from(document.querySelectorAll('[role="option"]')).map(x=>x.textContent)).not.toContain('Parameter 1');
  await step(()=>Simulate.click(Array.from(document.querySelectorAll('[role="option"]')).find(e=>e.textContent==='Parameter 2')!));
  await step(()=>Simulate.click(button('Apply Objective')));await step(()=>Simulate.click(button('Save Planned Session')));
  expect(JSON.parse(writes()[0][1].body).objectives[0]).toMatchObject({requirementId:'r2',parameterId:'p2',title:'Measure'});
});
test('draft Roadmap prohibits creation but permits reading',async()=>{currentRoadmap.status='draft';await render();expect(button('Add Planned Session')).toBeDisabled();expect(document.body).toHaveTextContent('Activate the Roadmap');});
test('archived Roadmap does not request unsupported session list',async()=>{currentRoadmap.status='archived';await render();expect(fetch).toHaveBeenCalledTimes(1);expect(button('Add Planned Session')).toBeDisabled();});
test('active session cannot edit; archive is confirmed',async()=>{sessions=[{...session,status:'active'}];await render();expect(button('Edit session / Objectives')).toBeUndefined();await step(()=>Simulate.click(button('Archive Session')));expect(writes()).toHaveLength(0);await step(()=>Simulate.click(button('Confirm session operation')));expect(writes()[0][1].method).toBe('DELETE');});
test('activation requires explicit confirmation',async()=>{await render();await step(()=>Simulate.click(button('Activate Session')));expect(writes()).toHaveLength(0);await step(()=>Simulate.click(button('Confirm session operation')));expect(writes()[0][0]).toContain('/planned-sessions/session/activate?');});
test('safe error preserves work and prevents automatic retry',async()=>{await render();await step(()=>Simulate.click(button('Add Planned Session')));await change('Title','Keep me');(fetch as jest.Mock).mockRejectedValueOnce(new Error('PRIVATE_DETAILS'));await step(()=>Simulate.click(button('Save Planned Session')));expect(document.body).toHaveTextContent('Unable to confirm');expect(document.body).not.toHaveTextContent('PRIVATE_DETAILS');expect(field('Title')).toHaveValue('Keep me');expect(button('Save Planned Session')).toBeDisabled();});
test.each(['teacher','parent'])('%s cannot load management',async role=>{(useAuth as jest.Mock).mockReturnValue({user:{role},token:'synthetic-token'});await render();expect(fetch).not.toHaveBeenCalled();});
test('Super Admin uses selected school for writes',async()=>{(useAuth as jest.Mock).mockReturnValue({user:{role:'super_admin'},token:'synthetic-token'});await render();await step(()=>Simulate.click(button('Add Planned Session')));await change('Title','Admin session');await step(()=>Simulate.click(button('Save Planned Session')));expect(JSON.parse(writes()[0][1].body).schoolId).toBe('school');});
test('Roadmap context mismatch fails closed',async()=>{currentRoadmap.levelId='unrelated';await render();expect(button('Add Planned Session')).toBeDisabled();expect(document.body).toHaveTextContent('Unable to confirm');});
test('objective display is ordered and duplicate objective sequence is blocked',async()=>{
  sessions=[{...session,objectives:[{_id:'later',sequence:2,title:'Later objective'},{_id:'earlier',sequence:1,title:'Earlier objective'}]}];await render();
  expect(document.body.textContent!.indexOf('Earlier objective')).toBeLessThan(document.body.textContent!.indexOf('Later objective'));
  await step(()=>Simulate.click(button('Edit session / Objectives')));await step(()=>Simulate.click(button('Add Objective')));await change('Objective title','Third');await change('Objective sequence','1');expect(button('Apply Objective')).toBeDisabled();
});
test('existing session sequence prevents duplicate create submission',async()=>{
  await render();await step(()=>Simulate.click(button('Add Planned Session')));await change('Title','Another');await change('Sequence','2');expect(button('Save Planned Session')).toBeDisabled();expect(writes()).toHaveLength(0);
});
