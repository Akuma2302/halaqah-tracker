const groupRepository = require('../repositories/groupRepository');
const userRepository = require('../repositories/userRepository');
const mutabaahRepository = require('../repositories/mutabaahRepository');
const mutabaahService = require('./mutabaahService');
const notificationService = require('./notificationService');
const generateInviteCode = require('../utils/generateCode');
const { serializeGroup, serializeUser } = require('../utils/serializers');

async function createGroup(name, ownerId) {
  let inviteCode;
  do {
    inviteCode = generateInviteCode();
  } while (await groupRepository.inviteCodeExists(inviteCode));

  const group = await groupRepository.create({ name, ownerId, inviteCode });
  const members = await groupRepository.listMembers(group.id);
  return serializeGroup(group, members);
}

async function listGroupsForUser(userId) {
  const groups = await groupRepository.findAllForUser(userId);
  const withMembers = await Promise.all(
    groups.map(async (g) => serializeGroup(g, await groupRepository.listMembers(g.id)))
  );
  return withMembers;
}

async function joinGroup(inviteCode, userId) {
  const group = await groupRepository.findByInviteCode(inviteCode.toUpperCase().trim());
  if (!group) {
    const err = new Error('Invite code not found');
    err.status = 404;
    throw err;
  }

  const alreadyMember = await groupRepository.isMember(group.id, userId);
  if (!alreadyMember) {
    await groupRepository.addMember(group.id, userId);

    if (group.owner_id !== userId) {
      const joiner = await userRepository.findById(userId);
      await notificationService.notify({
        userId: group.owner_id,
        type: 'group_invite',
        title: `${joiner?.name || 'Someone'} joined ${group.name}`,
        relatedId: group.id
      });
    }
  }
  const members = await groupRepository.listMembers(group.id);
  return serializeGroup(group, members);
}

// Today's mutabaah status for every member of a group.
async function getTodayStatus(groupId, requestingUserId) {
  const group = await groupRepository.findById(groupId);
  if (!group) {
    const err = new Error('Group not found');
    err.status = 404;
    throw err;
  }

  const isMember = await groupRepository.isMember(groupId, requestingUserId);
  if (!isMember) {
    const err = new Error('Not a member of this group');
    err.status = 403;
    throw err;
  }

  const memberRows = await groupRepository.listMembers(groupId);
  const memberIds = memberRows.map((m) => m.user_id);
  const users = await userRepository.findByIds(memberIds);
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));

  const today = new Date().toISOString().slice(0, 10);
  const entries = await mutabaahRepository.findByUsersAndDate(memberIds, today);
  const entryByUser = Object.fromEntries(entries.map((e) => [e.user_id, e]));

  const members = memberIds.map((userId) => ({
    user: serializeUser(usersById[userId]),
    entry: entryByUser[userId] ? mutabaahService.toApiShapePublic(entryByUser[userId]) : null
  }));

  return {
    group: { _id: group.id, name: group.name, inviteCode: group.invite_code, ownerId: group.owner_id },
    members
  };
}

module.exports = { createGroup, listGroupsForUser, joinGroup, getTodayStatus };
