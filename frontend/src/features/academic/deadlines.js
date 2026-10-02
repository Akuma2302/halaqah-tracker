import { ASSESSMENT_TYPES } from './constants';

export const ASSESSMENT_LABEL = Object.fromEntries(ASSESSMENT_TYPES.map((t) => [t.value, t.label]));

function daysUntil(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const today = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

// "due today", "due tomorrow", "in 4 days", "2 days overdue" for a YYYY-MM-DD date.
export function dueLabel(dateKey) {
  const days = daysUntil(dateKey);
  if (days === 0) return { text: 'due today', overdue: false, soon: true };
  if (days === 1) return { text: 'due tomorrow', overdue: false, soon: true };
  if (days > 1) return { text: `in ${days} days`, overdue: false, soon: days <= 7 };
  return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, overdue: true, soon: false };
}

export function formatDueDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Unfinished, dated assessments across all subjects (plus any standalone
// assignments), soonest first. Overdue ones are included so they aren't forgotten.
export function upcomingDeadlines(subjects = [], assignments = []) {
  const fromSubjects = subjects.flatMap((s) =>
    (s.assessments || [])
      .filter((a) => !a.isDone && a.dueDate)
      .map((a, i) => ({
        id: a._id || `${s._id}-${i}`,
        title: ASSESSMENT_LABEL[a.type] || a.type,
        weight: a.percentage,
        progress: Number(a.progressPercentage) || 0,
        subject: s,
        dueDate: a.dueDate
      }))
  );
  const standalone = assignments
    .filter((a) => !a.isDone)
    .map((a) => ({ id: `assignment-${a._id}`, title: a.title, subject: a.subject, dueDate: a.dueDate || null }));
  return [...fromSubjects, ...standalone].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}
