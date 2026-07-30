const { z } = require('zod');
const { MUTABAAH_FIELDS } = require('../models/MutabaahEntry');

const shape = Object.fromEntries(MUTABAAH_FIELDS.map((f) => [f, z.boolean().optional()]));

const updateEntrySchema = z.object(shape);

module.exports = { updateEntrySchema };
