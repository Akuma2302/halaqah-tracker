/**
 * `mutabaah_entries` — one row per user per day.
 * @typedef {Object} MutabaahEntry
 * @property {string} id
 * @property {string} user_id
 * @property {string} date  ISO date "YYYY-MM-DD"
 * @property {boolean} tahajud
 * @property {boolean} subuh_berjemaah
 * @property {boolean} mathurat_pagi
 * @property {boolean} mathurat_petang
 * @property {boolean} dhuha
 * @property {boolean} tilawah
 * @property {boolean} zikir
 */

// Field names shared between validators/services so the checklist stays in sync
// with the schema in one place.
const MUTABAAH_FIELDS = [
  'tahajud',
  'subuh_berjemaah',
  'mathurat_pagi',
  'mathurat_petang',
  'dhuha',
  'tilawah',
  'zikir'
];

module.exports = { MUTABAAH_FIELDS };
