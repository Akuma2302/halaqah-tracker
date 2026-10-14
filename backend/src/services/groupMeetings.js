const userRepository = require('../repositories/userRepository');
const mentoringGroupRepository = require('../repositories/mentoringGroupRepository');

// A mentoring group's weekly meeting as a timetable row, for the mentor who
// runs it and for each mentee in it. It is read from the group every time,
// so when the mentor changes the day, time or place, everyone's timetable
// shows the change at once. A group with no day or time set has no meeting.

const DEFAULT_MINUTES = 90;

function later(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function asRow(group) {
  if (!group || group.day_of_week === null || group.day_of_week === undefined || !group.start_time) return null;
  const start = String(group.start_time).slice(0, 5);
  const end = group.end_time ? String(group.end_time).slice(0, 5) : later(start, DEFAULT_MINUTES);
  return {
    id: `group-${group.id}`,
    user_id: group.mentor_id,
    title: group.name,
    day_of_week: group.day_of_week,
    start_time: start,
    end_time: end > start ? end : later(start, DEFAULT_MINUTES),
    venue: group.venue || '',
    kind: 'halaqah',
    custom_kind: '',
    start_date: null,
    end_date: null,
    reminders: Array.isArray(group.reminders) ? group.reminders : [],
    subject: null,
    from_group: true,
    // Who a reminder goes to besides the mentor, when known.
    member_ids: group.member_ids || []
  };
}

// The group I'm in (as a mentee) and the groups I run (as a mentor).
async function groupMeetingRows(userId) {
  const me = await userRepository.findById(userId);
  const [mine, run] = await Promise.all([
    me?.mentoring_group_id ? mentoringGroupRepository.findById(me.mentoring_group_id) : null,
    mentoringGroupRepository.findByMentor(userId)
  ]);
  return [mine, ...run].map(asRow).filter(Boolean);
}

module.exports = { groupMeetingRows, asRow };
