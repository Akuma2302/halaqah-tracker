export const MUTABAAH_FIELDS = [
  { key: 'tahajud', label: 'Tahajud', time: 'Before Subuh', period: 'predawn' },
  { key: 'subuhBerjemaah', label: 'Subuh Berjemaah', time: 'At dawn', period: 'predawn' },
  { key: 'mathuratPagi', label: 'Mathurat Pagi', time: 'Morning', period: 'morning' },
  { key: 'mathuratPetang', label: 'Mathurat Petang', time: 'Evening', period: 'evening' },
  { key: 'dhuha', label: 'Dhuha', time: 'Mid-morning', period: 'morning' },
  { key: 'tilawah', label: 'Tilawah', time: 'Anytime', period: 'anytime' },
  { key: 'zikir', label: 'Zikir', time: 'Anytime', period: 'anytime' }
];

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
