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

// One person's numbers for a week, from their mutabaah rows and academic log.
// Mutabaah is measured against the days of the week that have happened so far
// (up to `date`), so a week in progress isn't marked down for days to come.
function weekStats(mutabaahRows, academic, { date, weekStart }) {
  const weekEnd = addDays(weekStart, 6);
  const lastDay = date < weekStart ? null : date > weekEnd ? weekEnd : date;
  const daysElapsed = lastDay ? Math.round((new Date(`${lastDay}T00:00:00Z`) - new Date(`${weekStart}T00:00:00Z`)) / 86400000) + 1 : 0;
  const counted = mutabaahRows.filter((r) => lastDay && r.date >= weekStart && r.date <= lastDay);
  const done = counted.reduce((sum, r) => sum + doneCount(mutabaahService.toApiShapePublic(r, r.user_id, r.date)), 0);
  const possible = daysElapsed * CAMEL_FIELDS.length;
  const todayRow = mutabaahRows.find((r) => r.date === date);

  const hours = academic.studySessions.reduce((sum, s) => sum + s.hours, 0);
  return {
    mutabaahPercent: possible ? Math.round((done / possible) * 100) : 0,
    mutabaahToday: todayRow ? doneCount(mutabaahService.toApiShapePublic(todayRow, todayRow.user_id, date)) : 0,
    mutabaahTotal: CAMEL_FIELDS.length,
    studyHours: Math.round(hours * 10) / 10,
    studiedToday: academic.studySessions.some((s) => s.date === date),
    studySessions: academic.studySessions.length,
    questions: academic.questionPractice.reduce((sum, q) => sum + (q.questionCount || 0), 0),
    consultations: academic.consultations.length
  };
}

function groupSummary(people) {
  const n = people.length;
  const avg = (pick) => (n ? people.reduce((sum, p) => sum + pick(p), 0) / n : 0);
  return {
    count: n,
    avgMutabaahPercent: Math.round(avg((p) => p.mutabaahPercent)),
    avgStudyHours: Math.round(avg((p) => p.studyHours) * 10) / 10,
    studiedToday: people.filter((p) => p.studiedToday).length,
    metLecturer: people.filter((p) => p.consultations > 0).length
  };
}

// Overall performance for the week: my mentoring mates (with me among them,
// for comparison) and my mentees, each as a ranked list plus group averages.
// Follows the same visibility rule as the detail page: no mentor, no one else.
async function getDashboard(userId, { date, weekStart }) {
  const me = await userRepository.findById(userId);
  const [mentees, underMyMentor] = await Promise.all([
    userRepository.findMentees(userId),
    me?.mentor_id ? userRepository.findMentees(me.mentor_id) : []
  ]);
  const mates = underMyMentor.filter((u) => u.id !== userId);
  const everyone = [me, ...mates, ...mentees];

  const [mutabaahRows, academicLogs] = await Promise.all([
    mutabaahRepository.findBoundedRangeForUsers(
      everyone.map((u) => u.id),
      weekStart,
      addDays(weekStart, 6)
    ),
    Promise.all(everyone.map((u) => weeklyLogService.getWeek(u.id, weekStart)))
  ]);
  const academicByUser = Object.fromEntries(everyone.map((u, i) => [u.id, academicLogs[i]]));
  const person = (u) => ({
    ...publicUser(u),
    isMe: u.id === userId,
    ...weekStats(
      mutabaahRows.filter((r) => r.user_id === u.id),
      academicByUser[u.id],
      { date, weekStart }
    )
  });
  // Best mutabaah first, study hours as the tie-break.
  const ranked = (users) =>
    users.map(person).sort((a, b) => b.mutabaahPercent - a.mutabaahPercent || b.studyHours - a.studyHours || a.name.localeCompare(b.name));

  const mateGroup = me?.mentor_id ? ranked([me, ...mates]) : [];
  const menteeGroup = ranked(mentees);
  return {
    date,
    weekStart,
    hasMentor: !!me?.mentor_id,
    mates: { summary: groupSummary(mateGroup), people: mateGroup },
    mentees: { summary: groupSummary(menteeGroup), people: menteeGroup }
  };
}

module.exports = { getTree, setMentor, getMenteeDetail, getDashboard, parseMemberNo, relationTo, weekStats, groupSummary };
