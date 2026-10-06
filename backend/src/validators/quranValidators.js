const { z } = require('zod');

// A bookmark is an ayat ("2:255") or, when no ayat is known, a whole reader
// ("page/50"). `id` identifies it; saving the same id again replaces it.
const saveBookmarkSchema = z.object({
  id: z.string().trim().min(1).max(40),
  kind: z.enum(['chapter', 'juz', 'page']),
  number: z.number().int().min(1).max(604),
  key: z
    .string()
    .regex(/^\d{1,3}:\d{1,3}$/, 'Invalid ayat')
    .nullish(),
  label: z.string().trim().min(1).max(200),
  at: z.number().int().positive().optional()
});

module.exports = { saveBookmarkSchema };
