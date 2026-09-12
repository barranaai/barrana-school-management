const express=require('express');const mongoose=require('mongoose');const {protect,authorize}=require('../middleware/auth');const {scopeSchoolId}=require('../middleware/resourceAuthorization');const Roadmap=require('../models/Roadmap');const Program=require('../models/Program');const Level=require('../models/Level');const router=express.Router();const admins=['school_admin','super_admin'];const readers=['school_admin','super_admin','teacher'];const oid=v=>mongoose.Types.ObjectId.isValid(v);const tenant=(req,v)=>req.user.role==='super_admin'?v:String(req.user.schoolId||'');
async function hierarchy(body,schoolId,session=null){if(!oid(schoolId)||!oid(body.programId)||!oid(body.levelId))return 'Valid schoolId, programId and levelId are required';const p=await Program.findOne({_id:body.programId,schoolId,isActive:true}).session(session);if(!p)return 'Program not found in this school';const l=await Level.findOne({_id:body.levelId,schoolId,programId:body.programId,isActive:true}).session(session);if(!l)return 'Level does not belong to the selected program and school';return null;}

// Clients echo __v; null explicitly represents a legacy document without __v.
const validRevision = v => v === null || (Number.isSafeInteger(v) && v >= 0);
const revisionMatches = (row, v) => v === null ? row.__v === undefined : row.__v === v;
const revisionFilter = v => v === null ? { $exists: false } : v;
const conflict = () => Object.assign(new Error('Roadmap changed. Reload and review before retrying.'), { statusCode: 409, code: 'ROADMAP_REVISION_CONFLICT' });
const badRequest = message => Object.assign(new Error(message), { statusCode: 400 });
function expectedRevision(body) {
  if (!Object.hasOwn(body, '__v') || !validRevision(body.__v)) throw badRequest('Expected __v is required (nonnegative integer, or null for a legacy revision)');
  return body.__v;
}
function stateFilter(row, status, revision) {
  return { _id: row._id, schoolId: row.schoolId, programId: row.programId, levelId: row.levelId, version: row.version, status, __v: revisionFilter(revision) };
}
function effectiveDate(body, field) {
  if (!Object.hasOwn(body, field)) return new Date();
  const value = body[field];
  if (typeof value !== 'string' || !value.trim() || !Number.isFinite(new Date(value).getTime())) throw badRequest(field + ' must be a valid date');
  return new Date(value);
}
function checkDateRange(from, to) {
  if (from != null && !Number.isFinite(new Date(from).getTime())) throw badRequest('Invalid effectiveFrom');
  if (to != null && !Number.isFinite(new Date(to).getTime())) throw badRequest('Invalid effectiveTo');
  if (from != null && to != null && new Date(to) < new Date(from)) throw badRequest('effectiveTo cannot precede effectiveFrom');
}
function lifecycleError(res, error) {
  if (error.code === 11000 || error.code === 112 || error.hasErrorLabel?.('TransientTransactionError')) error = conflict();
  if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message, ...(error.code ? { code: error.code } : {}) });
  if (['ValidationError', 'CastError'].includes(error.name)) return res.status(400).json({ success: false, message: 'Invalid Roadmap data' });
  return res.status(503).json({ success: false, message: 'Roadmap operation could not be confirmed. Reload before retrying; activation requires transaction-capable MongoDB.' });
}

router.use(protect);
router.get('/',authorize(...readers),async(req,res)=>{try{const schoolId=tenant(req,req.query.schoolId);if(!oid(schoolId))return res.status(400).json({success:false,message:'schoolId is required'});const q={schoolId};for(const k of ['programId','levelId','status'])if(req.query[k])q[k]=req.query[k];if(!q.status)q.status={$in:['draft','active']};const data=await Roadmap.find(q).sort({programId:1,levelId:1,version:-1});res.json({success:true,data});}catch(e){res.status(500).json({success:false,message:e.message});}});
router.get('/:id',authorize(...readers),async(req,res)=>{try{const schoolId=tenant(req,req.query.schoolId);if(!oid(schoolId)||!oid(req.params.id))return res.status(404).json({success:false,message:'Roadmap not found'});const data=await Roadmap.findOne({_id:req.params.id,schoolId});if(!data)return res.status(404).json({success:false,message:'Roadmap not found'});res.json({success:true,data});}catch(e){res.status(500).json({success:false,message:e.message});}});
router.post('/',authorize(...admins),async(req,res)=>{try{const schoolId=tenant(req,req.body.schoolId);const body={...req.body,schoolId,createdBy:req.user._id,updatedBy:req.user._id,status:'draft'};delete body.version;delete body.effectiveTo;const err=await hierarchy(body,schoolId);if(err)return res.status(400).json({success:false,message:err});const latest=await Roadmap.findOne({schoolId,programId:body.programId,levelId:body.levelId}).sort({version:-1});body.version=(latest?.version||0)+1;const data=await Roadmap.create(body);res.status(201).json({success:true,data});}catch(e){res.status(400).json({success:false,message:e.code===11000?'Roadmap version already exists':e.message});}});
router.put('/:id', authorize(...admins), async (req, res) => {
  try {
    const schoolId = tenant(req, req.body.schoolId || req.query.schoolId);
    if (!oid(schoolId) || !oid(req.params.id)) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    const revision = expectedRevision(req.body);
    const current = await Roadmap.findOne({ _id: req.params.id, schoolId });
    if (!current) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    if (current.status !== 'draft' || !revisionMatches(current, revision)) throw conflict();
    const body = { ...req.body };
    for (const key of ['_id', '__v', 'schoolId', 'version', 'status', 'createdBy', 'createdAt', 'updatedAt', 'expectedPredecessor']) delete body[key];
    const err = await hierarchy({ programId: body.programId || current.programId, levelId: body.levelId || current.levelId }, schoolId);
    if (err) throw badRequest(err);
    checkDateRange(Object.hasOwn(body, 'effectiveFrom') ? body.effectiveFrom : current.effectiveFrom, Object.hasOwn(body, 'effectiveTo') ? body.effectiveTo : current.effectiveTo);
    const data = await Roadmap.findOneAndUpdate(stateFilter(current, 'draft', revision), { $set: { ...body, updatedBy: req.user._id }, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!data) throw conflict();
    res.json({ success: true, data });
  } catch (error) { lifecycleError(res, error); }
});
router.post('/:id/versions',authorize(...admins),async(req,res)=>{try{const schoolId=tenant(req,req.body.schoolId||req.query.schoolId);if(!oid(schoolId)||!oid(req.params.id))return res.status(404).json({success:false,message:'Roadmap not found'});const current=await Roadmap.findOne({_id:req.params.id,schoolId});if(!current)return res.status(404).json({success:false,message:'Roadmap not found'});const body={...current.toObject(),...req.body};delete body._id;delete body.__v;delete body.createdAt;delete body.updatedAt;delete body.schoolId;body.schoolId=schoolId;body.version=current.version+1;body.status='draft';body.createdBy=req.user._id;body.updatedBy=req.user._id;delete body.effectiveTo;const err=await hierarchy(body,schoolId);if(err)return res.status(400).json({success:false,message:err});const data=await Roadmap.create(body);res.status(201).json({success:true,data});}catch(e){res.status(400).json({success:false,message:e.code===11000?'Roadmap version already exists':e.message});}});
router.patch('/:id/activate', authorize(...admins), async (req, res) => {
  let session;
  try {
    const schoolId = tenant(req, req.body.schoolId || req.query.schoolId);
    if (!oid(schoolId) || !oid(req.params.id)) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    const revision = expectedRevision(req.body);
    const expected = req.body.expectedPredecessor;
    if (expected !== null && (!expected || !oid(expected._id) || !Object.hasOwn(expected, '__v') || !validRevision(expected.__v))) throw badRequest('expectedPredecessor must be null or { _id, __v }');
    // These expectations/date stay fixed across driver transaction retries.
    const now = effectiveDate(req.body, 'effectiveFrom');
    session = await Roadmap.db.startSession();
    let result;
    await session.withTransaction(async () => {
      const row = await Roadmap.findOne({ _id: req.params.id, schoolId }).session(session);
      if (!row) throw Object.assign(new Error('Roadmap not found'), { statusCode: 404 });
      if (row.status !== 'draft' || !revisionMatches(row, revision)) throw conflict();
      const err = await hierarchy(row, schoolId, session);
      if (err) throw badRequest(err);
      const active = await Roadmap.find({ schoolId, programId: row.programId, levelId: row.levelId, status: 'active' }).session(session);
      if (expected === null ? active.length !== 0 : active.length !== 1 || String(active[0]._id) !== String(expected._id) || !revisionMatches(active[0], expected.__v)) throw conflict();
      if (expected !== null) {
        checkDateRange(active[0].effectiveFrom, now);
        const archived = await Roadmap.findOneAndUpdate(stateFilter(active[0], 'active', expected.__v), { $set: { status: 'archived', effectiveTo: now, updatedBy: req.user._id }, $inc: { __v: 1 } }, { session, new: true, runValidators: true });
        if (!archived) throw conflict();
      }
      result = await Roadmap.findOneAndUpdate(stateFilter(row, 'draft', revision), { $set: { status: 'active', effectiveFrom: now, updatedBy: req.user._id }, $unset: { effectiveTo: 1 }, $inc: { __v: 1 } }, { session, new: true, runValidators: true });
      if (!result) throw conflict();
    });
    res.json({ success: true, data: result });
  } catch (error) { lifecycleError(res, error); }
  finally { if (session) await session.endSession(); }
});
router.patch('/:id/deactivate', authorize(...admins), async (req, res) => {
  try {
    const schoolId = tenant(req, req.body.schoolId || req.query.schoolId);
    if (!oid(schoolId) || !oid(req.params.id)) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    const revision = expectedRevision(req.body);
    const row = await Roadmap.findOne({ _id: req.params.id, schoolId });
    if (!row) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    if (row.status !== 'active' || !revisionMatches(row, revision)) throw conflict();
    const now = effectiveDate(req.body, 'effectiveTo'); checkDateRange(row.effectiveFrom, now);
    const data = await Roadmap.findOneAndUpdate(stateFilter(row, 'active', revision), { $set: { status: 'archived', effectiveTo: now, updatedBy: req.user._id }, $inc: { __v: 1 } }, { new: true, runValidators: true });
    if (!data) throw conflict();
    res.json({ success: true, data });
  } catch (error) { lifecycleError(res, error); }
});
module.exports=router;

