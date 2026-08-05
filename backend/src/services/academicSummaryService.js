const studySessionRepository = require('../repositories/studySessionRepository');
const subjectRepository = require('../repositories/subjectRepository');
const assignmentRepository = require('../repositories/assignmentRepository');
const { getWeekStart } = require('../utils/weekUtils');
const { serializeSubject, serializeAssignment } = require('../utils/serializers');

const WEEKLY_TARGET_HOURS = 10;

// Powers both the small ring on the main Dashboard and the larger one at the
// top of the Academic Journal page — same numbers, same weekly target.
async function getWeeklySummary(userId, weekStart) {
  const week = weekStart || getWeekStart(new Date().toISOString().slice(0, 10));
  const hours = await studySessionRepository.sumHoursForWeek(userId, week);
  return {
    weekStart: week,
    hours: Math.round(hours * 10) / 10,
    targetHours: WEEKLY_TARGET_HOURS,
    percent: Math.min(100, Math.round((hours / WEEKLY_TARGET_HOURS) * 100))
  };
}

async function getOverview(userId) {
  const [subjects, assignments, weeklySummary] = await Promise.all([
    subjectRepository.findVisibleForUser(userId),
    assignmentRepository.findUpcomingForUser(userId),
    getWeeklySummary(userId)
  ]);

  return {
    weeklySummary,
    subjects: subjects.map(serializeSubject),
    assignments: assignments.map(serializeAssignment)
  };
}

module.exports = { getWeeklySummary, getOverview, WEEKLY_TARGET_HOURS };
