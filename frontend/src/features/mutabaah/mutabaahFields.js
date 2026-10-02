export const MUTABAAH_FIELDS = [
  { key: 'tahajud', label: 'Tahajud', time: 'Before Subuh', period: 'predawn' },
  { key: 'subuhBerjemaah', label: 'Subuh Berjemaah', time: 'At dawn', period: 'predawn' },
  { key: 'mathuratPagi', label: 'Mathurat Pagi', time: 'Morning', period: 'morning' },
  { key: 'mathuratPetang', label: 'Mathurat Petang', time: 'Evening', period: 'evening' },
  { key: 'dhuha', label: 'Dhuha', time: 'Mid-morning', period: 'morning' },
  { key: 'tilawah', label: 'Tilawah', time: 'Anytime', period: 'anytime' },
  { key: 'zikir', label: 'Zikir', time: 'Anytime', period: 'anytime' }
];

// Tilawah pages: the daily target in the copy summary is 1 juz (~20 pages of
// the standard 604-page mushaf). Max matches the backend validator.
export const PAGES_PER_JUZ = 20;
export const MAX_TILAWAH_PAGES = 604;

// Tilawah counts as done at 1 juz (20 pages). The tick and the page count are
// kept in step: these return the fields to change (and send to the API).
export function tilawahPagesPatch(pages) {
  return { tilawahPages: pages, tilawah: pages >= PAGES_PER_JUZ };
}

// Tapping the Tilawah item: ticking it means a juz was read (pages raised to
// 20 if lower); unticking clears the pages.
export function tilawahTogglePatch(entry) {
  return entry?.tilawah
    ? { tilawah: false, tilawahPages: 0 }
    : { tilawah: true, tilawahPages: Math.max(entry?.tilawahPages || 0, PAGES_PER_JUZ) };
}

// Zikir works the same way: done at 100 (istighfar 100x). Max matches the backend.
export const ZIKIR_GOAL = 100;
export const MAX_ZIKIR_COUNT = 10000;

export function zikirCountPatch(count) {
  return { zikirCount: count, zikir: count >= ZIKIR_GOAL };
}

export function zikirTogglePatch(entry) {
  return entry?.zikir
    ? { zikir: false, zikirCount: 0 }
    : { zikir: true, zikirCount: Math.max(entry?.zikirCount || 0, ZIKIR_GOAL) };
}

// Tap patch for any item: tilawah/zikir keep their count in step with the tick.
export function togglePatch(key, entry) {
  if (key === 'tilawah') return tilawahTogglePatch(entry);
  if (key === 'zikir') return zikirTogglePatch(entry);
  return { [key]: !entry?.[key] };
}

// Display order for the grouped checklist. `from`/`to` are local hours used to
// highlight the period that's happening now (anytime is never "now").
export const MUTABAAH_PERIODS = [
  { key: 'predawn', label: 'Pre-dawn', from: 3, to: 7 },
  { key: 'morning', label: 'Morning', from: 7, to: 12 },
  { key: 'evening', label: 'Evening', from: 16, to: 20 },
  { key: 'anytime', label: 'Anytime' }
];

export function currentPeriodKey(hour) {
  return MUTABAAH_PERIODS.find((p) => p.from !== undefined && hour >= p.from && hour < p.to)?.key || null;
}
