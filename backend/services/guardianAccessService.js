const User = require('../models/User');
const GuardianParticipantRelationship = require('../models/GuardianParticipantRelationship');

const PERMISSION_FIELDS = Object.freeze({
  profile: 'canViewProfile', reports: 'canViewReports', communication: 'canReceiveCommunications',
  meetings: 'canManageMeetings', incidents: 'canViewIncidents'
});
const sid = value => String(value?._id || value || '');
const email = value => String(value || '').trim().toLowerCase();

async function relationshipState(guardian, participant, permission = 'profile') {
  if (!guardian || guardian.role !== 'parent' || guardian.isActive === false) return { allowed: false };
  if (!participant || participant.role !== 'student') return { allowed: false };
  if (!sid(guardian.schoolId) || sid(guardian.schoolId) !== sid(participant.schoolId)) return { allowed: false };
  const relationships = await GuardianParticipantRelationship.find({
    schoolId: participant.schoolId,
    participantId: participant._id
  });
  if (relationships.length) {
    const relationship = relationships.find(row => sid(row.guardianId) === sid(guardian._id));
    const field = PERMISSION_FIELDS[permission];
    return {
      allowed: Boolean(relationship && relationship.status === 'active' && (!field || relationship.permissions?.[field] === true)),
      relationship: relationship || null,
      legacy: false
    };
  }
  const legacy = sid(participant.parentId) === sid(guardian._id)
    || (email(participant.parentEmail) && email(participant.parentEmail) === email(guardian.email));
  return { allowed: legacy, relationship: null, legacy: true };
}

async function authorizeGuardianParticipant(guardian, participantId, permission = 'profile', { allowInactiveParticipant = false } = {}) {
  const participant = await User.findOne({ _id: participantId, role: 'student', schoolId: guardian?.schoolId });
  if (!participant || (!allowInactiveParticipant && participant.isActive === false)) return { allowed: false, participant: null };
  return { ...(await relationshipState(guardian, participant, permission)), participant };
}

async function authorizedParticipants(guardian, permission = 'profile', { includeInactive = false } = {}) {
  if (!guardian || guardian.role !== 'parent' || guardian.isActive === false || !guardian.schoolId) return [];
  const managed = await GuardianParticipantRelationship.find({ schoolId: guardian.schoolId, guardianId: guardian._id });
  const managedParticipantIds = await GuardianParticipantRelationship.distinct('participantId', { schoolId: guardian.schoolId });
  const field = PERMISSION_FIELDS[permission];
  const relationshipIds = managed
    .filter(row => row.status === 'active' && (!field || row.permissions?.[field] === true))
    .map(row => row.participantId);
  const legacyQuery = {
    schoolId: guardian.schoolId, role: 'student', _id: { $nin: managedParticipantIds },
    $or: [{ parentId: guardian._id }, ...(guardian.email ? [{ parentEmail: email(guardian.email) }] : [])]
  };
  if (!includeInactive) legacyQuery.isActive = { $ne: false };
  const [related, legacy] = await Promise.all([
    relationshipIds.length ? User.find({ _id: { $in: relationshipIds }, schoolId: guardian.schoolId, role: 'student', ...(!includeInactive ? { isActive: { $ne: false } } : {}) }) : [],
    User.find(legacyQuery)
  ]);
  return [...related, ...legacy];
}

async function eligibleGuardians(participantId, permission = 'communication') {
  const participant = await User.findOne({ _id: participantId, role: 'student' });
  if (!participant) return [];
  const rows = await GuardianParticipantRelationship.find({ schoolId: participant.schoolId, participantId: participant._id });
  const field = PERMISSION_FIELDS[permission];
  if (rows.length) {
    const ids = rows.filter(row => row.status === 'active' && (!field || row.permissions?.[field] === true)).map(row => row.guardianId);
    return User.find({ _id: { $in: ids }, schoolId: participant.schoolId, role: 'parent', isActive: { $ne: false }, email: { $exists: true, $ne: '' } });
  }
  const legacyMatches = [
    ...(participant.parentId ? [{ _id: participant.parentId }] : []),
    ...(participant.parentEmail ? [{ email: email(participant.parentEmail) }] : [])
  ];
  if (!legacyMatches.length) return [];
  return User.find({ schoolId: participant.schoolId, role: 'parent', isActive: { $ne: false }, $or: legacyMatches });
}

async function eligibleGuardiansForAll(participantId, permissions = []) {
  const participant = await User.findOne({ _id: participantId, role: 'student' });
  if (!participant) return [];
  const rows = await GuardianParticipantRelationship.find({ schoolId: participant.schoolId, participantId: participant._id });
  if (!rows.length) return eligibleGuardians(participantId, permissions[0] || 'communication');
  const fields = permissions.map(value => PERMISSION_FIELDS[value]).filter(Boolean);
  const ids = rows.filter(row => row.status === 'active' && fields.every(field => row.permissions?.[field] === true)).map(row => row.guardianId);
  return User.find({ _id: { $in: ids }, schoolId: participant.schoolId, role: 'parent', isActive: { $ne: false }, email: { $exists: true, $ne: '' } });
}

module.exports = { PERMISSION_FIELDS, relationshipState, authorizeGuardianParticipant, authorizedParticipants, eligibleGuardians, eligibleGuardiansForAll };
