const { canExposeProgressReport } = require('../utils/reportPublication');
const { relationshipState } = require('./guardianAccessService');

function isDeliveredParentReport(report) {
  if (!report || report.status !== 'sent') return false;
  return !report.progressId || canExposeProgressReport(report);
}

async function canGuardianReadReport(guardian, report, resolveRelationship = relationshipState) {
  if (!isDeliveredParentReport(report) || !report.studentId) return false;
  return Boolean((await resolveRelationship(guardian, report.studentId, 'reports')).allowed);
}

module.exports = { isDeliveredParentReport, canGuardianReadReport };
