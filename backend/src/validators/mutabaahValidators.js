const { z } = require('zod');
const { CAMEL_FIELDS } = require('../models/MutabaahEntry');

const shape = Object.fromEntries(CAMEL_FIELDS.map((f) => [f, z.boolean().optional()]));

const updateEntrySchema = z.object(shape);

module.exports = { updateEntrySchema };
