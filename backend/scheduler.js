// Dedicated scheduler runtime. Web processes never own background schedules.
async function startSchedulerWorker() {
  require('dotenv').config({ path: './config.env' });
  const { logger } = require('./utils/logger');

  if (process.env.RUNTIME_ROLE !== 'scheduler') {
    const error = new Error('Scheduler worker requires RUNTIME_ROLE=scheduler');
    error.code = 'INVALID_RUNTIME_ROLE';
    throw error;
  }

  await require('./config/database')();
  const { startSchedulers } = require('./server');
  if (!startSchedulers(process.env)) {
    const error = new Error('Scheduler worker is not enabled');
    error.code = 'SCHEDULER_DISABLED';
    throw error;
  }

  logger.info('Scheduler worker ready');
  return true;
}

if (require.main === module) startSchedulerWorker().catch(() => {
  require('./utils/logger').logger.error('Scheduler startup aborted', { code: 'SCHEDULER_STARTUP_FAILED' });
  process.exitCode = 1;
});

module.exports = { startSchedulerWorker };
