const { z } = require('zod');

const googleLoginSchema = z.object({
  credential: z.string().min(1, 'Missing credential')
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  kampus: z.string().trim().optional(),
  // A number, a username or a link; turned into a proper link when saved.
  whatsapp: z.string().trim().max(200).optional(),
  instagram: z.string().trim().max(200).optional(),
  tiktok: z.string().trim().max(200).optional(),
  mutabaahReminders: z.boolean().optional()
});

module.exports = { googleLoginSchema, updateProfileSchema };
