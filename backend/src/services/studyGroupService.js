const studyGroupRepository = require('../repositories/studyGroupRepository');
const messageRepository = require('../repositories/messageRepository');
const userRepository = require('../repositories/userRepository');
const mutabaahRepository = require('../repositories/mutabaahRepository');
const studySessionRepository = require('../repositories/studySessionRepository');
const notificationService = require('./notificationService');
const mutabaahService = require('./mutabaahService');
const generateInviteCode = require('../utils/generateCode');
const { getWeekStart } = require('../utils/weekUtils');
const { buildIcsEvent } = require('../utils/ics');
const { serializeStudyGroup, serializeStudyGroupDetail, serializeMessage, serializeUser } = require('../utils/serializers');

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

async function notifyNewMessage(studyGroupId, senderId, senderName, preview) {
  const group = await studyGroupRepository.findById(studyGroupId);
  if (!group) return [];

  const memberRows = await studyGroupRepository.listMembers(studyGroupId);
  const recipients = memberRows.filter((m) => m.user_id !== senderId);
  if (!recipients.length) return [];

  return notificationService.notifyMany(
    recipients.map((m) => ({
      userId: m.user_id,
      type: 'message',
      title: `${senderName} in ${group.name}`,
      body: preview,
      relatedId: group.id
    }))
  );
}

// Combines what used to be the separate "Groups" (mutabaah scoreboard) and
// "Study Groups" features: today's mutabaah completion + this week's study
// hours, per member, in one unified group.
async function getScoreboard(studyGroupId, requestingUserId) {
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
  const memberIds = memberRows.map((m) => m.user_id);
  const users = await userRepository.findByIds(memberIds);
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStart(today);

  const [mutabaahEntries, weeklyHours] = await Promise.all([
    mutabaahRepository.findByUsersAndDate(memberIds, today),
    studySessionRepository.sumHoursForUsersAndWeek(memberIds, weekStart)
  ]);
  const entryByUser = Object.fromEntries(mutabaahEntries.map((e) => [e.user_id, e]));

  return memberIds.map((userId) => ({
    user: serializeUser(usersById[userId]),
    mutabaah: entryByUser[userId] ? mutabaahService.toApiShapePublic(entryByUser[userId]) : null,
    studyHoursThisWeek: Math.round((weeklyHours[userId] || 0) * 10) / 10
  }));
}

// Generates a standard .ics file for a scheduled session so members can add
// it to whatever calendar app they use with one tap — no Google Calendar
// permission needed.
async function getScheduleIcs(studyGroupId, scheduleId, requestingUserId) {
  const member = await studyGroupRepository.findMember(studyGroupId, requestingUserId);
  if (!member) {
    const err = new Error('Not a member of this group');
    err.status = 403;
    throw err;
  }

  const group = await studyGroupRepository.findById(studyGroupId);
  const entry = await studyGroupRepository.findScheduleEntryById(scheduleId, studyGroupId);
  if (!group || !entry) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }

  return buildIcsEvent({
    id: entry.id,
    title: `${entry.title} — ${group.name}`,
    description: entry.notes,
    start: entry.datetime
  });
}

module.exports = {
  createStudyGroup,
  listStudyGroupsForUser,
  getStudyGroupDetail,
  joinStudyGroup,
  scheduleSession,
  listMessages,
  createMessage,
  isMember,
  notifyNewMessage,
  getScoreboard,
  getScheduleIcs
};