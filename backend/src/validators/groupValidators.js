const { z } = require('zod');

const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required')
});

const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1, 'Invite code is required')
});

module.exports = { createGroupSchema, joinGroupSchema };
