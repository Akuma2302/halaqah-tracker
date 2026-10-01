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
 * @property {number} tilawah_pages  pages of Quran read that day, 0-604
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

// Numeric companion to the tilawah tick. Kept out of FIELD_MAP, which is the
// list of yes/no checklist items (counted in completion %, totals, etc).
const TILAWAH_PAGES_COLUMN = 'tilawah_pages';
const MAX_TILAWAH_PAGES = 604;

module.exports = { FIELD_MAP, CAMEL_FIELDS, MUTABAAH_FIELDS, TILAWAH_PAGES_COLUMN, MAX_TILAWAH_PAGES };
