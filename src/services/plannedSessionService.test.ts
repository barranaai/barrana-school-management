import { plannedSessionService, PlannedSession, plannedSessionFailure } from './plannedSessionService';
const context = {_id:'roadmap',schoolId:'school',programId:'program',levelId:'level',version:1,name:'Roadmap',status:'active' as const};
const session: PlannedSession = {_id:'session',schoolId:'school',roadmapId:'roadmap',roadmapVersion:1,sequence:1,title:'Session',status:'draft',objectives:[],expectedOutcomes:[]};
const api=plannedSessionService('synthetic-token',context);
beforeEach(()=>{(fetch as jest.Mock).mockReset().mockResolvedValue({ok:true,json:async()=>({success:true,data:session})});});
test('rejects mismatched session Roadmap without a request',()=>{expect(()=>api.activate({...session,roadmapId:'other'})).toThrow();expect(fetch).not.toHaveBeenCalled();});
test('rejects active session edit without a request',()=>{expect(()=>api.save({...session,status:'active'},{title:'Change',sequence:1,description:'',expectedOutcomes:[],methodology:'',objectives:[]})).toThrow();expect(fetch).not.toHaveBeenCalled();});
test('API errors are safe',async()=>{(fetch as jest.Mock).mockResolvedValue({ok:false,status:409});await expect(api.activate(session)).rejects.toThrow(plannedSessionFailure);});
test('rejects unrelated parameter returned for a Requirement',async()=>{
  (fetch as jest.Mock).mockImplementation((url:string)=>Promise.resolve({ok:true,json:async()=>({success:true,data:url.includes('/sessions?')?[]:url.includes('/requirements?')?[{_id:'r',schoolId:'school',programId:'program',levelId:'level',isActive:true}]:url.includes('/parameters?')?[{_id:'p',schoolId:'school',programId:'program',requirementId:'other',isActive:true}]:context})}));
  await expect(api.load()).rejects.toThrow(plannedSessionFailure);
});
