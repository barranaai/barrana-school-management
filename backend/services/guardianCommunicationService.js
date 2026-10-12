const User = require('../models/User');
const { authorizeGuardianParticipant } = require('./guardianAccessService');
const { teacherCanCommunicateWithParticipant } = require('./teacherCommunicationAuthorization');

const sid = value => String(value?._id || value || '');
const studentId = conversation => conversation?.metadata?.studentId;

function conversationLookup(schoolId, senderId, recipientId, participantId) {
  return {
    schoolId,
    'participants.userId': { $all: [senderId, recipientId] },
    ...(participantId ? { 'metadata.studentId': participantId } : { 'metadata.studentId': { $exists: false } }),
    isActive: true
  };
}

async function guardianCanUseConversation(user, conversation, dependencies = {}) {
  if (user?.role !== 'parent' || !studentId(conversation)) return true;
  const authorize = dependencies.authorizeGuardianParticipant || authorizeGuardianParticipant;
  return Boolean((await authorize(user, studentId(conversation), 'communication', { allowInactiveParticipant: true })).allowed);
}

async function userCanUseConversation(user, conversation, dependencies = {}) {
  if (!user || !conversation || sid(user.schoolId) !== sid(conversation.schoolId)) return false;
  if (user.role === 'teacher') {
    if (!studentId(conversation)) return false;
    const authorizeTeacher = dependencies.teacherCanCommunicateWithParticipant || teacherCanCommunicateWithParticipant;
    return Boolean(await authorizeTeacher(user, studentId(conversation), dependencies));
  }
  return guardianCanUseConversation(user, conversation, dependencies);
}

async function conversationCanDeliver(conversation, dependencies = {}) {
  if (!studentId(conversation)) return true;
  const parentParticipant = conversation?.participants?.find(item => item.role === 'parent');
  if (!parentParticipant) return false;
  const findGuardian = dependencies.findGuardian || (query => User.findOne(query));
  const guardian = await findGuardian({
    _id: parentParticipant.userId?._id || parentParticipant.userId,
    schoolId: conversation.schoolId,
    role: 'parent',
    isActive: { $ne: false }
  });
  if (!guardian || sid(guardian.schoolId) !== sid(conversation.schoolId)) return false;
  const authorize = dependencies.authorizeGuardianParticipant || authorizeGuardianParticipant;
  return Boolean((await authorize(guardian, studentId(conversation), 'communication', { allowInactiveParticipant: true })).allowed);
}

async function authorizeScheduledMessageDelivery(message, dependencies = {}) {
  const conversation = message?.conversationId;
  const canDeliver = dependencies.conversationCanDeliver || conversationCanDeliver;
  if (!conversation || await canDeliver(conversation, dependencies)) return true;
  message.isScheduled = false;
  message.deliveryBlockedAt = new Date();
  message.deliveryBlockReason = 'guardian_communication_not_authorized';
  await message.save();
  return false;
}

module.exports = { conversationLookup, guardianCanUseConversation, userCanUseConversation, conversationCanDeliver, authorizeScheduledMessageDelivery };
