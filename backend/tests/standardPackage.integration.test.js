const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const request=require('supertest');const {integrationUri}=require('../config/integrationDatabase');const {openIntegrationHarness}=require('./helpers/integrationHarness');

test('standard package adoption is isolated, independent and atomic', {timeout:120000}, async()=>{
 const target=new URL(integrationUri());assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'27018');
 process.env.JWT_SECRET=randomUUID();process.env.ENABLE_SCHEDULERS='false';process.env.ENABLE_DEBUG_ROUTES='false';
 const h=await openIntegrationHarness();const schoolIds=[];const packageIds=[];const userIds=[];
 const auth=t=>({Authorization:'Bearer '+t});const call=(method,url,token,body)=>{const q=request(h.app)[method](url).set(auth(token));return body===undefined?q:q.send(body);};
 const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));assert.equal(r.body.success,true);return r.body.data;};
 const schoolData=(key,name)=>({name,slug:'standard-package-'+key,accountType:'organization',organizationType:'sports_club',terminologyProfile:'training',estimatedStudents:1,address:{street:'1 Test',city:'Test',state:'ON',zipCode:'A1A1A1',country:'Canada'},contactPerson:{name:'Admin',email:key+'@example.invalid'}});
 const definition={programs:[{key:'swim',name:'Swimming',description:'Learn to swim',levels:[{key:'water',name:'Water Confidence',sequence:1,requirements:[{key:'entry',name:'Safe Entry',sequence:1,parameters:[{key:'confidence',name:'Confidence',type:'rating',sequence:1}]}]}],roadmaps:[{key:'water-roadmap',levelKey:'water',name:'Water Confidence Roadmap',version:1,methodology:'Supported practice',plannedSessions:[{sequence:1,title:'Safe Entry',objectives:[{sequence:1,title:'Safe entry',requirementKey:'entry',parameterKey:'confidence',expectedOutcome:'Controlled entry'}]}]}]}]};
 try{
  await h.verify();
  const {School,User,StandardPackage,StandardPackageAdoption,Program,Level,Requirement,Parameter,Roadmap,PlannedSession}=h.models;
  await Promise.all([StandardPackage.createIndexes(),StandardPackageAdoption.createIndexes(),Roadmap.createIndexes()]);
  const key=randomUUID();const schoolA=await School.create(schoolData(key+'a','Organization A'));const schoolB=await School.create(schoolData(key+'b','Organization B'));const schoolC=await School.create(schoolData(key+'c','Organization C'));schoolIds.push(schoolA._id,schoolB._id,schoolC._id);
  const superAdmin=await User.create({firstName:'Platform',lastName:'Admin',email:'platform-'+key+'@example.invalid',password:randomUUID(),role:'super_admin',isEmailVerified:true});
  const adminA=await User.create({firstName:'Admin',lastName:'A',email:'a-'+key+'@example.invalid',password:randomUUID(),role:'school_admin',schoolId:schoolA._id,isEmailVerified:true});
  const adminB=await User.create({firstName:'Admin',lastName:'B',email:'b-'+key+'@example.invalid',password:randomUUID(),role:'school_admin',schoolId:schoolB._id,isEmailVerified:true});
  const adminC=await User.create({firstName:'Admin',lastName:'C',email:'c-'+key+'@example.invalid',password:randomUUID(),role:'school_admin',schoolId:schoolC._id,isEmailVerified:true});userIds.push(superAdmin._id,adminA._id,adminB._id,adminC._id);
  const superToken=superAdmin.generateAuthToken(),tokenA=adminA.generateAuthToken(),tokenB=adminB.generateAuthToken(),tokenC=adminC.generateAuthToken();
  const denied=await call('post','/api/standard-packages',tokenA,{slug:'forbidden',name:'Forbidden',version:1,definition});assert.equal(denied.status,403);
  const pkg=ok(await call('post','/api/standard-packages',superToken,{slug:'swimming-'+key,name:'Swimming Foundation',version:1,organizationTypes:['sports_club'],definition}),201);packageIds.push(pkg._id);
  ok(await call('patch','/api/standard-packages/'+pkg._id+'/publish',superToken));
  const deniedEdit=await call('put','/api/standard-packages/'+pkg._id,tokenA,{name:'Organization overwrite'});assert.equal(deniedEdit.status,403);
  const lockedEdit=await call('put','/api/standard-packages/'+pkg._id,superToken,{name:'Published overwrite'});assert.equal(lockedEdit.status,409);
  const adoptionA=ok(await call('post','/api/standard-packages/'+pkg._id+'/adopt',tokenA,{schoolId:schoolB._id}),201);assert.equal(adoptionA.packageVersion,1);assert.equal(String(adoptionA.schoolId),String(schoolA._id));assert.equal(await Program.countDocuments({schoolId:schoolB._id}),0);
  const programA=await Program.findOne({schoolId:schoolA._id});const levelA=await Level.findOne({schoolId:schoolA._id});const requirementA=await Requirement.findOne({schoolId:schoolA._id});const parameterA=await Parameter.findOne({schoolId:schoolA._id});const roadmapA=await Roadmap.findOne({schoolId:schoolA._id});const plannedA=await PlannedSession.findOne({schoolId:schoolA._id});
  assert.ok(programA&&levelA&&requirementA&&parameterA&&roadmapA&&plannedA);assert.equal(String(programA.metadata.standardPackage.packageId),String(pkg._id));assert.equal(programA.metadata.standardPackage.version,1);assert.equal(programA.metadata.standardPackage.sourceKey,'swim');assert.equal(String(levelA.programId),String(programA._id));assert.equal(String(requirementA.levelId),String(levelA._id));assert.equal(String(parameterA.requirementId),String(requirementA._id));assert.equal(String(roadmapA.levelId),String(levelA._id));assert.equal(String(plannedA.roadmapId),String(roadmapA._id));assert.equal(String(plannedA.objectives[0].requirementId),String(requirementA._id));assert.equal(String(plannedA.objectives[0].parameterId),String(parameterA._id));
  const crossRead=await call('get','/api/config/programs/'+programA._id,tokenB);assert.equal(crossRead.status,404);
  const cross=await call('put','/api/config/programs/'+programA._id,tokenB,{schoolId:schoolB._id,name:'Hijacked'});assert.equal(cross.status,404);
  const customized=ok(await call('put','/api/config/programs/'+programA._id,tokenA,{name:'Organization A Swimming'}));assert.equal(customized.name,'Organization A Swimming');
  const source=await StandardPackage.findById(pkg._id);assert.equal(source.definition.programs[0].name,'Swimming');
  ok(await call('post','/api/standard-packages/'+pkg._id+'/adopt',tokenB,{}),201);const programB=await Program.findOne({schoolId:schoolB._id});assert.notEqual(String(programB._id),String(programA._id));assert.equal(programB.name,'Swimming');
  const duplicate=await call('post','/api/standard-packages/'+pkg._id+'/adopt',tokenA,{});assert.equal(duplicate.status,409);assert.equal(await StandardPackageAdoption.countDocuments({schoolId:schoolA._id,packageId:pkg._id}),1);
  const broken=JSON.parse(JSON.stringify(definition));broken.programs[0].roadmaps.push({...broken.programs[0].roadmaps[0],key:'duplicate-version'});
  const badPkg=ok(await call('post','/api/standard-packages',superToken,{slug:'rollback-'+key,name:'Rollback Proof',version:1,definition:broken}),201);packageIds.push(badPkg._id);ok(await call('patch','/api/standard-packages/'+badPkg._id+'/publish',superToken));
  const failed=await call('post','/api/standard-packages/'+badPkg._id+'/adopt',tokenC,{});assert.notEqual(failed.status,201);assert.equal(await Program.countDocuments({schoolId:schoolC._id}),0);assert.equal(await StandardPackageAdoption.countDocuments({schoolId:schoolC._id}),0);
 }finally{
  const m=h.models;for(const name of ['PlannedSession','Roadmap','Parameter','Requirement','Level','Program','StandardPackageAdoption'])if(m[name])await m[name].deleteMany({$or:[{schoolId:{$in:schoolIds}},{packageId:{$in:packageIds}}]});if(m.StandardPackage)await m.StandardPackage.deleteMany({_id:{$in:packageIds}});if(m.User)await m.User.deleteMany({_id:{$in:userIds}});if(m.School)await m.School.deleteMany({_id:{$in:schoolIds}});await h.close();
 }
});
