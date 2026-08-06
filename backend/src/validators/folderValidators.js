const { z } = require('zod');

const createFolderSchema = z.object({
  name: z.string().trim().min(1, 'Folder name is required')
});

const addGroupSchema = z.object({
  studyGroupId: z.string().uuid('Invalid group id')
});

module.exports = { createFolderSchema, addGroupSchema };