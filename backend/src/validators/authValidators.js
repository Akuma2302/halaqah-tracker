const { z } = require('zod');

const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Missing credential')
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  kampus: z.string().trim().optional()
});

module.exports = { googleLoginSchema, updateProfileSchema };
