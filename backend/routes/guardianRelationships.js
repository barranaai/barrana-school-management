const express = require('express');
const mongoose = require('mongoose');
const crypto = require('node:crypto');
const { protect, authorize } = require('../middleware/auth');
const { requireActiveOrganization } = require('../middleware/lifecycleAuthorization');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const User = require('../models/User');
const GuardianParticipantRelationship = require('../models/GuardianParticipantRelationship');
const { sendEmail } = require('../utils/email');

const router = express.Router();
const TYPES = ['parent', 'legal_guardian', 'caregiver', 'other'];
const PERMISSIONS = ['canViewProfile', 'canViewReports', 'canReceiveCommunications', 'canManageMeetings', 'canViewIncidents'];
const context = (req, res) => {
  const schoolId = scopeSchoolId(req.user, req.query.schoolId || req.body?.schoolId);
  if (!schoolId) res.status(400).json({ success: false, message: 'An organization must be selected' });
  return schoolId;
};
const safe = row => ({
  _id: row._id, schoolId: row.schoolId, guardian: row.guardianId, participantId: row.participantId,
  relationshipType: row.relationshipType, isPrimaryContact: row.isPrimaryContact, status: row.status,
  permissions: row.permissions, activatedAt: row.activatedAt, revokedAt: row.revokedAt,
  revocationReason: row.revocationReason, createdAt: row.createdAt, updatedAt: row.updatedAt
});
const populate = query => query.populate('guardianId', 'firstName lastName email phone phoneNumber isActive role').populate('participantId', 'firstName lastName studentId isActive role');
const validateParties = async row => {
  const [guardian, participant] = await Promise.all([
    User.findOne({ _id: row.guardianId, schoolId: row.schoolId, role: 'parent', isActive: { $ne: false } }),
    User.findOne({ _id: row.participantId, schoolId: row.schoolId, role: 'student', isActive: { $ne: false } })
  ]);
  return guardian && participant ? { guardian, participant } : null;
};
const switchPrimary = async (row, actorId) => {
  const query = { schoolId: row.schoolId, participantId: row.participantId, status: 'active', isPrimaryContact: true, _id: { $ne: row._id } };
  const previous = await GuardianParticipantRelationship.findOne(query);
  if (previous) await GuardianParticipantRelationship.updateOne({ _id: previous._id, isPrimaryContact: true }, { $set: { isPrimaryContact: false, updatedBy: actorId } });
  try {
    row.isPrimaryContact = true;
    row.updatedBy = actorId;
    await row.save();
  } catch (error) {
    if (previous) await GuardianParticipantRelationship.updateOne({ _id: previous._id, isPrimaryContact: false }, { $set: { isPrimaryContact: true, updatedBy: actorId } });
    throw error;
  }
};
const sendGuardianSetup = async guardian => {
  const token = guardian.generatePasswordResetToken();
  await guardian.save();
  await sendEmail({
    email: guardian.email,
    subject: 'Set up your Kidsible guardian account',
    template: 'passwordReset',
    data: { name: guardian.firstName, resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}` }
  });
};

router.use(protect, authorize('school_admin', 'super_admin'));

router.get('/guardians/search', async (req, res) => {
  const schoolId = context(req, res); if (!schoolId) return;
  const q = String(req.query.q || '').trim();
  const filter = { schoolId, role: 'parent' };
  if (q) filter.$or = ['firstName', 'lastName', 'email'].map(field => ({ [field]: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }));
  const users = await User.find(filter).select('firstName lastName email phone phoneNumber isActive').limit(25).lean();
  res.json({ success: true, data: users });
});

router.get('/participant/:participantId', async (req, res) => {
  try {
    const schoolId = context(req, res); if (!schoolId) return;
    const participant = await User.findOne({ _id: req.params.participantId, schoolId, role: 'student' }).select('_id parentId parentName parentEmail parentPhone');
    if (!participant) return res.status(404).json({ success: false, message: 'Participant not found' });
    const rows = await populate(GuardianParticipantRelationship.find({ schoolId, participantId: participant._id }).sort({ isPrimaryContact: -1, createdAt: 1 }));
    res.json({ success: true, data: rows.map(safe), legacy: rows.length ? null : {
      parentId: participant.parentId, parentName: participant.parentName, parentEmail: participant.parentEmail, parentPhone: participant.parentPhone
    } });
  } catch (_) { res.status(404).json({ success: false, message: 'Participant not found' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const schoolId = context(req, res); if (!schoolId) return;
    const row = await populate(GuardianParticipantRelationship.findOne({ _id: req.params.id, schoolId }));
    if (!row) return res.status(404).json({ success: false, message: 'Relationship not found' });
    res.json({ success: true, data: safe(row) });
  } catch (_) { res.status(404).json({ success: false, message: 'Relationship not found' }); }
});

router.post('/', requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = context(req, res); if (!schoolId) return;
    const { participantId, guardianId, relationshipType, isPrimaryContact = false } = req.body;
    if (!mongoose.isValidObjectId(participantId) || !mongoose.isValidObjectId(guardianId) || !TYPES.includes(relationshipType)) {
      return res.status(400).json({ success: false, message: 'Valid participant, guardian, and relationship type are required' });
    }
    const pending = req.body.status === 'pending';
    const guardianFilter = { _id: guardianId, schoolId, role: 'parent' };
    const participantFilter = { _id: participantId, schoolId, role: 'student' };
    if (!pending) {
      guardianFilter.isActive = { $ne: false };
      participantFilter.isActive = { $ne: false };
    }
    const [participant, guardian] = await Promise.all([
      User.findOne(participantFilter),
      User.findOne(guardianFilter)
    ]);
    if (!participant || !guardian) return res.status(404).json({ success: false, message: 'Participant or guardian not found' });
    if (await GuardianParticipantRelationship.exists({ schoolId, participantId, guardianId })) return res.status(409).json({ success: false, message: 'This guardian relationship already exists' });
    const permissions = {};
    for (const key of PERMISSIONS) if (typeof req.body.permissions?.[key] === 'boolean') permissions[key] = req.body.permissions[key];
    let row = await GuardianParticipantRelationship.create({ schoolId, participantId, guardianId, relationshipType,
      isPrimaryContact: false, status: pending ? 'pending' : 'active', permissions,
      activatedAt: pending ? undefined : new Date(), createdBy: req.user._id, updatedBy: req.user._id,
      lifecycleHistory: [{ toStatus: pending ? 'pending' : 'active', changedBy: req.user._id }]
    });
    if (isPrimaryContact && row.status === 'active') {
      await switchPrimary(row, req.user._id);
    }
    row = await populate(GuardianParticipantRelationship.findById(row._id));
    res.status(201).json({ success: true, data: safe(row) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'This relationship or primary contact already exists' });
    res.status(500).json({ success: false, message: 'Unable to create guardian relationship' });
  }
});

router.post('/guardians', requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = context(req, res); if (!schoolId) return;
    const firstName = String(req.body.firstName || '').trim(), lastName = String(req.body.lastName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ success: false, message: 'Name and valid email are required' });
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.role !== 'parent' || String(existing.schoolId) !== String(schoolId)) return res.status(409).json({ success: false, message: 'That email is already in use' });
      if (!existing.isEmailVerified) await sendGuardianSetup(existing);
      return res.json({ success: true, data: { _id: existing._id, firstName: existing.firstName, lastName: existing.lastName, email: existing.email, isActive: existing.isActive }, existing: true, invitationSent: !existing.isEmailVerified });
    }
    const guardian = await User.create({ firstName, lastName, email, phone: req.body.phone || undefined,
      password: crypto.randomBytes(48).toString('base64url'), role: 'parent', schoolId, isActive: true, isEmailVerified: false });
    await sendGuardianSetup(guardian);
    res.status(201).json({ success: true, data: { _id: guardian._id, firstName, lastName, email, isActive: guardian.isActive }, invitationSent: true });
  } catch (_) { res.status(500).json({ success: false, message: 'Unable to prepare guardian account' }); }
});

router.patch('/:id', requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = context(req, res); if (!schoolId) return;
    const row = await GuardianParticipantRelationship.findOne({ _id: req.params.id, schoolId });
    if (!row) return res.status(404).json({ success: false, message: 'Relationship not found' });
    if (req.body.relationshipType !== undefined) {
      if (!TYPES.includes(req.body.relationshipType)) return res.status(400).json({ success: false, message: 'Invalid relationship type' });
      row.relationshipType = req.body.relationshipType;
    }
    for (const key of PERMISSIONS) if (typeof req.body.permissions?.[key] === 'boolean') row.permissions[key] = req.body.permissions[key];
    if (req.body.isPrimaryContact === true) {
      if (row.status !== 'active') return res.status(400).json({ success: false, message: 'Only an active relationship can be primary' });
      await switchPrimary(row, req.user._id);
    } else if (req.body.isPrimaryContact === false) row.isPrimaryContact = false;
    row.updatedBy = req.user._id; await row.save();
    const populated = await populate(GuardianParticipantRelationship.findById(row._id));
    res.json({ success: true, data: safe(populated) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: 'A primary contact already exists' });
    res.status(500).json({ success: false, message: 'Unable to update guardian relationship' });
  }
});

router.post('/:id/activate', requireActiveOrganization, async (req, res) => {
  const schoolId = context(req, res); if (!schoolId) return;
  const row = await GuardianParticipantRelationship.findOne({ _id: req.params.id, schoolId });
  if (!row) return res.status(404).json({ success: false, message: 'Relationship not found' });
  if (!await validateParties(row)) return res.status(409).json({ success: false, message: 'Relationship can no longer be activated' });
  const previous = row.status;
  row.status = 'active'; row.activatedAt = new Date(); row.revokedAt = undefined; row.revokedBy = undefined; row.revocationReason = undefined; row.updatedBy = req.user._id;
  row.lifecycleHistory.push({ fromStatus: previous, toStatus: 'active', changedBy: req.user._id });
  await row.save(); res.json({ success: true, data: safe(await populate(GuardianParticipantRelationship.findById(row._id))) });
});

router.post('/:id/revoke', requireActiveOrganization, async (req, res) => {
  const schoolId = context(req, res); if (!schoolId) return;
  const row = await GuardianParticipantRelationship.findOne({ _id: req.params.id, schoolId });
  if (!row) return res.status(404).json({ success: false, message: 'Relationship not found' });
  const previous = row.status;
  row.status = 'revoked'; row.isPrimaryContact = false; row.revokedAt = new Date(); row.revokedBy = req.user._id;
  row.revocationReason = String(req.body.reason || '').trim() || undefined; row.updatedBy = req.user._id;
  row.lifecycleHistory.push({ fromStatus: previous, toStatus: 'revoked', changedBy: req.user._id, reason: row.revocationReason });
  await row.save(); res.json({ success: true, data: safe(await populate(GuardianParticipantRelationship.findById(row._id))) });
});

module.exports = router;
