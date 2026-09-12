// Only the authenticated approval route creates this finalized snapshot.
// A draft carrying a snapshot is still not parent-visible.
const canExposeProgressReport = report => Boolean(
  report && ['approved', 'sent'].includes(report.status) &&
  /^[a-f0-9]{24}$/i.test(String(report.finalizedSnapshot?.finalizedBy || '')) &&
  report.finalizedSnapshot?.finalizedAt && Number.isFinite(new Date(report.finalizedSnapshot.finalizedAt).getTime()) &&
  (report.finalizedSnapshot.attachments == null || Array.isArray(report.finalizedSnapshot.attachments)) &&
  typeof report.finalizedSnapshot?.parentVisibleContent === 'string' &&
  typeof report.finalizedSnapshot?.reportMetadata?.title === 'string'
);

function finalizedParentContent(report) {
  if (!canExposeProgressReport(report)) throw new Error('Report is not finalized');
  const snapshot = report.finalizedSnapshot;
  // Never fall back to mutable report content, even for an empty approved value.
  return {
    title: snapshot.reportMetadata.title,
    reportType: snapshot.reportMetadata.reportType,
    reportPeriod: snapshot.reportMetadata.reportPeriod,
    content: snapshot.parentVisibleContent,
    customFieldValues: snapshot.customFieldValues || {},
    attachments: (snapshot.attachments || []).map(a => ({
      filename: a.filename, originalName: a.originalName, mimeType: a.mimeType,
      size: a.size, url: a.url, uploadedAt: a.uploadedAt
    }))
  };
}

module.exports = { canExposeProgressReport, finalizedParentContent };
