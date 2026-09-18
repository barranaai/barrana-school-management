const Program = require('../models/Program');
const Level = require('../models/Level');
const Requirement = require('../models/Requirement');
const Parameter = require('../models/Parameter');
const Roadmap = require('../models/Roadmap');
const PlannedSession = require('../models/PlannedSession');
const StandardPackageAdoption = require('../models/StandardPackageAdoption');

const parameterTypes = new Set(['text', 'rating', 'percentage', 'number', 'checkbox', 'select']);
const clean = value => value == null ? value : JSON.parse(JSON.stringify(value));
const duplicate = message => Object.assign(new Error(message), { statusCode: 409, code: 'DUPLICATE_ADOPTION' });
const invalid = message => Object.assign(new Error(message), { statusCode: 400, code: 'INVALID_PACKAGE' });

function validateDefinition(definition) {
  if (!definition || !Array.isArray(definition.programs) || !definition.programs.length) throw invalid('Package must define at least one program');
  const keys = { program: new Set(), level: new Set(), requirement: new Set(), parameter: new Set(), roadmap: new Set() };
  const add = (kind, key) => { if (!key || keys[kind].has(key)) throw invalid(`Package has a missing or duplicate ${kind} key`); keys[kind].add(key); };
  for (const program of definition.programs) {
    add('program', program.key); if (!program.name) throw invalid('Program name is required');
    for (const level of program.levels || []) {
      add('level', level.key); if (!level.name) throw invalid('Level name is required');
      for (const requirement of level.requirements || []) {
        add('requirement', requirement.key); if (!requirement.name) throw invalid('Requirement name is required');
        for (const parameter of requirement.parameters || []) {
          add('parameter', parameter.key); if (!parameter.name || !parameterTypes.has(parameter.type)) throw invalid('Parameter name and supported type are required');
          if (parameter.type === 'select' && (!Array.isArray(parameter.options) || !parameter.options.length)) throw invalid('Select parameters require options');
        }
      }
    }
    for (const roadmap of program.roadmaps || []) {
      add('roadmap', roadmap.key); if (!keys.level.has(roadmap.levelKey) || !roadmap.name) throw invalid('Roadmap must reference a package level');
      for (const session of roadmap.plannedSessions || []) for (const objective of session.objectives || []) {
        if (objective.requirementKey && !keys.requirement.has(objective.requirementKey)) throw invalid('Objective requirement reference is invalid');
        if (objective.parameterKey && !keys.parameter.has(objective.parameterKey)) throw invalid('Objective parameter reference is invalid');
        if (objective.parameterKey && !objective.requirementKey) throw invalid('Objective parameter requires a requirement');
      }
    }
  }
  return true;
}

const meta = (pkg, sourceKey, adoptedAt, adoptedBy, extra) => ({ ...(clean(extra) || {}), standardPackage: { packageId: pkg._id, slug: pkg.slug, version: pkg.version, sourceKey, adoptedAt, adoptedBy } });
const createOne = async (Model, value, session) => (await Model.create([value], { session }))[0];

async function adoptPackage({ packageDocument: pkg, schoolId, userId }) {
  validateDefinition(pkg.definition);
  const session = await StandardPackageAdoption.db.startSession();
  try {
    let adoption;
    await session.withTransaction(async () => {
      if (await StandardPackageAdoption.findOne({ schoolId, packageId: pkg._id }).session(session)) throw duplicate('This organization has already adopted this package');
      const adoptedAt = new Date();
      const ids = { programIds: [], levelIds: [], requirementIds: [], parameterIds: [], roadmapIds: [], plannedSessionIds: [] };
      const map = { programs: new Map(), levels: new Map(), requirements: new Map(), parameters: new Map(), roadmaps: new Map() };
      for (const p of pkg.definition.programs) {
        const row = await createOne(Program, { schoolId, name:p.name, description:p.description, displayOrder:p.displayOrder || 0, isActive:true, metadata:meta(pkg,p.key,adoptedAt,userId,p.metadata) }, session);
        map.programs.set(p.key,row._id); ids.programIds.push(row._id);
        for (const l of p.levels || []) {
          const level = await createOne(Level,{ schoolId,programId:row._id,name:l.name,description:l.description,sequence:l.sequence||0,isActive:true,metadata:meta(pkg,l.key,adoptedAt,userId,l.metadata)},session);
          map.levels.set(l.key,level._id); ids.levelIds.push(level._id);
          for (const r of l.requirements || []) {
            const requirement=await createOne(Requirement,{schoolId,programId:row._id,levelId:level._id,name:r.name,description:r.description,sequence:r.sequence||0,isRequired:r.isRequired!==false,isActive:true,metadata:meta(pkg,r.key,adoptedAt,userId,r.metadata)},session);
            map.requirements.set(r.key,requirement._id); ids.requirementIds.push(requirement._id);
            for(const x of r.parameters||[]){const parameter=await createOne(Parameter,{schoolId,programId:row._id,requirementId:requirement._id,name:x.name,type:x.type,options:x.options||[],isRequired:Boolean(x.isRequired),sequence:x.sequence||0,isActive:true,metadata:meta(pkg,x.key,adoptedAt,userId,x.metadata)},session);map.parameters.set(x.key,parameter._id);ids.parameterIds.push(parameter._id);}
          }
        }
        for(const r of p.roadmaps||[]){const roadmap=await createOne(Roadmap,{schoolId,programId:row._id,levelId:map.levels.get(r.levelKey),name:r.name,description:r.description,version:r.version||1,status:'draft',methodology:r.methodology,eligibilityContext:clean(r.eligibilityContext),metadata:meta(pkg,r.key,adoptedAt,userId,r.metadata),createdBy:userId,updatedBy:userId},session);map.roadmaps.set(r.key,roadmap._id);ids.roadmapIds.push(roadmap._id);for(const x of r.plannedSessions||[]){const objectives=(x.objectives||[]).map(o=>({sequence:o.sequence,title:o.title,description:o.description,expectedOutcome:o.expectedOutcome,instructionalGuidance:o.instructionalGuidance,requirementId:o.requirementKey?map.requirements.get(o.requirementKey):undefined,parameterId:o.parameterKey?map.parameters.get(o.parameterKey):undefined,metadata:clean(o.metadata)||{}}));const planned=await createOne(PlannedSession,{schoolId,roadmapId:roadmap._id,roadmapVersion:roadmap.version,sequence:x.sequence,title:x.title,description:x.description,objectives,expectedOutcomes:x.expectedOutcomes||[],methodology:x.methodology,status:'draft',metadata:meta(pkg,`${r.key}:session:${x.sequence}`,adoptedAt,userId,x.metadata),createdBy:userId,updatedBy:userId},session);ids.plannedSessionIds.push(planned._id);}}
      }
      adoption=await createOne(StandardPackageAdoption,{schoolId,packageId:pkg._id,packageSlug:pkg.slug,packageVersion:pkg.version,adoptedBy:userId,adoptedAt,copiedRecords:ids},session);
    });
    return adoption;
  } catch(error){ if(error?.code===11000) throw duplicate('This organization has already adopted this package'); throw error; }
  finally { await session.endSession(); }
}
module.exports={validateDefinition,adoptPackage};
