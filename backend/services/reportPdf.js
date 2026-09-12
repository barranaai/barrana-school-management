const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { finalizedParentContent } = require('../utils/reportPublication');
const { generateReportPDF } = require('./pdfService');

// Retained artifacts are separate from temporary PDFs; never expose this root.
const root = path.resolve(__dirname, '../uploads/pdfs/reports');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) value = Object.fromEntries(value);
  if (value && typeof value.toJSON === 'function') value = value.toJSON();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function sourceHash(report) {
  const content = report.progressId ? finalizedParentContent(report) : { title: report.title, content: report.content };
  return digest(JSON.stringify(canonical({ reportId: String(report._id), schoolId: String(report.schoolId?._id || report.schoolId), finalizedAt: report.finalizedSnapshot?.finalizedAt, content })));
}
function pdfValid(bytes) {
  return bytes.subarray(0, 5).toString() === '%PDF-' && /%%EOF\s*$/.test(bytes.subarray(-1024).toString());
}
async function readKey(key) {
  if (typeof key !== 'string' || !/^[a-f0-9-]{36}\.pdf$/.test(key)) throw new Error('PDF unavailable');
  const file = path.join(root, key);
  const [base, real, stat] = await Promise.all([fs.realpath(root), fs.realpath(file), fs.lstat(file)]);
  if (!stat.isFile() || stat.isSymbolicLink() || path.dirname(real) !== base) throw new Error('PDF unavailable');
  const bytes = await fs.readFile(real);
  if (!pdfValid(bytes)) throw new Error('PDF unavailable');
  return bytes;
}
async function readReportPdf(report) {
  try {
    const artifact = report.pdfArtifact;
    if (!artifact || artifact.sourceHash !== sourceHash(report)) throw new Error('PDF unavailable');
    const bytes = await readKey(artifact.key);
    if (digest(bytes) !== artifact.sha256) throw new Error('PDF unavailable');
    return bytes;
  } catch (_) { throw Object.assign(new Error('PDF missing, corrupt or unverified; authorized regeneration is required'), { code: 'PDF_UNAVAILABLE' }); }
}
async function createReportPdf(report, emailData) {
  const key = `${crypto.randomUUID()}.pdf`;
  // The caller builds emailData from the approved snapshot. Override content here too.
  const approved = report.progressId ? finalizedParentContent(report) : null;
  await generateReportPDF({ ...emailData,
    ...(approved ? { reportTitle: approved.title, reportContent: approved.content, reportDate: new Date(report.finalizedSnapshot.finalizedAt).toISOString().slice(0, 10) } : {}),
    filename: key, outputDir: 'uploads/pdfs/reports' });
  const bytes = await readKey(key);
  const artifact = { key, sha256: digest(bytes), sourceHash: sourceHash(report) };
  return { filename: 'report.pdf', bytes, artifact };
}
module.exports = { createReportPdf, readReportPdf, sourceHash };
