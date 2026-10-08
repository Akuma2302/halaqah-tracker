const userRepository = require('../repositories/userRepository');
const mutabaahRepository = require('../repositories/mutabaahRepository');
const mutabaahService = require('./mutabaahService');
const weeklyLogService = require('./weeklyLogService');
const { CAMEL_FIELDS } = require('../models/MutabaahEntry');
const { serializeUser } = require('../utils/serializers');

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// What a mentor and mentee see of each other: no email or Google id.
function publicUser(row) {
  const { _id, memberId, name, kampus, avatarUrl } = serializeUser(row);
  return { _id, memberId, name, kampus, avatarUrl };
}

// "D4F-0007", "d4f7" or plain "7" -> 7. Null when it isn't a User ID.
function parseMemberNo(input) {
  const digits = String(input || '')
    .trim()
    .replace(/^d4f[-\s]*/i, '');
  return /^\d{1,9}$/.test(digits) ? Number(digits) : null;
}

function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function doneCount(entry) {
  return CAMEL_FIELDS.filter((f) => entry[f]).length;
}

// My mentor and my mentees, with how much of today's mutabaah each mentee has done.
async function getTree(userId, date) {
  const me = await userRepository.findById(userId);
  const [mentor, mentees] = await Promise.all([
    me?.mentor_id ? userRepository.findById(me.mentor_id) : null,
    userRepository.findMentees(userId)
  ]);
  const todayRows = await mutabaahRepository.findByUsersAndDate(
    mentees.map((m) => m.id),
    date
  );
  const rowByUser = Object.fromEntries(todayRows.map((r) => [r.user_id, r]));

  return {
    me: publicUser(me),
    mentor: mentor ? publicUser(mentor) : null,
    mentees: mentees
      .map((m) => ({
        ...publicUser(m),
        mutabaahDone: doneCount(mutabaahService.toApiShapePublic(rowByUser[m.id], m.id, date)),
        mutabaahTotal: CAMEL_FIELDS.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
}

// A mentee links themselves to a mentor by the mentor's User ID. An empty ID
// removes the link. Linking is what lets that mentor see the mentee's detail.
async function setMentor(userId, memberIdInput) {
  if (!String(memberIdInput || '').trim()) {
    await userRepository.update(userId, { mentor_id: null });
    return null;
  }
  const memberNo = parseMemberNo(memberIdInput);
  if (memberNo === null) throw fail(400, 'Enter a User ID such as D4F-0007');
  const mentor = await userRepository.findByMemberNo(memberNo);
  if (!mentor) throw fail(404, 'No user has that ID');
  if (mentor.id === userId) throw fail(400, "You can't be your own mentor");

  // No loops: the new mentor must not be somewhere below me in the tree.
  let above = mentor;
  for (let i = 0; i < 25 && above?.mentor_id; i += 1) {
    if (above.mentor_id === userId) throw fail(400, 'That user is in your own mentee line, so they cannot be your mentor');
    above = await userRepository.findById(above.mentor_id);
  }

  await userRepository.update(userId, { mentor_id: mentor.id });
  return publicUser(mentor);
}

// One mentee in detail, for their mentor only: mutabaah item by item for the
// day and the week, and the week's academic log.
async function getMenteeDetail(mentorId, menteeId, { date, weekStart }) {
  const mentee = await userRepository.findById(menteeId);
  if (!mentee || mentee.mentor_id !== mentorId) throw fail(403, 'This user is not your mentee');

  const weekEnd = addDays(weekStart, 6);
  const [todayEntry, weekRows, academic] = await Promise.all([
    mutabaahService.getEntry(menteeId, date),
    mutabaahRepository.findBoundedRangeForUser(menteeId, weekStart, weekEnd),
    weeklyLogService.getWeek(menteeId, weekStart)
  ]);
  const rowByDate = Object.fromEntries(weekRows.map((r) => [r.date, r]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return mutabaahService.toApiShapePublic(rowByDate[day], menteeId, day);
  });

  return {
    user: publicUser(mentee),
    date,
    weekStart,
    mutabaah: { today: todayEntry, week },
    academic
  };
}

module.exports = { getTree, setMentor, getMenteeDetail, parseMemberNo };
