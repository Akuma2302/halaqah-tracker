const studyGroupRepository = require('../repositories/studyGroupRepository');
const messageRepository = require('../repositories/messageRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const generateInviteCode = require('../utils/generateCode');
const { serializeStudyGroup, serializeStudyGroupDetail, serializeMessage } = require('../utils/serializers');

async function createStudyGroup(name, subject, adminId) {
  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (await studyGroupRepository.inviteCodeExists(inviteCode));

  const group = await studyGroupRepository.create({ name, subject, adminId, inviteCode });
  const members = await studyGroupRepository.listMembers(group.id);
  return serializeStudyGroup(group, members);
}

async function listStudyGroupsForUser(userId) {
  const groups = await studyGroupRepository.findAllForUser(userId);
  return Promise.all(
    groups.map(async (g) => serializeStudyGroup(g, await studyGroupRepository.listMembers(g.id)))
  );
}

async function getStudyGroupDetail(studyGroupId, requestingUserId) {
  const group = await studyGroupRepository.findById(studyGroupId);
  if (!group) {
    const err = new Error('Study group not found');
    err.status = 404;
    throw err;
  }

  const member = await studyGroupRepository.findMember(studyGroupId, requestingUserId);
  if (!member) {
    const err = new Error('Not a member of this group');
    err.status = 403;
    throw err;
  }

  const memberRows = await studyGroupRepository.listMembers(studyGroupId);
  const users = await userRepository.findByIds(memberRows.map((m) => m.user_id));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const scheduleRows = await studyGroupRepository.listSchedule(studyGroupId);

  return serializeStudyGroupDetail(group, memberRows, usersById, scheduleRows);
}

async function joinStudyGroup(inviteCode, userId) {
  const group = await studyGroupRepository.findByInviteCode(inviteCode.toUpperCase().trim());
  if (!group) {
    const err = new Error('Invite code not found');
    err.status = 404;
    throw err;
  }

  const existingMember = await studyGroupRepository.findMember(group.id, userId);
  if (!existingMember) {
    await studyGroupRepository.addMember(group.id, userId, 'member');

    if (group.admin_id !== userId) {
      const joiner = await userRepository.findById(userId);
      await notificationService.notify({
        userId: group.admin_id,
        type: 'group_invite',
        title: `${joiner?.name || 'Someone'} joined ${group.name}`,
        relatedId: group.id
      });
    }
  }
  const members = await studyGroupRepository.listMembers(group.id);
  return serializeStudyGroup(group, members);
}

async function scheduleSession(studyGroupId, requestingUserId, { title, datetime, notes }) {
  const group = await studyGroupRepository.findById(studyGroupId);
  if (!group) {
    const err = new Error('Study group not found');
    err.status = 404;
    throw err;
  }

  const member = await studyGroupRepository.findMember(studyGroupId, requestingUserId);
  if (!member || member.role !== 'admin') {
    const err = new Error('Admins only');
    err.status = 403;
    throw err;
  }

  await studyGroupRepository.addScheduleEntry(studyGroupId, { title, datetime, notes });

  const memberRows = await studyGroupRepository.listMembers(studyGroupId);
  await notificationService.notifyMany(
    memberRows
      .filter((m) => m.user_id !== requestingUserId)
      .map((m) => ({
        userId: m.user_id,
        type: 'session_scheduled',
        title: `New session: ${title}`,
        body: `${group.name} scheduled a session`,
        relatedId: group.id
      }))
  );

  const users = await userRepository.findByIds(memberRows.map((m) => m.user_id));
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const scheduleRows = await studyGroupRepository.listSchedule(studyGroupId);
  return serializeStudyGroupDetail(group, memberRows, usersById, scheduleRows);
}

async function listMessages(studyGroupId) {
  const rows = await messageRepository.findByStudyGroup(studyGroupId);
  return rows.map(serializeMessage);
}

async function createMessage({ studyGroupId, senderId, content, attachmentUrl, attachmentType }) {
  const row = await messageRepository.create({ studyGroupId, senderId, content, attachmentUrl, attachmentType });
  return serializeMessage(row);
}

async function isMember(studyGroupId, userId) {
  const member = await studyGroupRepository.findMember(studyGroupId, userId);
  return !!member;
}

module.exports = {
  createStudyGroup,
  listStudyGroupsForUser,
  getStudyGroupDetail,
  joinStudyGroup,
  scheduleSession,
  listMessages,
  createMessage,
  isMember
};
