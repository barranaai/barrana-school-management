const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { integrationUri, assertTopology, DATABASE } = require('../../config/integrationDatabase');

// Use only in a dedicated node --test child process. Models are rebound in that process,
// never in the running development server. No automatic setup/cleanup on import.
async function openIntegrationHarness() {
  const uri = integrationUri(); // Must fail before connecting or importing routes.
  if (mongoose.connection.readyState !== 0 || mongoose.modelNames().length) throw Error('Integration harness requires a fresh process with no application models/connection');
  mongoose.set('autoIndex', false); mongoose.set('autoCreate', false);
  const connection = mongoose.createConnection(uri, { autoIndex: false, autoCreate: false, bufferCommands: false, serverSelectionTimeoutMS: 5000 });
  try {
    await connection.asPromise();
    async function verify() {
      integrationUri();
      if (connection.name !== DATABASE || connection.readyState !== 1) throw Error('Isolated test connection is unavailable');
      assertTopology(await connection.db.admin().command({ hello: 1 }));
    }
    await verify(); // Read-only topology verification precedes all model/index work.
    process.env.JWT_SECRET = randomUUID(); // Only this isolated test process signs these tokens.
    const app = require('../../app').createApp({ routes: [
      ['/api/config', 'configuration'], ['/api/roadmaps', 'roadmaps'],
      ['/api/roadmaps', 'plannedSessions'], ['/api/planned-sessions', 'plannedSessions'],
      ['/api/delivered-sessions', 'deliveredSessions'], ['/api/enrollments', 'enrollments'],
      ['/api/child-participations', 'childParticipations'], ['/api/progress', 'progress'],
      ['/api/standard-packages', 'standardPackages'], ['/api/onboarding', 'onboarding']
    ] });
    app.initializeRoutes();
    require('../../models/School'); // Referenced by User/fixtures but not imported by scoped routes.
    const models = {};
    for (const name of mongoose.modelNames()) {
      const model = mongoose.model(name);
      model.useConnection(connection);
      models[name] = model;
    }
    // Explicit opt-in index preparation, only after all guards pass. Never syncIndexes().
    async function ensureIndexes() {
      await verify();
      for (const model of Object.values(models)) {
        if (model.db !== connection) throw Error('Model escaped isolated connection');
        await model.createCollection();
        await model.createIndexes();
      }
    }
    return { app, connection, models, verify, ensureIndexes, runId: randomUUID(), close: () => connection.close() };
  } catch (error) { await connection.close(); throw error; }
}
module.exports = { openIntegrationHarness };
