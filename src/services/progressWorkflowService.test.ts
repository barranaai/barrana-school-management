import { workflowService, WorkflowError, workflowError, conflictMessage } from './progressWorkflowService';
const api = workflowService('token','school');
const reply = (data: any, extra: any = {}) => ({ok:true,status:200,json:async()=>({success:true,data,...extra})});
test('Progress writes use POST for creation and PUT for update with scoped auth',async()=>{
 (fetch as jest.Mock).mockResolvedValue(reply({_id:'progress'}));await api.saveProgress(undefined,{childParticipationId:'p',overallStatus:'in_progress'});await api.saveProgress('progress',{observations:'note'});
 expect(fetch).toHaveBeenNthCalledWith(1,expect.stringContaining('/progress?schoolId=school'),expect.objectContaining({method:'POST',headers:expect.objectContaining({Authorization:'Bearer token'})}));expect(fetch).toHaveBeenNthCalledWith(2,expect.stringContaining('/progress/progress?schoolId=school'),expect.objectContaining({method:'PUT'}));
});
test.each(['super_admin', 'teacher', 'school_admin'])('%s Progress creation preserves selected scope in body and query', async role => {
 const schoolId = '000000000000000000000001';
 const scoped = workflowService(role + '-token', schoolId);
 (fetch as jest.Mock).mockResolvedValue(reply({_id:'progress'}));
 await scoped.saveProgress(undefined, {childParticipationId:'p', schoolId:'stale-school', observations:'note'});
 const [url, options] = (fetch as jest.Mock).mock.calls[0];
 expect(new URL(url, 'http://test').searchParams.get('schoolId')).toBe(schoolId);
 expect(options.method).toBe('POST');
 expect(options.headers.Authorization).toBe('Bearer ' + role + '-token');
 expect(JSON.parse(options.body)).toEqual({childParticipationId:'p', schoolId, observations:'note'});
});

test.each(['', 'invalid-school'])('invalid selected scope %p is not inferred and backend rejection is surfaced', async schoolId => {
 (fetch as jest.Mock).mockResolvedValue({ok:false,status:400,json:async()=>({success:false,message:'Valid schoolId and childParticipationId are required'})});
 await expect(workflowService('super-admin-token', schoolId).saveProgress(undefined, {childParticipationId:'p', schoolId:'fallback-school'})).rejects.toMatchObject({status:400,message:'Valid schoolId and childParticipationId are required'});
 expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body).schoolId).toBe(schoolId);
});

test('Progress editing keeps its existing body unchanged', async () => {
 (fetch as jest.Mock).mockResolvedValue(reply({_id:'progress'}));
 await api.saveProgress('progress', {observations:'note'});
 expect((fetch as jest.Mock).mock.calls[0][1]).toMatchObject({method:'PUT',body:JSON.stringify({observations:'note'})});
});

test('draft generation and approval use separate existing endpoints',async()=>{
 (fetch as jest.Mock).mockResolvedValue(reply({_id:'report'}));await api.draft('progress','template');expect(fetch).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/reports/from-progress/progress'),expect.objectContaining({method:'POST',body:JSON.stringify({schoolId:'school',templateId:'template'})}));await api.approve('report');expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/reports/report/approve'),expect.objectContaining({method:'PATCH',body:'{}'}));
});
test('revision conflict code is preserved and mapped to the required message',async()=>{
 (fetch as jest.Mock).mockResolvedValue({ok:false,status:409,json:async()=>({success:false,message:'stale',code:'REPORT_REVISION_CONFLICT'})});
 await expect(api.edit('report',{content:'local edit'})).rejects.toMatchObject({status:409,code:'REPORT_REVISION_CONFLICT'});expect(workflowError(new WorkflowError('stale',409,'REPORT_REVISION_CONFLICT'))).toBe(conflictMessage);
});
test('report lookup reads subsequent pages rather than creating a replacement',async()=>{
 (fetch as jest.Mock).mockResolvedValueOnce(reply([{_id:'other',progressId:'other'}],{pages:2})).mockResolvedValueOnce(reply([{_id:'report',progressId:'progress'}],{pages:2}));expect(await api.findReport('child','progress')).toMatchObject({_id:'report'});expect(fetch).toHaveBeenCalledTimes(2);expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2'),expect.objectContaining({method:'GET'}));
});

test.each(['valid', 'missing', 'wrong'])('session context checks objective identity (%s) before retrieving children',async mode=>{
 const session={_id:'s',schoolId:'school',classId:'c',programId:'program',levelId:'level',plannedSessionId:'plan',roadmapId:'roadmap',roadmapVersion:1,plannedSessionSnapshot:{objectives:[{objectiveId:'o',title:'Float',requirementId:'r',parameterId:'parameter'}]}};
 const payloads:Record<string,any>={
 '/api/delivered-sessions/s':session,
 '/api/child-participations':[{_id:'p',schoolId:'school',deliveredSessionId:'s',childId:'child'},{_id:'other',schoolId:'school',deliveredSessionId:'other-session',childId:'other-child'}],
 '/api/config/programs/program':{name:'Swimming'},'/api/config/levels/level':{name:'Beginner'},
 '/api/planned-sessions/plan':{roadmapId:'roadmap',roadmapVersion:1,objectives:[{_id:'o'}]},
 '/api/config/requirements':[{_id:'r',programId:'program'}],'/api/config/parameters':[{_id:'parameter',programId:'program'},{_id:'unplanned',programId:'program'}],
 '/api/report-templates':[{_id:'template',schoolId:'school',isActive:true}],'/api/users/child':{_id:'child',schoolId:'school'}
 };
 (fetch as jest.Mock).mockImplementation(async(url:string)=>{const parsed=new URL(url,'http://test');expect(parsed.searchParams.get('schoolId')).toBe('school');if(!payloads[parsed.pathname])throw Error('Unexpected API '+parsed.pathname);return reply(payloads[parsed.pathname]);});
 if (mode === 'missing') delete (session.plannedSessionSnapshot.objectives[0] as any).objectiveId;
 if (mode === 'wrong') session.plannedSessionSnapshot.objectives[0].objectiveId = 'wrong';
 const outcome = await api.session('s').then(context => ({status:200,context})).catch((error: WorkflowError) => ({status:error.status,context:undefined}));
 expect(outcome.status).toBe(mode === 'valid' ? 200 : 409);
 expect(outcome.context?.children.map(p=>p._id)).toEqual(mode === 'valid' ? ['p'] : undefined);
 expect(outcome.context?.users.length).toBe(mode === 'valid' ? 1 : undefined);
 expect(outcome.context?.parameters.length).toBe(mode === 'valid' ? 1 : undefined);
 expect(outcome.context?.parameters.map(p=>p._id)).toEqual(mode === 'valid' ? ['parameter'] : undefined);
 expect((fetch as jest.Mock).mock.calls.some(([url])=>url.includes('/users/'))).toBe(mode === 'valid');
 expect((fetch as jest.Mock).mock.calls.some(([url])=>url.includes('other-child'))).toBe(false);
});
