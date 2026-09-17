import { requirementParameterService } from './requirementParameterService';
beforeEach(() => { (fetch as jest.Mock).mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) }); });
test.each(['requirements','parameters'] as const)('%s refuses missing parent scope', kind => {
  expect(() => requirementParameterService('synthetic-token','school','program',kind,'').list()).toThrow(); expect(fetch).not.toHaveBeenCalled();
});
test('Parameter write carries immutable context and omits unsupported description/level fields', async () => {
  await requirementParameterService('synthetic-token','school','program','parameters','requirement').save(undefined,{ name:'Measure',description:'not supported',sequence:1,isRequired:true,type:'text' });
  const [url, options] = (fetch as jest.Mock).mock.calls[0];
  expect(url).toContain('requirementId=requirement'); expect(options.headers.Authorization).toBe('Bearer synthetic-token');
  expect(JSON.parse(options.body)).toEqual({ name:'Measure',sequence:1,isRequired:true,schoolId:'school',programId:'program',requirementId:'requirement',type:'text',options:[] });
});
