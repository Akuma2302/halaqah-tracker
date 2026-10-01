const cron = require('node-cron');
const studyGroupRepository = require('../repositories/studyGroupRepository');
const notificationService = require('../services/notificationService');
const mutabaahReminderService = require('../services/mutabaahReminderService');

// Look for sessions starting 30-40 minutes from now and send a one-time
// reminder notification to each member.
async function runSessionReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 30 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 40 * 60 * 1000);

  const dueSessions = await studyGroupRepository.findDueUnremindedSessions(windowStart, windowEnd);

  for (const session of dueSessions) {
    const group = session.study_group;
    const memberRows = await studyGroupRepository.listMembers(session.study_group_id);

    await notificationService.notifyMany(
      memberRows.map((m) => ({
        userId: m.user_id,
        type: 'reminder',
        title: `${session.title} starts soon`,
        body: `${group?.name || 'Your study group'} — starting in about 30 minutes`,
        relatedId: session.study_group_id
      }))
    );

    await studyGroupRepository.markSessionReminded(session.id);
  }
  return dueSessions.length;
}

// Everything time-based in one place. Called by the in-process cron below and
// by POST /api/jobs/run (an external scheduler that also wakes the server,
// since Render's free tier sleeps and in-process cron can't fire while asleep).
async function runAllReminders() {
  const result = {};
  try {
    result.sessions = await runSessionReminders();
  } catch (err) {
    console.error('Session reminder error:', err.message);
    result.sessionsError = err.message;
  }
  try {
    result.mutabaah = await mutabaahReminderService.runDueReminders();
  } catch (err) {
    console.error('Mutabaah reminder error:', err.message);
    result.mutabaahError = err.message;
  }
  return result;
}

function startReminderJob() {
  cron.schedule('*/10 * * * *', () => {
    runAllReminders();
  });

  console.log('Reminder job scheduled (every 10 min)');
}

module.exports = startReminderJob;
module.exports.runAllReminders = runAllReminders;
