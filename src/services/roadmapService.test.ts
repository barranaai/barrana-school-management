import { Roadmap, roadmapService, roadmapConflict } from './roadmapService';
const row: Roadmap = {_id:'r',schoolId:'s',programId:'p',levelId:'l',name:'Plan',status:'draft',version:1};
const api = roadmapService('synthetic-token','s','p','l');
beforeEach(() => { (fetch as jest.Mock).mockReset().mockResolvedValue({ok:true,json:async()=>({success:true,data:row})}); });
test('legacy missing revision is explicitly null', async () => { await api.activate(row,undefined,'2026-09-19T09:00:00Z'); expect(JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)).toMatchObject({__v:null,expectedPredecessor:null}); });
test('rejects cross-school predecessor without a request', () => { expect(()=>api.activate(row,{...row,schoolId:'other',status:'active'},'2026-09-19T09:00:00Z')).toThrow(); expect(fetch).not.toHaveBeenCalled(); });
test('wrong Program or Level in returned rows fails closed', async () => { (fetch as jest.Mock).mockResolvedValue({ok:true,json:async()=>({success:true,data:[{...row,levelId:'other'}]})}); await expect(api.list()).rejects.toThrow(); });
test('cannot edit an active Roadmap', () => { expect(()=>api.edit({...row,status:'active'},{name:'Changed',description:'',methodology:''})).toThrow(); expect(fetch).not.toHaveBeenCalled(); });
test('409 maps to safe conflict without raw response messages', async () => { (fetch as jest.Mock).mockResolvedValue({ok:false,status:409}); await expect(api.deactivate({...row,status:'active'},'2026-09-19T09:00:00Z')).rejects.toThrow(roadmapConflict); });
