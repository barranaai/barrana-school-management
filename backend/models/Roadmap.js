const mongoose = require('mongoose');
const roadmapSchema = new mongoose.Schema({
  schoolId:{type:mongoose.Schema.Types.ObjectId,ref:'School',required:true,index:true},
  programId:{type:mongoose.Schema.Types.ObjectId,ref:'Program',required:true,index:true},
  levelId:{type:mongoose.Schema.Types.ObjectId,ref:'Level',required:true,index:true},
  name:{type:String,required:true,trim:true,maxlength:200},
  description:{type:String,trim:true,maxlength:5000},
  version:{type:Number,required:true,min:1},
  status:{type:String,enum:['draft','active','archived'],default:'draft',index:true},
  effectiveFrom:{type:Date}, effectiveTo:{type:Date},
  methodology:{type:String,trim:true,maxlength:10000},
  eligibilityContext:{type:mongoose.Schema.Types.Mixed,default:null},
  metadata:{type:mongoose.Schema.Types.Mixed,default:{}},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true});
roadmapSchema.index({schoolId:1,programId:1,levelId:1,version:1},{unique:true});
roadmapSchema.index({schoolId:1,programId:1,levelId:1,status:1});
roadmapSchema.index({schoolId:1,programId:1,levelId:1},{unique:true,partialFilterExpression:{status:'active'}});
module.exports=mongoose.model('Roadmap',roadmapSchema);

