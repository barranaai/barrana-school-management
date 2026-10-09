const test = require('node:test');
const assert = require('node:assert/strict');
const { isDeliveredParentReport, canGuardianReadReport } = require('../services/guardianReportAccessService');

const finalized = {
  finalizedBy: '000000000000000000000001',
  finalizedAt: new Date('2026-01-01T00:00:00.000Z'),
  parentVisibleContent: 'Parent-visible progress',
  attachments: [],
  reportMetadata: { title: 'Progress report' }
};
const report = (changes = {}) => ({
  status: 'sent',
  progressId: '000000000000000000000002',
  studentId: { _id: '000000000000000000000003' },
  finalizedSnapshot: finalized,
  ...changes
});

test('only delivered reports are parent-visible', () => {
  assert.equal(isDeliveredParentReport(report()), true);
  assert.equal(isDeliveredParentReport(report({ status: 'approved' })), false);
  assert.equal(isDeliveredParentReport(report({ status: 'draft' })), false);
  assert.equal(isDeliveredParentReport(report({ finalizedSnapshot: null })), false);
  assert.equal(isDeliveredParentReport(report({ progressId: undefined, finalizedSnapshot: undefined })), true);
});

test('report access requires the report permission on an active relationship', async () => {
  const calls = [];
  const allowed = async (guardian, participant, permission) => {
    calls.push({ guardian, participant, permission });
    return { allowed: true };
  };
  assert.equal(await canGuardianReadReport({ _id: 'guardian' }, report(), allowed), true);
  assert.equal(calls[0].permission, 'reports');
  assert.equal(await canGuardianReadReport({ _id: 'guardian' }, report(), async () => ({ allowed: false })), false);
});

test('relationship permission cannot expose draft, approved, or malformed finalized reports', async () => {
  let relationshipChecks = 0;
  const allowed = async () => { relationshipChecks += 1; return { allowed: true }; };
  for (const candidate of [
    report({ status: 'draft' }),
    report({ status: 'approved' }),
    report({ finalizedSnapshot: { ...finalized, finalizedBy: null } }),
    report({ studentId: null })
  ]) assert.equal(await canGuardianReadReport({}, candidate, allowed), false);
  assert.equal(relationshipChecks, 0);
});
