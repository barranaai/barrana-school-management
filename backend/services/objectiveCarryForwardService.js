const eligibleStatuses = new Set(['not_achieved', 'partially_achieved']);
const id = value => String(value?._id || value || '');

function eligibleObjectives(progress, deliveredSession) {
  const snapshots = new Map((deliveredSession?.plannedSessionSnapshot?.objectives || []).map(objective => [id(objective.objectiveId), objective]));
  return (progress?.objectiveResults || [])
    .filter(result => eligibleStatuses.has(result.status) && snapshots.has(id(result.objectiveId)))
    .map(result => ({ result, objective: snapshots.get(id(result.objectiveId)) }));
}

function alreadyPresent(target, sourceObjectiveId) {
  const sourceId = id(sourceObjectiveId);
  return (target?.objectives || []).some(objective =>
    id(objective._id) === sourceId || id(objective?.metadata?.carryForward?.sourceObjectiveId) === sourceId
  );
}

function carryForwardObjective(source, target, trace, objectId) {
  const sequence = Math.max(0, ...(target.objectives || []).map(objective => Number(objective.sequence) || 0)) + 1;
  return {
    _id: objectId,
    sequence,
    title: source.title,
    description: source.description,
    requirementId: source.requirementId,
    parameterId: source.parameterId,
    expectedOutcome: source.expectedOutcome,
    instructionalGuidance: source.instructionalGuidance,
    metadata: { carryForward: trace }
  };
}

module.exports = { eligibleStatuses, eligibleObjectives, alreadyPresent, carryForwardObjective };
