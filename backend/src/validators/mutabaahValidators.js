const { z } = require('zod');
const { CAMEL_FIELDS, MAX_TILAWAH_PAGES } = require('../models/MutabaahEntry');

const shape = Object.fromEntries(CAMEL_FIELDS.map((f) => [f, z.boolean().optional()]));
shape.tilawahPages = z.number().int().min(0).max(MAX_TILAWAH_PAGES).optional();

const updateEntrySchema = z.object(shape);

module.exports = { updateEntrySchema };
