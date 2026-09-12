// Real transaction-test foundation: caller must explicitly open/close the guarded harness.
const { openIntegrationHarness } = require('./integrationHarness');
const { randomUUID } = require('node:crypto');
async function prepareRoadmapIndexes(harness) {
  await harness.verify();
  for (const name of ['School', 'User', 'Program', 'Level', 'Roadmap']) {
    const model = harness.models[name];
    if (model.db !== harness.connection) throw Error('Model escaped isolated connection');
    await model.createCollection();
  }
  // Use the production Roadmap declarations only; prerequisite secondary indexes
  // are unrelated to these lifecycle tests and must not be synchronized here.
  await harness.models.Roadmap.createIndexes();
}
async function openRoadmapIntegration() {
  const harness = await openIntegrationHarness();
  return { ...harness,
    async createScenario(onSchoolCreated = () => {}) {
      await harness.verify();
      const { School, User, Program, Level, Roadmap } = harness.models;
      const key = randomUUID();
      const school = await School.create({ name: 'Integration ' + key, slug: 'integration-' + key, schoolType: 'montessori_school', estimatedStudents: 1,
        address: { street: '1 Test Street', city: 'Test', state: 'ON', zipCode: 'A1A 1A1', country: 'Canada' }, contactPerson: { name: 'Test Admin', email: key + '@example.invalid' } });
      onSchoolCreated(school); // Register ownership before later setup can fail.
      const admin = await User.create({ firstName: 'Test', lastName: 'Admin', email: key + '@example.invalid', password: randomUUID(), role: 'school_admin', schoolId: school._id, isEmailVerified: true });
      const program = await Program.create({ schoolId: school._id, name: 'Test Swimming' });
      const level = await Level.create({ schoolId: school._id, programId: program._id, name: 'Test Water Confidence', sequence: 1 });
      const createDraft = version => Roadmap.create({ schoolId: school._id, programId: program._id, levelId: level._id, name: 'Test roadmap ' + version, version, status: 'draft', createdBy: admin._id, updatedBy: admin._id });
      return { school, admin, program, level, createDraft, token: admin.generateAuthToken() };
    }
  };
}
module.exports = { openRoadmapIntegration, prepareRoadmapIndexes };
