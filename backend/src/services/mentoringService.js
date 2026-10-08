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

// My mentor, my mentoring mates (the others under the same mentor) and my
// mentees, with how much of today's mutabaah each mate and mentee has done.
async function getTree(userId, date) {
  const me = await userRepository.findById(userId);
  const [mentor, mentees, underMyMentor] = await Promise.all([
    me?.mentor_id ? userRepository.findById(me.mentor_id) : null,
    userRepository.findMentees(userId),
    me?.mentor_id ? userRepository.findMentees(me.mentor_id) : []
  ]);
  const mates = underMyMentor.filter((u) => u.id !== userId);
  const todayRows = await mutabaahRepository.findByUsersAndDate(
    [...mentees, ...mates].map((u) => u.id),
    date
  );
  const rowByUser = Object.fromEntries(todayRows.map((r) => [r.user_id, r]));
  const withToday = (users) =>
    users
      .map((u) => ({
        ...publicUser(u),
        mutabaahDone: doneCount(mutabaahService.toApiShapePublic(rowByUser[u.id], u.id, date)),
        mutabaahTotal: CAMEL_FIELDS.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    me: publicUser(me),
    mentor: mentor ? publicUser(mentor) : null,
    mates: withToday(mates),
    mentees: withToday(mentees)
  };
}

// A mentee links themselves to a mentor by the mentor's User ID. An empty ID
// removes the link. Linking is what lets that mentor, and the other mentees
// under the same mentor, see the mentee's detail.
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

// Who may see whose detail. Visibility only runs down and sideways:
//  - a mentor sees their mentees;
//  - mentees of the same mentor (mentoring mates) see each other;
//  - nobody sees upwards, so a mentee never sees their mentor's detail.
// Returns 'mentee', 'mate' or null.
function relationTo(viewer, target) {
  if (!viewer || !target || viewer.id === target.id) return null;
  if (target.mentor_id === viewer.id) return 'mentee';
  if (viewer.mentor_id && target.mentor_id === viewer.mentor_id) return 'mate';
  return null;
}

// One person in detail, for their mentor or a mentoring mate: mutabaah item
// by item for the day and the week, and the week's academic log.
async function getMenteeDetail(viewerId, menteeId, { date, weekStart }) {
  const [viewer, mentee] = await Promise.all([userRepository.findById(viewerId), userRepository.findById(menteeId)]);
  const relation = relationTo(viewer, mentee);
  if (!relation) throw fail(403, "You can't view this person's updates");

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
    relation,
    date,
    weekStart,
    mutabaah: { today: todayEntry, week },
    academic
  };
}

module.exports = { getTree, setMentor, getMenteeDetail, parseMemberNo, relationTo };
