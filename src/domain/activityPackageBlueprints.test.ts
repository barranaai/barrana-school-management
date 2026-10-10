import { activityPackageBlueprints, copyActivityPackageBlueprint } from './activityPackageBlueprints';

test('provides five complete editable child-development activity starters', () => {
  expect(activityPackageBlueprints.map(item => item.slug)).toEqual([
    'swimming-foundation',
    'karate-foundation',
    'gymnastics-foundation',
    'dance-foundation',
    'montessori-foundation'
  ]);

  for (const blueprint of activityPackageBlueprints) {
    expect(blueprint.organizationTypes.length).toBeGreaterThan(0);
    expect(blueprint.definition.programs.length).toBeGreaterThan(0);
    for (const program of blueprint.definition.programs) {
      expect(program.levels.length).toBeGreaterThanOrEqual(2);
      expect(program.roadmaps).toHaveLength(program.levels.length);
      for (const level of program.levels) {
        expect(level.requirements.length).toBeGreaterThanOrEqual(2);
        level.requirements.forEach(requirement => expect(requirement.parameters.length).toBeGreaterThan(0));
        const roadmap = program.roadmaps.find(item => item.levelKey === level.key);
        expect(roadmap?.plannedSessions.length).toBeGreaterThanOrEqual(2);
        roadmap?.plannedSessions.forEach(session => {
          expect(session.objectives.length).toBeGreaterThan(0);
          session.objectives.forEach(objective => {
            const requirement = level.requirements.find(item => item.key === objective.requirementKey);
            expect(requirement).toBeDefined();
            expect(requirement?.parameters.some(item => item.key === objective.parameterKey)).toBe(true);
          });
        });
      }
    }
  }
});

test('uses activity-appropriate assessment types instead of one universal score', () => {
  const typesBySlug = Object.fromEntries(activityPackageBlueprints.map(blueprint => [
    blueprint.slug,
    new Set(blueprint.definition.programs.flatMap(program => program.levels.flatMap(level =>
      level.requirements.flatMap(requirement => requirement.parameters.map(parameter => parameter.type))
    )))
  ]));

  expect(typesBySlug['swimming-foundation']).toEqual(new Set(['checkbox', 'number', 'rating']));
  expect(typesBySlug['karate-foundation']).toEqual(new Set(['checkbox', 'rating', 'select']));
  expect(typesBySlug['gymnastics-foundation']).toEqual(new Set(['rating', 'checkbox', 'number', 'select']));
  expect(typesBySlug['dance-foundation']).toEqual(new Set(['rating', 'text', 'select']));
  expect(typesBySlug['montessori-foundation']).toEqual(new Set(['checkbox', 'number', 'percentage', 'text']));
});

test('returns an independent copy so editing a starter cannot mutate the original', () => {
  const copy = copyActivityPackageBlueprint('dance-foundation');
  expect(copy).toBeDefined();
  copy!.definition.programs[0].name = 'Organization-specific Dance';
  expect(activityPackageBlueprints.find(item => item.slug === 'dance-foundation')?.definition.programs[0].name)
    .toBe('Dance Foundations');
});
