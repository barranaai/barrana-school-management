const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { validateDefinition } = require('../services/standardPackageService');

function loadBlueprints() {
  const filename = path.resolve(__dirname, '../../src/domain/activityPackageBlueprints.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(output, filename);
  return compiled.exports.activityPackageBlueprints;
}

const blueprints = loadBlueprints();
const copy = value => JSON.parse(JSON.stringify(value));

test('all activity starter definitions pass the real Standard Package validator', () => {
  assert.deepEqual(blueprints.map(item => item.slug), [
    'swimming-foundation', 'karate-foundation', 'gymnastics-foundation',
    'dance-foundation', 'montessori-foundation'
  ]);
  for (const blueprint of blueprints) {
    assert.doesNotThrow(() => validateDefinition(blueprint.definition), blueprint.slug);
  }
});

test('real validation rejects broken starter relationships and required session configuration', () => {
  for (const blueprint of blueprints) {
    const brokenRelationship = copy(blueprint.definition);
    brokenRelationship.programs[0].roadmaps[0].plannedSessions[0].objectives[0].requirementKey = 'missing-requirement';
    assert.throws(() => validateDefinition(brokenRelationship), /Objective requirement reference is invalid/, blueprint.slug);

    const missingSessionTitle = copy(blueprint.definition);
    delete missingSessionTitle.programs[0].roadmaps[0].plannedSessions[0].title;
    assert.throws(() => validateDefinition(missingSessionTitle), /Planned Session title and positive sequence are required/, blueprint.slug);
  }
  assert.throws(() => validateDefinition({ programs: [] }), /at least one program/);
});
