// Shared wording for assessments (quizzes, tests, exams, assignments...).
const ASSESSMENT_LABEL = {
  quiz: 'Quiz',
  test: 'Test',
  assignment: 'Assignment',
  project: 'Project',
  presentation: 'Presentation',
  final_exam: 'Final Exam'
};

// Sat at a set time; the rest are pieces of work handed in by a due date.
const EXAM_TYPES = ['quiz', 'test', 'final_exam'];
const isExam = (type) => EXAM_TYPES.includes(type);

// "14:30" -> "2:30 pm"
function clock(time) {
  const [h, m] = String(time).split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

// "2026-10-16", "09:00" -> "Fri, 16 Oct at 9:00 am"
function whenText(dateKey, time) {
  const day = new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  });
  return time ? `${day} at ${clock(time)}` : day;
}

// 0 -> "today", 1 -> "tomorrow", 5 -> "in 5 days"
function inDays(days) {
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

function subjectText(subject) {
  return subject.code ? `${subject.name} (${subject.code})` : subject.name;
}

module.exports = { ASSESSMENT_LABEL, EXAM_TYPES, isExam, clock, whenText, inDays, subjectText };
