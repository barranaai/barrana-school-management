const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { canCreateOperationalParticipation } = require('../utils/operationalParticipationAuthorization');
const id = n => String(n).padStart(24, '0');
function fixture() {
  const schoolId = id(1), teacherId = id(2), childId = id(3), enrollmentId = id(4), classId = id(5);
  return { childId, enrollmentId,
    teacher: { _id: teacherId, schoolId, role: 'teacher' }, child: { _id: childId, schoolId, role: 'student' },
    session: { _id: id(6), schoolId, classId, programId: id(7), levelId: id(8), deliveredBy: teacherId, status: 'scheduled', scheduledAt: new Date('2026-09-19') },
    cls: { _id: classId, schoolId, isActive: true, assignedTeachers: [{ teacherId }] },
    enrollment: { _id: enrollmentId, schoolId, childId, programId: id(7), currentLevelId: id(8), status: 'active', startDate: '2026-09-15', classAssignments: [{ classId, status: 'active', effectiveFrom: '2026-09-15' }] }
  };
}
function route(f) {
  const routes = [], writes = [];
  const router = { use() {} }; for (const method of ['get','post','put','delete']) router[method] = (url,...handlers) => routes.push({method,url,handlers});
  const participation = { _id:id(9), schoolId:id(1), deliveredSessionId:id(6), status:'active', async save(){writes.push('save');} };
  const models = { Class: { findOne:async()=>f.cls }, User:{findOne:async()=>f.child}, Enrollment:{findOne:async()=>f.enrollment}, DeliveredSession:{findOne:async()=>f.session}, ChildParticipation:{findOne:async()=>participation,create:async body=>{writes.push('create');return body;}} };
  const deps = { express:{Router:()=>router}, mongoose, '../middleware/auth':{protect(){},authorize:()=> (_req,_res,next)=>next()}, '../middleware/resourceAuthorization':{scopeSchoolId:user=>user.schoolId}, '../utils/operationalParticipationAuthorization':require('../utils/operationalParticipationAuthorization') };
  for(const [name,model] of Object.entries(models))deps['../models/'+name]=model;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../routes/childParticipations.js'),'utf8'),{module:{exports:{}},require:name=>{assert.ok(deps[name],name);return deps[name];}});
  return {writes,async call(method='post',url='/',body={schoolId:id(1),deliveredSessionId:id(6),childId:f.childId,enrollmentId:f.enrollmentId}) {
    const req={user:f.teacher,body,query:{},params:{id:id(9)}};const res={statusCode:200,status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}};
    for(const handler of routes.find(r=>r.method===method&&r.url===url).handlers){let next=false;await handler(req,res,()=>{next=true;});if(!next)break;}return res;
  }};
}
const cases = {
  'valid without legacy fields': [()=>{},true],
  'wrong teacher class': [f=>f.cls.assignedTeachers=[{teacherId:id(99)}],false],
  'foreign teacher': [f=>f.teacher.schoolId=id(99),false],
  'wrong child': [f=>f.enrollment.childId=id(99),false],
  'wrong enrollment': [f=>f.enrollment._id=id(99),false],
  'wrong program': [f=>f.enrollment.programId=id(99),false],
  'wrong class': [f=>f.enrollment.classAssignments[0].classId=id(99),false],
  'wrong level': [f=>f.enrollment.currentLevelId=id(99),false],
  'empty assignments': [f=>f.enrollment.classAssignments=[],false],
  'future assignment': [f=>f.enrollment.classAssignments[0].effectiveFrom='2026-09-20',false],
  'expired assignment': [f=>f.enrollment.classAssignments[0].effectiveTo='2026-09-18',false],
  'ended assignment status': [f=>f.enrollment.classAssignments[0].status='ended',false],
  'future enrollment': [f=>f.enrollment.startDate='2026-09-20',false],
  'expired enrollment': [f=>f.enrollment.endDate='2026-09-18',false],
  'removed teacher': [f=>f.cls.assignedTeachers=[],false],
  'multiple distinct assignments': [f=>f.enrollment.classAssignments.unshift({classId:id(99),status:'active',effectiveFrom:'2026-09-15'}),true],
  'overlapping matching assignments': [f=>f.enrollment.classAssignments.push({...f.enrollment.classAssignments[0]}),false],
  'not session owner': [f=>f.session.deliveredBy=id(99),false],
  'inactive class': [f=>f.cls.isActive=false,false],
  'foreign class': [f=>f.cls.schoolId=id(99),false],
  'invalid date': [f=>f.enrollment.startDate='invalid',false]
};
for(const status of ['paused','pending','completed','withdrawn','cancelled']) cases[status]=[f=>f.enrollment.status=status,false];
for(const [name,[change,allowed]] of Object.entries(cases))test(name+' (actual helper and POST route)',async()=>{const f=fixture();change(f);assert.equal(canCreateOperationalParticipation(f),allowed);const r=route(f);const response=await r.call();if(allowed){assert.equal(response.statusCode,201);assert.deepEqual(r.writes,['create']);}else{assert.ok([400,403].includes(response.statusCode));assert.deepEqual(r.writes,[]);}});
test('historical owner can read/update after membership and enrollment end',async()=>{const f=fixture();f.cls.assignedTeachers=[];f.enrollment.status='withdrawn';const r=route(f);assert.equal((await r.call('get','/:id')).statusCode,200);assert.equal((await r.call('put','/:id',{status:'absent'})).statusCode,200);assert.deepEqual(r.writes,['save']);});
test('historical nonowner remains denied',async()=>{const f=fixture();f.session.deliveredBy=id(99);const r=route(f);assert.equal((await r.call('get','/:id')).statusCode,404);assert.equal((await r.call('put','/:id',{status:'absent'})).statusCode,403);assert.deepEqual(r.writes,[]);});
test('legacy child helper retains direct teacher/class behavior without enrollment fallback',async()=>{
  const box={module:{exports:{}},require:name=>{assert.equal(name,'../models/Class');return {exists:async q=>q._id===id(5)&&q.schoolId===id(1)&&q['assignedTeachers.teacherId']===id(2)};}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../middleware/resourceAuthorization.js'),'utf8'),box);
  const {canAccessStudent}=box.module.exports;const f=fixture();
  assert.equal(await canAccessStudent(f.teacher,f.child),false);
  assert.equal(await canAccessStudent(f.teacher,{...f.child,assignedTeacher:id(2)}),true);
  assert.equal(await canAccessStudent(f.teacher,{...f.child,classId:id(5)}),true);
  assert.equal(await canAccessStudent({...f.teacher,schoolId:id(99)},{...f.child,assignedTeacher:id(2)}),false);
});
