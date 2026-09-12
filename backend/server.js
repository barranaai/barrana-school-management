// Runtime entry point. Importing this module does not start the application.
function startSchedulers() {
  const { logger } = require('./utils/logger');
  if (process.env.ENABLE_SCHEDULERS !== 'true') { logger.info('Background schedulers disabled'); return; }
  const jobs = require('./services/reminderScheduler');
  jobs.initializeReminderScheduler(); jobs.initializePDFCleanup();
  jobs.initializeScheduledMessageProcessor(); jobs.initializeDueReportChecker();
  require('./services/meetingReminderScheduler').initializeMeetingReminderScheduler();
}
function startServer() {
  require('dotenv').config({ path: './config.env' });
  const { logger } = require('./utils/logger');
  const app = require('./app').createApp();
  // Preserve normal startup initialization; tests never call this entry point.
  app.initializeRoutes();
  const server = require('http').createServer(app);
  require('./services/socketService').initialize(server);
  require('./config/database')();
  const port = process.env.PORT || 3001;
  server.listen(port, '0.0.0.0', () => {
    logger.info('Barrana.ai Backend Server running on port ' + port);
    startSchedulers();
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    logger.info(signal + ' received, shutting down gracefully'); process.exit(0);
  });
  return { app, server };
}
if (require.main === module) startServer();
module.exports = { startServer, startSchedulers };
