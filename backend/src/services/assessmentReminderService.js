const subjectRepository = require('../repositories/subjectRepository');
const userRepository = require('../repositories/userRepository');
const reminderLogRepository = require('../repositories/reminderLogRepository');
const notificationService = require('./notificationService');
const { localClock } = require('./mutabaahReminderService');
const { ASSESSMENT_LABEL, isExam, whenText, inDays, subjectText } = require('../utils/assessments');

// Reminders 7, 3 and 1 days before an assessment: to its owner for every kind
// (exam coming, or work due), and to the owner's mentor for exams.

const TIME_ZONE = process.env.MUTABAAH_TIME_ZONE || 'Asia/Kuala_Lumpur';
const DAYS_BEFORE = [7, 3, 1];
// Not in the middle of the night: from 8 am local time on.
const NOT_BEFORE_MINUTES = 8 * 60;

function addDays(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Safe to call as often as you like: each reminder is sent at most once.
async function runDueReminders(now = new Date()) {
  const { date, minutes } = localClock(now, TIME_ZONE);
  const result = { date, sent: 0 };
  if (minutes < NOT_BEFORE_MINUTES) return result;

  const daysByDate = Object.fromEntries(DAYS_BEFORE.map((n) => [addDays(date, n), n]));
  const assessments = await subjectRepository.findAssessmentsDueOn(Object.keys(daysByDate));
  if (!assessments.length) return result;

  const owners = await userRepository.findByIds([...new Set(assessments.map((a) => a.subject.user_id))]);
  const ownerById = Object.fromEntries(owners.map((u) => [u.id, u]));

  const wanted = [];
  assessments.forEach((a) => {
    const owner = ownerById[a.subject.user_id];
    if (!owner) return;
    const days = daysByDate[a.due_date];
    const label = ASSESSMENT_LABEL[a.type] || a.type;
    const time = a.due_time ? String(a.due_time).slice(0, 5) : '';
    const when = whenText(a.due_date, time);
    const exam = isExam(a.type);
    const key = `${a.subject.id}:${a.type}:${a.due_date}:${days}`;

    wanted.push({
      userId: owner.id,
      key,
      type: 'deadline_reminder',
      title: exam ? `${label} ${inDays(days)}: ${a.subject.name}` : `${label} due ${inDays(days)}: ${a.subject.name}`,
      body: exam ? `${label} for ${subjectText(a.subject)} is on ${when}.` : `${label} for ${subjectText(a.subject)} is due ${when}.`,
      relatedId: a.subject.id
    });
    if (exam && owner.mentor_id) {
      wanted.push({
        userId: owner.mentor_id,
        key: `mentee:${owner.id}:${key}`,
        type: 'mentee_exam',
        title: `${owner.name}: ${label} ${inDays(days)}`,
        body: `Your mentee has a ${label} for ${subjectText(a.subject)} on ${when}.`,
        relatedId: owner.id
      });
    }
  });

  const claimed = await reminderLogRepository.claimAssessment(wanted.map((w) => ({ user_id: w.userId, key: w.key })));
  const mine = new Set(claimed.map((c) => `${c.user_id}|${c.key}`));
  const toSend = wanted.filter((w) => mine.has(`${w.userId}|${w.key}`));
  await notificationService.notifyMany(toSend);
  result.sent = toSend.length;
  return result;
}

module.exports = { runDueReminders, DAYS_BEFORE };
