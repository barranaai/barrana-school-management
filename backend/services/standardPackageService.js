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
const allowedFields = Object.freeze({
  definition: new Set(['programs']),
  program: new Set(['key', 'name', 'description', 'displayOrder', 'levels', 'roadmaps', 'metadata']),
  level: new Set(['key', 'name', 'description', 'sequence', 'requirements', 'metadata']),
  requirement: new Set(['key', 'name', 'description', 'sequence', 'isRequired', 'parameters', 'metadata']),
  parameter: new Set(['key', 'name', 'type', 'options', 'isRequired', 'sequence', 'metadata']),
  roadmap: new Set(['key', 'levelKey', 'name', 'description', 'version', 'methodology', 'eligibilityContext', 'plannedSessions', 'metadata']),
  plannedSession: new Set(['sequence', 'title', 'description', 'objectives', 'expectedOutcomes', 'methodology', 'metadata']),
  objective: new Set(['sequence', 'title', 'description', 'expectedOutcome', 'instructionalGuidance', 'requirementKey', 'parameterKey', 'metadata'])
});

const sensitiveMetadataKey = key =>
  /(^|_)(school|tenant|owner|user|participant|child|teacher|parent)?id$/i.test(key) ||
  /(password|credential|token|secret|api.?key|authorization|email|phone|address)/i.test(key);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw invalid(`${label} must be an object`);
  }
}

function assertAllowedObject(value, kind, label) {
  assertPlainObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowedFields[kind].has(key)) throw invalid(`${label} contains unsupported field ${key}`);
  }
}

function validateSafeMetadata(value, label, depth = 0) {
  if (value == null) return;
  if (depth > 4) throw invalid(`${label} is too deeply nested`);
  if (Array.isArray(value)) {
    for (const item of value) validateSafeMetadata(item, label, depth + 1);
    return;
  }
  if (typeof value !== 'object') {
    if (!['string', 'number', 'boolean'].includes(typeof value)) throw invalid(`${label} contains an unsupported value`);
    return;
  }
  assertPlainObject(value, label);
  for (const [key, nested] of Object.entries(value)) {
    if (sensitiveMetadataKey(key)) throw invalid(`${label} contains a sensitive field`);
    validateSafeMetadata(nested, label, depth + 1);
  }
}

function validateDefinition(definition) {
  assertAllowedObject(definition, 'definition', 'Package definition');
  if (!Array.isArray(definition.programs) || !definition.programs.length) throw invalid('Package must define at least one program');
  const keys = { program: new Set(), level: new Set(), requirement: new Set(), parameter: new Set(), roadmap: new Set() };
  const add = (kind, key) => { if (!key || keys[kind].has(key)) throw invalid(`Package has a missing or duplicate ${kind} key`); keys[kind].add(key); };
  for (const program of definition.programs) {
    const programLevelKeys = new Set();
    const programRequirementKeys = new Set();
    const parameterRequirementKeys = new Map();
    assertAllowedObject(program, 'program', 'Program');
    validateSafeMetadata(program.metadata, 'Program metadata');
    add('program', program.key);
    if (!program.name) throw invalid('Program name is required');
    if (program.levels != null && !Array.isArray(program.levels)) throw invalid('Program levels must be an array');
    if (program.roadmaps != null && !Array.isArray(program.roadmaps)) throw invalid('Program roadmaps must be an array');
    for (const level of program.levels || []) {
      assertAllowedObject(level, 'level', 'Level');
      validateSafeMetadata(level.metadata, 'Level metadata');
      add('level', level.key);
      programLevelKeys.add(level.key);
      if (!level.name) throw invalid('Level name is required');
      if (level.requirements != null && !Array.isArray(level.requirements)) throw invalid('Level requirements must be an array');
      for (const requirement of level.requirements || []) {
        assertAllowedObject(requirement, 'requirement', 'Requirement');
        validateSafeMetadata(requirement.metadata, 'Requirement metadata');
        add('requirement', requirement.key);
        programRequirementKeys.add(requirement.key);
        if (!requirement.name) throw invalid('Requirement name is required');
        if (requirement.parameters != null && !Array.isArray(requirement.parameters)) throw invalid('Requirement parameters must be an array');
        for (const parameter of requirement.parameters || []) {
          assertAllowedObject(parameter, 'parameter', 'Parameter');
          validateSafeMetadata(parameter.metadata, 'Parameter metadata');
          add('parameter', parameter.key);
          parameterRequirementKeys.set(parameter.key, requirement.key);
          if (!parameter.name || !parameterTypes.has(parameter.type)) throw invalid('Parameter name and supported type are required');
          if (parameter.type === 'select' && (!Array.isArray(parameter.options) || !parameter.options.length)) throw invalid('Select parameters require options');
        }
      }
    }
    for (const roadmap of program.roadmaps || []) {
      assertAllowedObject(roadmap, 'roadmap', 'Roadmap');
      validateSafeMetadata(roadmap.metadata, 'Roadmap metadata');
      validateSafeMetadata(roadmap.eligibilityContext, 'Roadmap eligibility context');
      add('roadmap', roadmap.key);
      if (!programLevelKeys.has(roadmap.levelKey) || !roadmap.name) throw invalid('Roadmap must reference a package level');
      if (roadmap.plannedSessions != null && !Array.isArray(roadmap.plannedSessions)) throw invalid('Roadmap planned sessions must be an array');
      for (const sessionDefinition of roadmap.plannedSessions || []) {
        assertAllowedObject(sessionDefinition, 'plannedSession', 'Planned Session');
        validateSafeMetadata(sessionDefinition.metadata, 'Planned Session metadata');
        if (!sessionDefinition.title || !Number.isInteger(sessionDefinition.sequence) || sessionDefinition.sequence < 1) {
          throw invalid('Planned Session title and positive sequence are required');
        }
        if (sessionDefinition.objectives != null && !Array.isArray(sessionDefinition.objectives)) throw invalid('Planned Session objectives must be an array');
        for (const objective of sessionDefinition.objectives || []) {
          assertAllowedObject(objective, 'objective', 'Objective');
          validateSafeMetadata(objective.metadata, 'Objective metadata');
          if (!objective.title) throw invalid('Objective title is required');
          if (objective.requirementKey && !programRequirementKeys.has(objective.requirementKey)) throw invalid('Objective requirement reference is invalid');
          if (objective.parameterKey && parameterRequirementKeys.get(objective.parameterKey) !== objective.requirementKey) throw invalid('Objective parameter reference is invalid');
          if (objective.parameterKey && !objective.requirementKey) throw invalid('Objective parameter requires a requirement');
        }
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
