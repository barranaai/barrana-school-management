const test=require('node:test');
const assert=require('node:assert/strict');
const {compatibleTemplates,compatibility}=require('../services/reportTemplateContext');
const ReportTemplate=require('../models/ReportTemplate');
const school='000000000000000000000001',program='000000000000000000000002',level='000000000000000000000003';
const template=(extra={})=>({_id:extra._id||'000000000000000000000010',schoolId:school,name:'Template',reportFrequency:'Monthly',isActive:true,...extra});
test('model keeps legacy grade templates and permits neutral Program templates without grade',()=>{
 assert.equal(new ReportTemplate({name:'Legacy',schoolId:school,grade:'Grade 1',reportFrequency:'Monthly',createdBy:school}).validateSync(),undefined);
 assert.equal(new ReportTemplate({name:'Swimming',schoolId:school,programId:program,levelId:level,reportFrequency:'Monthly',createdBy:school}).validateSync(),undefined);
});
test('exact Level outranks Program-wide and legacy grade fallback',()=>{const rows=[template({_id:'000000000000000000000011',programId:program}),template({_id:'000000000000000000000012',programId:program,levelId:level}),template({_id:'000000000000000000000013',grade:'Grade 1'})];const result=compatibleTemplates(rows,{schoolId:school,programId:program,levelId:level,grade:'Grade 1',allowLegacyGrade:true});assert.deepEqual(result.map(x=>String(x._id)),['000000000000000000000012']);});
test('Program-wide fallback is used and unrelated Program or Level cannot match',()=>{const expected=template({programId:program});const rows=[template({_id:'000000000000000000000011',programId:'000000000000000000000099'}),template({_id:'000000000000000000000012',programId:program,levelId:'000000000000000000000098'}),expected];assert.deepEqual(compatibleTemplates(rows,{schoolId:school,programId:program,levelId:level,allowLegacyGrade:false}),[expected]);});
test('legacy Grade fallback is academic-only and equal matches are deterministic',()=>{const b=template({_id:'000000000000000000000012',name:'B',grade:'Grade 1'}),a=template({_id:'000000000000000000000011',name:'A',grade:'grade1'});const context={schoolId:school,programId:program,levelId:level,grade:'Grade 1',allowLegacyGrade:true};assert.deepEqual(compatibleTemplates([b,a],context).map(x=>x.name),['A','B']);assert.equal(compatibility(a,{...context,allowLegacyGrade:false}),0);});
test('inactive and cross-tenant templates never match',()=>{assert.equal(compatibility(template({isActive:false}),{schoolId:school,programId:program,levelId:level}),0);assert.equal(compatibility(template({schoolId:'000000000000000000000099',programId:program}),{schoolId:school,programId:program,levelId:level}),0);});
