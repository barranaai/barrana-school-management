const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Relationship = require('../models/GuardianParticipantRelationship');
const User = require('../models/User');
const access = require('../services/guardianAccessService');

const id = n => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));
const schoolA=id(1),schoolB=id(2),guardianA={_id:id(3),schoolId:schoolA,role:'parent',isActive:true,email:'guardian@test.local'},guardianB={_id:id(4),schoolId:schoolA,role:'parent',isActive:true,email:'other@test.local'};
const child = (n=5, extra={}) => ({_id:id(n),schoolId:schoolA,role:'student',isActive:true,parentId:guardianA._id,parentEmail:guardianA.email,...extra});
const row=(guardianId=guardianA._id,participantId=id(5),extra={})=>({guardianId,participantId,schoolId:schoolA,status:'active',permissions:{canViewProfile:true,canViewReports:true,canReceiveCommunications:true,canManageMeetings:true,canViewIncidents:true},...extra});

async function withFind(rows,fn){const original=Relationship.find;Relationship.find=async()=>rows;try{return await fn();}finally{Relationship.find=original;}}

test('model requires tenant, guardian, participant, relationship type and audit users',()=>{
 const errors=new Relationship({}).validateSync().errors;
 for(const key of ['schoolId','guardianId','participantId','relationshipType','createdBy','updatedBy'])assert.ok(errors[key]);
});
test('model accepts the four supported relationship types and three states',()=>{
 for(const relationshipType of ['parent','legal_guardian','caregiver','other'])for(const status of ['pending','active','revoked'])assert.equal(new Relationship({schoolId:schoolA,guardianId:id(3),participantId:id(5),relationshipType,status,createdBy:id(8),updatedBy:id(8)}).validateSync(),undefined);
});
test('schema defines one tenant guardian participant identity and one active primary',()=>{
 const indexes=Relationship.schema.indexes();
 assert.ok(indexes.some(([keys,opts])=>keys.schoolId===1&&keys.guardianId===1&&keys.participantId===1&&opts.unique));
 assert.ok(indexes.some(([keys,opts])=>keys.participantId===1&&keys.isPrimaryContact===1&&opts.partialFilterExpression?.status==='active'));
});
test('one guardian can access multiple children',async()=>withFind([row(guardianA._id,id(5))],async()=>assert.equal((await access.relationshipState(guardianA,child(5))).allowed,true)));
test('multiple guardians can access one child',async()=>withFind([row(),row(guardianB._id,id(5))],async()=>assert.equal((await access.relationshipState(guardianB,child())).allowed,true)));
test('pending relationship blocks access',async()=>withFind([row(guardianA._id,id(5),{status:'pending'})],async()=>assert.equal((await access.relationshipState(guardianA,child())).allowed,false)));
test('revoked relationship blocks access and never falls back to matching legacy email',async()=>withFind([row(guardianA._id,id(5),{status:'revoked'})],async()=>{const result=await access.relationshipState(guardianA,child());assert.equal(result.allowed,false);assert.equal(result.legacy,false);}));
test('unrelated guardian is blocked once participant has any relationship',async()=>withFind([row(guardianB._id,id(5))],async()=>assert.equal((await access.relationshipState(guardianA,child())).allowed,false)));
test('primary contact does not bypass report permission',async()=>withFind([row(guardianA._id,id(5),{isPrimaryContact:true,permissions:{canViewProfile:true,canViewReports:false}})],async()=>assert.equal((await access.relationshipState(guardianA,child(),'reports')).allowed,false)));
test('fixed permissions are enforced independently',async()=>withFind([row(guardianA._id,id(5),{permissions:{canViewProfile:true,canViewReports:false,canReceiveCommunications:false,canManageMeetings:false,canViewIncidents:false}})],async()=>{for(const p of ['reports','communication','meetings','incidents'])assert.equal((await access.relationshipState(guardianA,child(),p)).allowed,false);assert.equal((await access.relationshipState(guardianA,child(),'profile')).allowed,true);}));
test('cross tenant guardian is blocked',async()=>withFind([],async()=>assert.equal((await access.relationshipState({...guardianA,schoolId:schoolB},child())).allowed,false)));
test('inactive guardian is blocked while relationship remains intact',async()=>withFind([row()],async()=>assert.equal((await access.relationshipState({...guardianA,isActive:false},child())).allowed,false)));
test('guardian email changes do not break ID based relationship',async()=>withFind([row()],async()=>assert.equal((await access.relationshipState({...guardianA,email:'changed@test.local'},child())).allowed,true)));
test('legacy parentId remains compatible when no relationship exists',async()=>withFind([],async()=>{const result=await access.relationshipState(guardianA,child());assert.equal(result.allowed,true);assert.equal(result.legacy,true);}));
test('legacy normalized parentEmail remains compatible when no relationship exists',async()=>withFind([],async()=>assert.equal((await access.relationshipState({...guardianA,_id:id(99),email:'GUARDIAN@test.local'},child())).allowed,true)));
test('participant without a legacy link is blocked',async()=>withFind([],async()=>assert.equal((await access.relationshipState(guardianB,child())).allowed,false)));
test('participant role and tenant are verified',async()=>withFind([row()],async()=>{assert.equal((await access.relationshipState(guardianA,{...child(),role:'teacher'})).allowed,false);assert.equal((await access.relationshipState(guardianA,{...child(),schoolId:schoolB})).allowed,false);}));
test('inactive participant is blocked for operations but may be authorized for historical reads',async()=>{
 const original=User.findOne;User.findOne=async()=>child(5,{isActive:false});
 try{await withFind([row()],async()=>{assert.equal((await access.authorizeGuardianParticipant(guardianA,id(5))).allowed,false);assert.equal((await access.authorizeGuardianParticipant(guardianA,id(5),'reports',{allowInactiveParticipant:true})).allowed,true);});}finally{User.findOne=original;}
});
test('safe lookup constrains participant by guardian tenant and role',async()=>{
 const original=User.findOne;let query;User.findOne=async q=>{query=q;return child();};
 try{await withFind([row()],()=>access.authorizeGuardianParticipant(guardianA,id(5)));assert.equal(String(query.schoolId),String(schoolA));assert.equal(query.role,'student');}finally{User.findOne=original;}
});
test('incident delivery requires incident and communication permissions together',async()=>{
 const originalFindOne=User.findOne,originalFind=User.find,originalRelationshipFind=Relationship.find;
 const allowed=row(guardianA._id,id(5));
 const incidentOnly=row(guardianB._id,id(5),{permissions:{canViewProfile:true,canViewReports:true,canReceiveCommunications:false,canManageMeetings:true,canViewIncidents:true}});
 User.findOne=async()=>child();User.find=async query=>query._id.$in.map(value=>String(value)===String(guardianA._id)?guardianA:guardianB);
 Relationship.find=async()=>[allowed,incidentOnly];
 try{const result=await access.eligibleGuardiansForAll(id(5),['incidents','communication']);assert.deepEqual(result.map(x=>String(x._id)),[String(guardianA._id)]);}
 finally{User.findOne=originalFindOne;User.find=originalFind;Relationship.find=originalRelationshipFind;}
});
