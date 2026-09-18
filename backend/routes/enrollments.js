const express = require('express');
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { scopeSchoolId, canAccessStudent } = require('../middleware/resourceAuthorization');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Program = require('../models/Program');
const Level = require('../models/Level');
const Class = require('../models/Class');
const router = express.Router();
const management = ['school_admin','super_admin'];
const readRoles = [...management, 'teacher', 'parent'];
const oid = v => mongoose.Types.ObjectId.isValid(v);
const schoolFor = (req, value) => req.user.role === 'super_admin' ? value : String(req.user.schoolId || '');
const same = (a,b) => String(a) === String(b);
const terminalStatuses = new Set(['completed', 'withdrawn', 'cancelled']);
const validDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const assignmentFailure = (message, status = 400) => ({ message, status });

async function prepareClassAssignment(row, { classId, effectiveDate, reason, assignedBy, schoolId }) {
  if (terminalStatuses.has(row.status)) return assignmentFailure('Enrollment cannot be assigned to a class in its current status', 409);
  if (!oid(classId)) return assignmentFailure('A valid class is required');
  const cls = await Class.findOne({_id:classId, schoolId, isActive:true, status:'active'});
  if (!cls) return assignmentFailure('Class not found or unavailable in this school');

  const at = validDate(effectiveDate);
  if (!at) return assignmentFailure('Effective date must be a valid date');
  const enrollmentStart = validDate(row.startDate);
  if (!enrollmentStart || at < enrollmentStart) return assignmentFailure('Effective date cannot be before the enrollment start date');

  const assignments = row.classAssignments || [];
  const ranges = [];
  for (const assignment of assignments) {
    const from = validDate(assignment.effectiveFrom);
    const to = assignment.effectiveTo ? validDate(assignment.effectiveTo) : null;
    if (!from || (assignment.effectiveTo && !to) || (to && to <= from)) return assignmentFailure('Enrollment class assignment history is inconsistent', 409);
    if ((assignment.status === 'active' && to) || (assignment.status === 'ended' && !to)) return assignmentFailure('Enrollment class assignment history is inconsistent', 409);
    ranges.push({ from, to });
  }
  ranges.sort((left, right) => left.from - right.from);
  for (let index = 1; index < ranges.length; index += 1) {
    if (!ranges[index - 1].to || ranges[index - 1].to > ranges[index].from) return assignmentFailure('Enrollment class assignment history is inconsistent', 409);
  }

  const current = assignments.filter(assignment => assignment.status === 'active' && !assignment.effectiveTo);
  if (current.length > 1) return assignmentFailure('Enrollment class assignment history is inconsistent', 409);
  if ((row.currentClassId && (current.length !== 1 || !same(current[0].classId, row.currentClassId))) || (!row.currentClassId && current.length)) {
    return assignmentFailure('Enrollment class assignment history is inconsistent', 409);
  }
  if (row.currentClassId && same(row.currentClassId, classId)) return assignmentFailure('Class is already the current assignment', 409);
  if (current.length) {
    const currentStart = validDate(current[0].effectiveFrom);
    if (!currentStart || at <= currentStart) return assignmentFailure('Effective date must be after the current class assignment start date');
    current[0].effectiveTo = at;
    current[0].status = 'ended';
  }

  row.classAssignments.push({classId, effectiveFrom:at, status:'active', assignedBy, reason});
  row.currentClassId = classId;
  return null;
}
async function refs(body, schoolId) {
  if (!oid(schoolId) || !oid(body.childId) || !oid(body.programId)) return 'Valid childId, programId and schoolId are required';
  const [child, program] = await Promise.all([User.findOne({_id:body.childId, schoolId, role:'student'}), Program.findOne({_id:body.programId, schoolId, isActive:true})]);
  if (!child) return 'Child not found in this school'; if (!program) return 'Program not found in this school';
  if (body.currentLevelId) { const level = await Level.findOne({_id:body.currentLevelId, schoolId, programId:body.programId, isActive:true}); if (!level) return 'Level does not belong to the selected program and school'; }
  if (body.currentClassId) { const cls = await Class.findOne({_id:body.currentClassId, schoolId}); if (!cls) return 'Class not found in this school'; }
  if (Array.isArray(body.staffAssignments)) for (const a of body.staffAssignments) { if (!oid(a.staffId) || !await User.exists({_id:a.staffId, schoolId, role:'teacher', isActive:true})) return 'Staff assignment is not valid for this school'; }
  return null;
}
router.use(protect);
router.get('/', authorize(...readRoles), async (req,res)=>{ try { const schoolId=schoolFor(req,req.query.schoolId); if(!oid(schoolId)) return res.status(400).json({success:false,message:'schoolId is required'}); const q={schoolId}; for(const k of ['childId','programId','currentClassId','status']) if(req.query[k]) q[k]=req.query[k]; let rows=await Enrollment.find(q).sort({createdAt:-1}); if(req.user.role==='parent'){const children=await User.find({schoolId,role:'student',parentId:req.user._id}).select('_id'); const allowed=new Set(children.map(c=>String(c._id))); rows=rows.filter(r=>allowed.has(String(r.childId)));} else if(req.user.role==='teacher'){const children=await User.find({schoolId,role:'student'}); const permitted=new Set(); for(const child of children) if(await canAccessStudent(req.user,child)) permitted.add(String(child._id)); rows=rows.filter(r=>permitted.has(String(r.childId)));} res.json({success:true,data:rows}); } catch(e){res.status(500).json({success:false,message:e.message});} });
router.get('/:id', authorize(...readRoles), async (req,res)=>{ try { const schoolId=schoolFor(req,req.query.schoolId); if(!oid(schoolId)||!oid(req.params.id)) return res.status(404).json({success:false,message:'Enrollment not found'}); const row=await Enrollment.findOne({_id:req.params.id,schoolId}); if(!row) return res.status(404).json({success:false,message:'Enrollment not found'}); if(req.user.role==='parent'||req.user.role==='teacher'){const child=await User.findOne({_id:row.childId,schoolId,role:'student'}); if(!child||!(await canAccessStudent(req.user,child))) return res.status(403).json({success:false,message:'Not authorized'});} res.json({success:true,data:row}); }catch(e){res.status(500).json({success:false,message:e.message});} });
router.post('/', authorize(...management), async (req,res)=>{ try { const schoolId=schoolFor(req,req.body.schoolId); if(!oid(schoolId)) return res.status(400).json({success:false,message:'Valid schoolId is required'}); const body={...req.body,schoolId}; delete body.statusHistory; const err=await refs(body,schoolId); if(err)return res.status(400).json({success:false,message:err}); body.statusHistory=[{status:body.status||'pending',changedBy:req.user._id}]; if(body.currentLevelId)body.levelHistory=[{levelId:body.currentLevelId,effectiveFrom:body.startDate||new Date(),changedBy:req.user._id,reason:'Initial level'}]; if(body.currentClassId)body.classAssignments=[{classId:body.currentClassId,effectiveFrom:body.startDate||new Date(),assignedBy:req.user._id}]; const row=await Enrollment.create(body); res.status(201).json({success:true,data:row}); }catch(e){res.status(400).json({success:false,message:e.code===11000?'An active enrollment already exists for this child and program':e.message});} });
router.put('/:id/class-assignment', authorize(...management), async (req,res)=>{
  try {
    const schoolId=schoolFor(req,req.body.schoolId||req.query.schoolId);
    if(!oid(schoolId)||!oid(req.params.id))return res.status(404).json({success:false,message:'Enrollment not found'});
    const row=await Enrollment.findOne({_id:req.params.id,schoolId});
    if(!row)return res.status(404).json({success:false,message:'Enrollment not found'});
    const failure=await prepareClassAssignment(row,{
      classId:req.body.classId,
      effectiveDate:req.body.effectiveDate,
      reason:req.body.reason,
      assignedBy:req.user._id,
      schoolId
    });
    if(failure)return res.status(failure.status).json({success:false,message:failure.message});
    await row.save();
    res.json({success:true,data:row});
  } catch(e) {
    res.status(e.name==='DocumentNotFoundError'?409:400).json({
      success:false,
      message:e.name==='DocumentNotFoundError'
        ?'Enrollment changed while the class assignment was being saved'
        :e.message
    });
  }
});
router.put('/:id', authorize(...management), async (req,res)=>{
  try {
    const schoolId=schoolFor(req,req.body.schoolId||req.query.schoolId);
    if(!oid(schoolId)||!oid(req.params.id))return res.status(404).json({success:false,message:'Enrollment not found'});
    const row=await Enrollment.findOne({_id:req.params.id,schoolId});
    if(!row)return res.status(404).json({success:false,message:'Enrollment not found'});
    const body={...req.body};
    delete body.schoolId;
    if(body.currentClassId!==undefined&&!same(body.currentClassId,row.currentClassId)){
      return res.status(400).json({success:false,message:'Use the class-assignment operation to change an enrollment class'});
    }
    const candidate={
      childId:body.childId||row.childId,
      programId:body.programId||row.programId,
      currentLevelId:body.currentLevelId===undefined?row.currentLevelId:body.currentLevelId,
      currentClassId:row.currentClassId,
      staffAssignments:body.staffAssignments||row.staffAssignments
    };
    const err=await refs(candidate,schoolId);
    if(err)return res.status(400).json({success:false,message:err});
    const now=body.effectiveDate?new Date(body.effectiveDate):new Date();
    if(body.currentLevelId && !same(body.currentLevelId,row.currentLevelId)){
      row.levelHistory.forEach(h=>{if(!h.effectiveTo)h.effectiveTo=now;});
      row.levelHistory.push({levelId:body.currentLevelId,effectiveFrom:now,changedBy:req.user._id,reason:body.reason});
      row.currentLevelId=body.currentLevelId;
      delete body.currentLevelId;
    }
    delete body.currentClassId;
    if(body.status && body.status!==row.status){
      row.status=body.status;
      row.statusHistory.push({status:body.status,changedBy:req.user._id,reason:body.reason});
    }
    delete body.status;
    Object.assign(row,body);
    await row.save();
    res.json({success:true,data:row});
  }catch(e){
    res.status(400).json({success:false,message:e.code===11000?'An active enrollment already exists for this child and program':e.message});
  }
});
router.delete('/:id', authorize(...management), async (req,res)=>{try{const schoolId=schoolFor(req,req.body?.schoolId||req.query.schoolId);if(!oid(schoolId)||!oid(req.params.id))return res.status(404).json({success:false,message:'Enrollment not found'});const row=await Enrollment.findOneAndUpdate({_id:req.params.id,schoolId},{$set:{status:'withdrawn',endDate:new Date()},$push:{statusHistory:{status:'withdrawn',changedBy:req.user._id,reason:req.body?.reason}}},{new:true});if(!row)return res.status(404).json({success:false,message:'Enrollment not found'});res.json({success:true,data:row});}catch(e){res.status(400).json({success:false,message:e.message});}});
module.exports=router;



