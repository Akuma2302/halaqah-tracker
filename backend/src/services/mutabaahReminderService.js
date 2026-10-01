const userRepository = require('../repositories/userRepository');
const mutabaahRepository = require('../repositories/mutabaahRepository');
const pushSubscriptionRepository = require('../repositories/pushSubscriptionRepository');
const reminderLogRepository = require('../repositories/reminderLogRepository');
const pushService = require('./pushService');
const { FIELD_MAP } = require('../models/MutabaahEntry');

// Push reminders for mutabaah items not ticked yet, at fixed local times.
// Push only (no in-app notification rows), so four reminders a day don't
// bury real messages or keep the unread badge permanently high.

const TIME_ZONE = process.env.MUTABAAH_TIME_ZONE || 'Asia/Kuala_Lumpur';

// If the server was asleep at the slot time (Render free tier), still send
// when it wakes, but not if it's this late — a 7:30 Subuh nudge at noon is noise.
const LATE_LIMIT_MINUTES = 90;

const LABELS = {
  tahajud: 'Tahajud',
  subuhBerjemaah: 'Subuh Berjemaah',
  mathuratPagi: 'Mathurat Pagi',
  mathuratPetang: 'Mathurat Petang',
  dhuha: 'Dhuha',
  tilawah: 'Tilawah',
  zikir: 'Zikir'
};

const SLOTS = [
  {
    key: 'subuh',
    at: '07:30',
    items: ['tahajud', 'subuhBerjemaah'],
    message: (left) => ({
      title: 'Subuh check-in',
      body: `Not ticked yet: ${left.join(', ')}. Tap to update your mutabaah.`
    })
  },
  {
    key: 'pagi',
    at: '10:30',
    items: ['mathuratPagi', 'dhuha'],
    message: (left) => ({
      title: 'Morning amal',
      body: `Still open: ${left.join(', ')}.${left.includes('Dhuha') ? ' Dhuha time ends before Zuhur.' : ''}`
    })
  },
  {
    key: 'petang',
    at: '18:15',
    items: ['mathuratPetang'],
    message: () => ({
      title: 'Mathurat Petang',
      body: "Mathurat Petang isn't ticked yet. There's still time before Maghrib."
    })
  },
  {
    key: 'malam',
    at: '21:30',
    items: Object.keys(LABELS),
    message: (left) => ({
      title: `${left.length} amal left today`,
      body: `Left: ${left.join(', ')}. Tick what you've done before the day ends.`
    })
  }
];

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Local calendar date ("YYYY-MM-DD") and minutes since local midnight.
function localClock(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function dueSlots(minutes) {
  return SLOTS.filter((s) => {
    const start = toMinutes(s.at);
    return minutes >= start && minutes < start + LATE_LIMIT_MINUTES;
  });
}

// Safe to call as often as you like: each (user, day, slot) is sent at most once.
async function runDueReminders(now = new Date()) {
  const { date, minutes } = localClock(now, TIME_ZONE);
  const slots = dueSlots(minutes);
  const result = { date, slots: slots.map((s) => s.key), sent: 0 };
  if (!slots.length || !pushService.configured) return result;

  const [users, subscribedIds] = await Promise.all([
    userRepository.findWithMutabaahRemindersOn(),
    pushSubscriptionRepository.findSubscribedUserIds()
  ]);
  const subscribed = new Set(subscribedIds);
  const userIds = users.map((u) => u.id).filter((id) => subscribed.has(id));
  if (!userIds.length) return result;

  const entries = await mutabaahRepository.findByUsersAndDate(userIds, date);
  const entryByUser = Object.fromEntries(entries.map((e) => [e.user_id, e]));

  for (const slot of slots) {
    const pending = userIds
      .map((userId) => ({
        userId,
        left: slot.items.filter((key) => !entryByUser[userId]?.[FIELD_MAP[key]]).map((key) => LABELS[key])
      }))
      .filter((p) => p.left.length > 0);
    if (!pending.length) continue;

    const claimed = await reminderLogRepository.claim(pending.map((p) => ({ user_id: p.userId, date, slot: slot.key })));
    const claimedIds = new Set(claimed.map((c) => c.user_id));

    await Promise.all(
      pending
        .filter((p) => claimedIds.has(p.userId))
        .map((p) =>
          pushService
            .pushToUser(p.userId, { ...slot.message(p.left), url: '/checklist' })
            .catch((err) => console.error('Mutabaah reminder push error:', err.message))
        )
    );
    result.sent += claimedIds.size;
  }

  return result;
}

module.exports = { runDueReminders, SLOTS, localClock, dueSlots };
