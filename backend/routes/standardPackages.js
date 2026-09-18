const express = require('express');
const mongoose = require('mongoose');
const { protect, protectReadOnly, authorize } = require('../middleware/auth');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const School = require('../models/School');
const StandardPackage = require('../models/StandardPackage');
const StandardPackageAdoption = require('../models/StandardPackageAdoption');
const { validateDefinition, adoptPackage } = require('../services/standardPackageService');
const router = express.Router();
const validId = value => mongoose.Types.ObjectId.isValid(value);
const admins = ['school_admin','super_admin'];
const error = (res, e) => res.status(e.statusCode || (e.code === 11000 ? 409 : 400)).json({ success:false, message:e.code === 11000 ? 'Package slug and version already exist' : e.message });

router.get('/', protectReadOnly, authorize(...admins), async (req,res)=>{
  try { const query=req.user.role==='super_admin' && req.query.includeDrafts==='true' ? {} : {status:'published'}; const data=await StandardPackage.find(query).sort({name:1,version:-1}).select('-definition'); res.json({success:true,data}); }
  catch(e){ error(res,e); }
});
router.get('/adoptions', protectReadOnly, authorize(...admins), async(req,res)=>{
  try { const schoolId=scopeSchoolId(req.user,req.query.schoolId); if(!validId(schoolId)) return res.status(400).json({success:false,message:'Explicit valid schoolId is required'}); const data=await StandardPackageAdoption.find({schoolId}).populate('packageId','name slug version status').sort({adoptedAt:-1}); res.json({success:true,data}); }
  catch(e){error(res,e);}
});
router.get('/:id', protectReadOnly, authorize(...admins), async(req,res)=>{
  try { if(!validId(req.params.id)) return res.status(404).json({success:false,message:'Standard package not found'}); const query={_id:req.params.id}; if(req.user.role!=='super_admin') query.status='published'; const data=await StandardPackage.findOne(query); if(!data)return res.status(404).json({success:false,message:'Standard package not found'}); res.json({success:true,data}); }
  catch(e){error(res,e);}
});
router.post('/', protect, authorize('super_admin'), async(req,res)=>{
  try { validateDefinition(req.body.definition); const data=await StandardPackage.create({slug:req.body.slug,name:req.body.name,description:req.body.description,version:req.body.version,organizationTypes:req.body.organizationTypes||[],definition:req.body.definition,status:'draft',createdBy:req.user._id,updatedBy:req.user._id}); res.status(201).json({success:true,data}); }
  catch(e){error(res,e);}
});
router.put('/:id', protect, authorize('super_admin'), async(req,res)=>{
  try { if(!validId(req.params.id))return res.status(404).json({success:false,message:'Standard package not found'}); const current=await StandardPackage.findById(req.params.id); if(!current)return res.status(404).json({success:false,message:'Standard package not found'}); if(current.status!=='draft')return res.status(409).json({success:false,message:'Published or retired packages are immutable'}); if(req.body.definition)validateDefinition(req.body.definition); for(const key of ['name','description','organizationTypes','definition'])if(Object.hasOwn(req.body,key))current[key]=req.body[key]; current.updatedBy=req.user._id; await current.save(); res.json({success:true,data:current}); }
  catch(e){error(res,e);}
});
router.patch('/:id/publish', protect, authorize('super_admin'), async(req,res)=>{
  try { if(!validId(req.params.id))return res.status(404).json({success:false,message:'Standard package not found'}); const current=await StandardPackage.findById(req.params.id); if(!current)return res.status(404).json({success:false,message:'Standard package not found'}); if(current.status!=='draft')return res.status(409).json({success:false,message:'Only draft packages can be published'}); validateDefinition(current.definition); current.status='published';current.publishedAt=new Date();current.updatedBy=req.user._id;await current.save();res.json({success:true,data:current}); }
  catch(e){error(res,e);}
});
router.post('/:id/adopt', protect, authorize(...admins), async(req,res)=>{
  try { const schoolId=scopeSchoolId(req.user,req.body.schoolId); if(!validId(schoolId))return res.status(400).json({success:false,message:'Explicit valid schoolId is required'}); if(!validId(req.params.id))return res.status(404).json({success:false,message:'Standard package not found'}); const [school,pkg]=await Promise.all([School.findOne({_id:schoolId,isActive:{$ne:false}}),StandardPackage.findOne({_id:req.params.id,status:'published'})]); if(!school||!pkg)return res.status(404).json({success:false,message:'Organization or standard package not found'}); const data=await adoptPackage({packageDocument:pkg,schoolId,userId:req.user._id});res.status(201).json({success:true,data}); }
  catch(e){error(res,e);}
});
module.exports=router;
