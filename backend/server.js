// Runtime entry point. Importing this module does not start the application.
function startSchedulers(env = process.env) {
  const { logger } = require('./utils/logger');
  if (env.ENABLE_SCHEDULERS !== 'true') { logger.info('Background schedulers disabled'); return false; }
  if (env.RUNTIME_ROLE !== 'scheduler') {
    logger.warn('Background schedulers refused: this process is not the scheduler owner');
    return false;
  }
  const jobs = require('./services/reminderScheduler');
  jobs.initializeReminderScheduler(); jobs.initializePDFCleanup();
  jobs.initializeScheduledMessageProcessor(); jobs.initializeDueReportChecker();
  require('./services/meetingReminderScheduler').initializeMeetingReminderScheduler();
  logger.info('Background schedulers started by the scheduler worker');
  return true;
}
async function startServer() {
  require('dotenv').config({ path: './config.env' });
  const { logger } = require('./utils/logger');
  // Fail closed before opening an HTTP listener. A live process without its
  // tenant database is not a usable Kidsible API instance.
  await require('./config/database')();
  const app = require('./app').createApp();
  // Preserve normal startup initialization; tests never call this entry point.
  app.initializeRoutes();
  const server = require('http').createServer(app);
  require('./services/socketService').initialize(server);
  const port = process.env.PORT || 3001;
  await new Promise((resolve, reject) => {
    server.once?.('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  logger.info('Barrana.ai Backend Server running on port ' + port);
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    logger.info(signal + ' received, shutting down gracefully'); process.exit(0);
  });
  return { app, server };
}
if (require.main === module) startServer().catch(() => {
  require('./utils/logger').logger.error('Backend startup aborted', { code: 'RUNTIME_STARTUP_FAILED' });
  process.exitCode = 1;
});
module.exports = { startServer, startSchedulers };
