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

// API/frontend uses camelCase, the Postgres table uses snake_case. This map
// is the single source of truth for that translation — both the service
// (services/mutabaahService.js) and the request validator
// (validators/mutabaahValidators.js) import it from here, so they can't
// drift out of sync with each other (which previously caused subuhBerjemaah/
// mathuratPagi/mathuratPetang updates to be silently dropped by validation).
const FIELD_MAP = {
  tahajud: 'tahajud',
  subuhBerjemaah: 'subuh_berjemaah',
  mathuratPagi: 'mathurat_pagi',
  mathuratPetang: 'mathurat_petang',
  dhuha: 'dhuha',
  tilawah: 'tilawah',
  zikir: 'zikir'
};
const CAMEL_FIELDS = Object.keys(FIELD_MAP);
const MUTABAAH_FIELDS = Object.values(FIELD_MAP); // snake_case DB column names

module.exports = { FIELD_MAP, CAMEL_FIELDS, MUTABAAH_FIELDS };
