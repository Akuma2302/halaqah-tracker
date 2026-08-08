const { z } = require('zod');

const createStudyGroupSchema = z.object({
  name: z.string().trim().min(1, 'Group name is required'),
  subject: z.string().trim().optional(),
  showMutabaah: z.boolean().optional(),
  showStudyHours: z.boolean().optional()
});

const joinStudyGroupSchema = z.object({
  inviteCode: z.string().trim().min(1, 'Invite code is required')
});

const scheduleSessionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  datetime: z.string().min(1, 'Datetime is required'),
  notes: z.string().trim().optional()
});

module.exports = { createStudyGroupSchema, joinStudyGroupSchema, scheduleSessionSchema };