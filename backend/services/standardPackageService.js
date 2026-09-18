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

const meta = (pkg, sourceKey, adoptedAt, adoptedBy, extra) => ({
  ...(clean(extra) || {}),
  standardPackage: { packageId: pkg._id, slug: pkg.slug, version: pkg.version, sourceKey, adoptedAt, adoptedBy }
});
const createOne = async (Model, value, session) => (await Model.create([value], { session }))[0];

async function adoptPackageInSession({ packageDocument: pkg, schoolId, userId, session }) {
  if (!session) {
    throw Object.assign(new Error('An existing MongoDB session is required'), {
      statusCode: 500,
      code: 'SESSION_REQUIRED'
    });
  }

  validateDefinition(pkg.definition);
  if (await StandardPackageAdoption.findOne({ schoolId, packageId: pkg._id }).session(session)) {
    throw duplicate('This organization has already adopted this package');
  }

  const adoptedAt = new Date();
  const ids = {
    programIds: [],
    levelIds: [],
    requirementIds: [],
    parameterIds: [],
    roadmapIds: [],
    plannedSessionIds: []
  };
  const map = {
    programs: new Map(),
    levels: new Map(),
    requirements: new Map(),
    parameters: new Map(),
    roadmaps: new Map()
  };

  for (const programDefinition of pkg.definition.programs) {
    const program = await createOne(Program, {
      schoolId,
      name: programDefinition.name,
      description: programDefinition.description,
      displayOrder: programDefinition.displayOrder || 0,
      isActive: true,
      metadata: meta(pkg, programDefinition.key, adoptedAt, userId, programDefinition.metadata)
    }, session);
    map.programs.set(programDefinition.key, program._id);
    ids.programIds.push(program._id);

    for (const levelDefinition of programDefinition.levels || []) {
      const level = await createOne(Level, {
        schoolId,
        programId: program._id,
        name: levelDefinition.name,
        description: levelDefinition.description,
        sequence: levelDefinition.sequence || 0,
        isActive: true,
        metadata: meta(pkg, levelDefinition.key, adoptedAt, userId, levelDefinition.metadata)
      }, session);
      map.levels.set(levelDefinition.key, level._id);
      ids.levelIds.push(level._id);

      for (const requirementDefinition of levelDefinition.requirements || []) {
        const requirement = await createOne(Requirement, {
          schoolId,
          programId: program._id,
          levelId: level._id,
          name: requirementDefinition.name,
          description: requirementDefinition.description,
          sequence: requirementDefinition.sequence || 0,
          isRequired: requirementDefinition.isRequired !== false,
          isActive: true,
          metadata: meta(pkg, requirementDefinition.key, adoptedAt, userId, requirementDefinition.metadata)
        }, session);
        map.requirements.set(requirementDefinition.key, requirement._id);
        ids.requirementIds.push(requirement._id);

        for (const parameterDefinition of requirementDefinition.parameters || []) {
          const parameter = await createOne(Parameter, {
            schoolId,
            programId: program._id,
            requirementId: requirement._id,
            name: parameterDefinition.name,
            type: parameterDefinition.type,
            options: parameterDefinition.options || [],
            isRequired: Boolean(parameterDefinition.isRequired),
            sequence: parameterDefinition.sequence || 0,
            isActive: true,
            metadata: meta(pkg, parameterDefinition.key, adoptedAt, userId, parameterDefinition.metadata)
          }, session);
          map.parameters.set(parameterDefinition.key, parameter._id);
          ids.parameterIds.push(parameter._id);
        }
      }
    }

    for (const roadmapDefinition of programDefinition.roadmaps || []) {
      const roadmap = await createOne(Roadmap, {
        schoolId,
        programId: program._id,
        levelId: map.levels.get(roadmapDefinition.levelKey),
        name: roadmapDefinition.name,
        description: roadmapDefinition.description,
        version: roadmapDefinition.version || 1,
        status: 'draft',
        methodology: roadmapDefinition.methodology,
        eligibilityContext: clean(roadmapDefinition.eligibilityContext),
        metadata: meta(pkg, roadmapDefinition.key, adoptedAt, userId, roadmapDefinition.metadata),
        createdBy: userId,
        updatedBy: userId
      }, session);
      map.roadmaps.set(roadmapDefinition.key, roadmap._id);
      ids.roadmapIds.push(roadmap._id);

      for (const sessionDefinition of roadmapDefinition.plannedSessions || []) {
        const objectives = (sessionDefinition.objectives || []).map((objective, objectiveIndex) => ({
          sequence: objective.sequence ?? objectiveIndex + 1,
          title: objective.title,
          description: objective.description,
          expectedOutcome: objective.expectedOutcome,
          instructionalGuidance: objective.instructionalGuidance,
          requirementId: objective.requirementKey ? map.requirements.get(objective.requirementKey) : undefined,
          parameterId: objective.parameterKey ? map.parameters.get(objective.parameterKey) : undefined,
          metadata: clean(objective.metadata) || {}
        }));
        const plannedSession = await createOne(PlannedSession, {
          schoolId,
          roadmapId: roadmap._id,
          roadmapVersion: roadmap.version,
          sequence: sessionDefinition.sequence,
          title: sessionDefinition.title,
          description: sessionDefinition.description,
          objectives,
          expectedOutcomes: sessionDefinition.expectedOutcomes || [],
          methodology: sessionDefinition.methodology,
          status: 'draft',
          metadata: meta(pkg, `${roadmapDefinition.key}:session:${sessionDefinition.sequence}`, adoptedAt, userId, sessionDefinition.metadata),
          createdBy: userId,
          updatedBy: userId
        }, session);
        ids.plannedSessionIds.push(plannedSession._id);
      }
    }
  }

  return createOne(StandardPackageAdoption, {
    schoolId,
    packageId: pkg._id,
    packageSlug: pkg.slug,
    packageVersion: pkg.version,
    adoptedBy: userId,
    adoptedAt,
    copiedRecords: ids
  }, session);
}

async function adoptPackage({ packageDocument, schoolId, userId }) {
  const session = await StandardPackageAdoption.db.startSession();
  try {
    let adoption;
    await session.withTransaction(async () => {
      adoption = await adoptPackageInSession({
        packageDocument,
        schoolId,
        userId,
        session
      });
    });
    return adoption;
  } catch (error) {
    if (error?.code === 11000) throw duplicate('This organization has already adopted this package');
    throw error;
  } finally {
    await session.endSession();
  }
}

module.exports = { validateDefinition, adoptPackageInSession, adoptPackage };
