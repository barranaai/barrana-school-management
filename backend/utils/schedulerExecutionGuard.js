const { logger: defaultLogger } = require('./logger');

// This guard prevents overlap only inside one Node process. Cross-process
// exclusion requires a separately reviewed distributed lease or atomic job claim.
function createNonOverlappingTask(jobName, task, { logger = defaultLogger } = {}) {
  let running = false;

  return async (...args) => {
    if (running) {
      logger.warn('Scheduled job overlap skipped', {
        job: jobName,
        code: 'SCHEDULER_JOB_OVERLAP_SKIPPED'
      });
      return { skipped: true, reason: 'already_running' };
    }

    running = true;
    try {
      return await task(...args);
    } finally {
      running = false;
    }
  };
}

function scheduleNonOverlapping(cron, expression, jobName, task) {
  return cron.schedule(expression, createNonOverlappingTask(jobName, task));
}

module.exports = { createNonOverlappingTask, scheduleNonOverlapping };
