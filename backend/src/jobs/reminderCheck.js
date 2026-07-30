const cron = require('node-cron');
const studyGroupRepository = require('../repositories/studyGroupRepository');
const notificationService = require('../services/notificationService');

// Every 10 minutes, look for sessions starting 30-40 minutes from now
// and send a one-time reminder notification to each member.
function startReminderJob() {
  cron.schedule('*/10 * * * *', async () => {
    try {
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
    } catch (err) {
      console.error('Reminder job error:', err.message);
    }
  });

  console.log('Reminder job scheduled (every 10 min)');
}

module.exports = startReminderJob;
