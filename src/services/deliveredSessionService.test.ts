import { deliveredSessionService, deliveredSessionFailure, DeliveredSession } from './deliveredSessionService';
const context = { _id:'r', schoolId:'s', programId:'p', levelId:'l', version:1, name:'Roadmap', status:'active' as const };
const planned = { _id:'ps', schoolId:'s', roadmapId:'r', roadmapVersion:1 };
const row = { _id:'d', schoolId:'s', programId:'p', levelId:'l', roadmapId:'r', roadmapVersion:1, plannedSessionId:'ps', status:'scheduled' } as DeliveredSession;
const input = { scheduledAt:'2026-09-19T09:00:00.000Z', deliveryNotes:'', methodologyAdjustments:'' };
const reply = (data:unknown) => ({ ok:true, json:async()=>({success:true,data}) });
const api = deliveredSessionService('synthetic-token',context,'ps');
beforeEach(()=>{(fetch as jest.Mock).mockReset().mockImplementation((url:string)=>Promise.resolve(reply(url.includes('/planned-sessions/')?planned:[])));});
test('loads scoped occurrences and read-only class options, never legacy classes',async()=>{
  await api.load(); const urls=(fetch as jest.Mock).mock.calls.map(([u])=>u);
  expect(urls).toContain('/api/classes/options?schoolId=s');
  expect(urls).toContain('/api/delivered-sessions?plannedSessionId=ps&schoolId=s');
  expect(urls.every(u=>u.includes('schoolId=s'))).toBe(true);
  expect(urls.some(u=>/\/classes\?/.test(u))).toBe(false);
});
test('create sends only permitted fields and authoritative school/planned identity',async()=>{
  await api.create('c',{...input, plannedSessionSnapshot:{}, deliveredBy:'other', title:'override', status:'completed'} as any);
  const [url, options]=(fetch as jest.Mock).mock.calls[0];
  expect(url).toBe('/api/delivered-sessions?schoolId=s'); expect(options.method).toBe('POST');
  expect(JSON.parse(options.body)).toEqual({...input,schoolId:'s',plannedSessionId:'ps',classId:'c'});
});
test('edit cannot send snapshot, class or creator changes',async()=>{
  await api.edit(row,{...input,classId:'other',plannedSessionSnapshot:{}} as any);
  expect((fetch as jest.Mock).mock.calls[0][1].method).toBe('PUT');
  expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)).toEqual({...input,schoolId:'s'});
});
test.each(['completed','cancelled'] as const)('%s cannot edit or transition',status=>{
  expect(()=>api.edit({...row,status},input)).toThrow(); expect(()=>api.transition({...row,status},'in_progress')).toThrow(); expect(fetch).not.toHaveBeenCalled();
});
test.each([['scheduled','in_progress'],['scheduled','cancelled'],['in_progress','completed'],['in_progress','cancelled']] as const)('transition %s to %s uses status endpoint',async(from,to)=>{
  await api.transition({...row,status:from},to);const [url,o]=(fetch as jest.Mock).mock.calls[0];expect(url).toBe('/api/delivered-sessions/d/status?schoolId=s');expect(o.method).toBe('PATCH');expect(JSON.parse(o.body)).toEqual({schoolId:'s',status:to});
});
test('rejects skipped lifecycle and mismatched tenant',()=>{
  expect(()=>api.transition(row,'completed')).toThrow();expect(()=>api.edit({...row,schoolId:'foreign'},input)).toThrow();expect(fetch).not.toHaveBeenCalled();
});
test('missing context prevents requests',async()=>{
  await expect(deliveredSessionService('token',{...context,schoolId:''},'ps').load()).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
});
test('mismatched planned identity fails closed',async()=>{
  (fetch as jest.Mock).mockResolvedValue(reply({...planned,roadmapVersion:2}));await expect(api.load()).rejects.toThrow(deliveredSessionFailure);expect(fetch).toHaveBeenCalledTimes(1);
});
test('foreign class options fail closed',async()=>{
  (fetch as jest.Mock).mockImplementation((url:string)=>Promise.resolve(reply(url.includes('/planned-sessions/')?planned:url.includes('/classes/options')?[{schoolId:'foreign'}]:[])));
  await expect(api.load()).rejects.toThrow(deliveredSessionFailure);
});
test.each([400,401,403,409,500])('HTTP %s produces safe error',async status=>{
  (fetch as jest.Mock).mockResolvedValue({ok:false,status,json:async()=>({message:'PRIVATE'})});await expect(api.load()).rejects.toThrow(deliveredSessionFailure);
});
