import { evaluateOrganizationSetup, OrganizationSetupSnapshot } from './organizationSetupReadinessService';

const program = { _id: 'program', schoolId: 'school', name: 'Swimming', displayOrder: 1, isActive: true };
const level = { _id: 'level', schoolId: 'school', programId: 'program', name: 'Water Confidence', sequence: 1, isActive: true };
const requirement = { _id: 'requirement', schoolId: 'school', programId: 'program', levelId: 'level', name: 'Safe entry', sequence: 1, isActive: true, isRequired: true };
const parameter = { _id: 'parameter', schoolId: 'school', programId: 'program', requirementId: 'requirement', name: 'Completed', sequence: 1, isActive: true, isRequired: true, type: 'checkbox' as const };
const roadmap = { _id: 'roadmap', schoolId: 'school', programId: 'program', levelId: 'level', name: 'Foundation', version: 1, status: 'active' as const };
const session = { _id: 'session', schoolId: 'school', roadmapId: 'roadmap', roadmapVersion: 1, sequence: 1, title: 'Safe entry', expectedOutcomes: [], status: 'active' as const, objectives: [] };

const complete = (): OrganizationSetupSnapshot => ({ programs: [{ program, levels: [{ level, requirements: [requirement], parameters: [parameter], roadmaps: [roadmap], sessions: [session] }] }] });

test('reports a complete organization setup only when delivery content is active', () => {
  const result = evaluateOrganizationSetup(complete());
  expect(result.ready).toBe(true);
  expect(result.steps.every(step => step.status === 'complete')).toBe(true);
});

test('explains each missing setup stage without inventing readiness', () => {
  const empty = evaluateOrganizationSetup({ programs: [] });
  expect(empty.ready).toBe(false);
  expect(empty.steps.map(step => step.status)).toEqual(Array(5).fill('needs_attention'));

  const draft = complete();
  draft.programs[0].levels[0].roadmaps[0] = { ...roadmap, status: 'draft' };
  draft.programs[0].levels[0].sessions[0] = { ...session, status: 'draft' };
  const result = evaluateOrganizationSetup(draft);
  expect(result.steps.find(step => step.key === 'plans')?.status).toBe('complete');
  expect(result.steps.find(step => step.key === 'activation')?.status).toBe('needs_attention');
});

test('requires assessment and plans for every active level while ignoring inactive levels', () => {
  const snapshot = complete();
  snapshot.programs[0].levels.push({
    level: { ...level, _id: 'second', name: 'Stroke Development' },
    requirements: [], parameters: [], roadmaps: [], sessions: []
  });
  let result = evaluateOrganizationSetup(snapshot);
  expect(result.steps.find(step => step.key === 'assessment')?.status).toBe('needs_attention');
  expect(result.steps.find(step => step.key === 'plans')?.status).toBe('needs_attention');

  snapshot.programs[0].levels[1].level.isActive = false;
  result = evaluateOrganizationSetup(snapshot);
  expect(result.ready).toBe(true);
});
