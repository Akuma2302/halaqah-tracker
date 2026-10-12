const userRepository = require('../repositories/userRepository');
const mutabaahRepository = require('../repositories/mutabaahRepository');
const timetableRepository = require('../repositories/timetableRepository');
const subjectRepository = require('../repositories/subjectRepository');
const mentoringGroupRepository = require('../repositories/mentoringGroupRepository');
const notificationService = require('./notificationService');
const { ASSESSMENT_LABEL, isExam, whenText, inDays, subjectText } = require('../utils/assessments');
const mutabaahService = require('./mutabaahService');
const weeklyLogService = require('./weeklyLogService');
const { CAMEL_FIELDS } = require('../models/MutabaahEntry');
const { serializeUser } = require('../utils/serializers');
const supabase = require('../config/supabaseClient');
const { getWeekStart } = require('../utils/weekUtils');

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// What a mentor and mentee see of each other: no email or Google id.
function publicUser(row) {
  const { _id, memberId, name, kampus, avatarUrl, whatsappUrl, instagramUrl, tiktokUrl } = serializeUser(row);
  return { _id, memberId, name, kampus, avatarUrl, whatsappUrl, instagramUrl, tiktokUrl };
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
  const [mentor, mentees, underMyMentor, groups, myGroup] = await Promise.all([
    me?.mentor_id ? userRepository.findById(me.mentor_id) : null,
    userRepository.findMentees(userId),
    me?.mentor_id ? userRepository.findMentees(me.mentor_id) : [],
    mentoringGroupRepository.findByMentor(userId),
    me?.mentoring_group_id ? mentoringGroupRepository.findById(me.mentoring_group_id) : null
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
        groupId: u.mentoring_group_id || null,
        mutabaahDone: doneCount(mutabaahService.toApiShapePublic(rowByUser[u.id], u.id, date)),
        mutabaahTotal: CAMEL_FIELDS.length
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

  // Every mentee's quizzes, tests and final exams still to come, soonest first,
  // so a mentor can see them all in one place.
  const examLists = await Promise.all(mentees.map((u) => upcomingAssessments(u.id, date)));
  const menteeExams = examLists
    .flatMap((list, i) => list.filter((a) => isExam(a.type)).map((a) => ({ ...a, mentee: publicUser(mentees[i]) })))
    .sort((a, b) => `${a.dueDate}${a.dueTime || ''}`.localeCompare(`${b.dueDate}${b.dueTime || ''}`))
    .slice(0, 12);

  return {
    me: publicUser(me),
    mentor: mentor ? publicUser(mentor) : null,
    mates: withToday(mates),
    mentees: withToday(mentees),
    // My own groupings of my mentees, and the one my mentor has put me in.
    groups: groups.map(mentoringGroupRepository.serialize),
    myGroup: myGroup ? mentoringGroupRepository.serialize(myGroup) : null,
    menteeExams
  };
}

// A mentee links themselves to a mentor by the mentor's User ID. An empty ID
// removes the link. Linking is what lets that mentor, and the other mentees
// under the same mentor, see the mentee's detail.
async function setMentor(userId, memberIdInput) {
  if (!String(memberIdInput || '').trim()) {
    await userRepository.update(userId, { mentor_id: null, mentoring_group_id: null });
    return null;
  }
  const me = await userRepository.findById(userId);
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

  // A group belongs to the mentor who made it, so it doesn't follow to a new one.
  await userRepository.update(userId, { mentor_id: mentor.id, ...(me?.mentor_id === mentor.id ? {} : { mentoring_group_id: null }) });
  return publicUser(mentor);
}

// A mentor's groupings of their own mentees. `memberIds` is who is in the
// group after saving; anyone not this mentor's mentee is ignored.
async function saveGroup(mentorId, groupId, { memberIds = [], ...fields }) {
  const row = groupId
    ? await mentoringGroupRepository.update(groupId, mentorId, fields)
    : await mentoringGroupRepository.create(mentorId, fields);
  if (!row) throw fail(404, 'Mentoring group not found');
  await mentoringGroupRepository.setMembers(row.id, mentorId, memberIds);
  return mentoringGroupRepository.serialize(row);
}

async function removeGroup(mentorId, groupId) {
  await mentoringGroupRepository.remove(groupId, mentorId);
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
  const [todayEntry, weekRows, academic, timetableRows, deadlines] = await Promise.all([
    mutabaahService.getEntry(menteeId, date),
    mutabaahRepository.findBoundedRangeForUser(menteeId, weekStart, weekEnd),
    weeklyLogService.getWeek(menteeId, weekStart),
    timetableRepository.findByUser(menteeId),
    upcomingAssessments(menteeId, date)
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
    academic,
    // Their weekly class timetable (the same every week).
    timetable: timetableRows.filter((row) => row.subject?.is_visible !== false).map(timetableRepository.serialize),
    // Their exams and other assessments still to come; a mentor can send a reminder for one.
    deadlines
  };
}

// A person's quizzes, tests, exams and other assessments still to come:
// unfinished, dated from `date` on, soonest first.
async function upcomingAssessments(userId, date) {
  const subjects = await subjectRepository.findVisibleForUser(userId);
  return subjects
    .flatMap((s) =>
      (s.subject_assessments || [])
        .filter((a) => !a.is_done && a.due_date && a.due_date >= date)
        .map((a) => ({
          _id: a.id,
          type: a.type,
          percentage: a.percentage,
          dueDate: a.due_date,
          dueTime: a.due_time ? String(a.due_time).slice(0, 5) : null,
          focusTopics: a.focus_topics || '',
          progressPercentage: a.progress_percentage || 0,
          subject: { _id: s.id, name: s.name, code: s.code }
        }))
    )
    .sort((a, b) => `${a.dueDate}${a.dueTime || ''}`.localeCompare(`${b.dueDate}${b.dueTime || ''}`));
}

// A mentor reminds a mentee about one of the mentee's upcoming assessments:
// an in-app notification plus a push. Only a mentor may do this.
async function alertMentee(mentorId, menteeId, { assessmentId, date, note }) {
  const [mentor, mentee] = await Promise.all([userRepository.findById(mentorId), userRepository.findById(menteeId)]);
  if (relationTo(mentor, mentee) !== 'mentee') throw fail(403, 'Only their mentor can send this reminder');

  const assessment = (await upcomingAssessments(menteeId, date)).find((a) => a._id === assessmentId);
  if (!assessment) throw fail(404, 'That exam or deadline is no longer coming up');

  const label = ASSESSMENT_LABEL[assessment.type] || assessment.type;
  const due = new Date(`${assessment.dueDate}T00:00:00Z`);
  const days = Math.round((due - new Date(`${date}T00:00:00Z`)) / 86400000);
  const exam = isExam(assessment.type);
  const when = whenText(assessment.dueDate, assessment.dueTime);

  return notificationService.notify({
    userId: menteeId,
    type: 'exam_alert',
    title: `${label} ${exam ? '' : 'due '}${inDays(days)}: ${assessment.subject.name}`,
    body: `${mentor.name} is reminding you: ${label} for ${subjectText(assessment.subject)} is ${exam ? 'on' : 'due'} ${when}.${note ? ` "${note}"` : ''}`,
    relatedId: assessment._id
  });
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

  // Items done on each day of the week, Sunday first; null for days still to come.
  const doneByDate = Object.fromEntries(
    mutabaahRows.map((r) => [r.date, doneCount(mutabaahService.toApiShapePublic(r, r.user_id, r.date))])
  );
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return lastDay && day <= lastDay ? doneByDate[day] || 0 : null;
  });

  // The whole week before, for the trend. Null when nothing at all was logged
  // then, so a new user doesn't show a meaningless jump.
  const prevStart = addDays(weekStart, -7);
  const prevRows = mutabaahRows.filter((r) => r.date >= prevStart && r.date < weekStart);
  const prevDone = prevRows.reduce((sum, r) => sum + doneByDate[r.date], 0);
  const prevMutabaahPercent = prevRows.length ? Math.round((prevDone / (7 * CAMEL_FIELDS.length)) * 100) : null;

  // How many of the days so far each amal was done, e.g. { tahajud: 2, dhuha: 5 }.
  const items = Object.fromEntries(CAMEL_FIELDS.map((key) => [key, 0]));
  counted.forEach((r) => {
    const entry = mutabaahService.toApiShapePublic(r, r.user_id, r.date);
    CAMEL_FIELDS.forEach((key) => {
      if (entry[key]) items[key] += 1;
    });
  });

  const hours = academic.studySessions.reduce((sum, s) => sum + s.hours, 0);
  return {
    days,
    items,
    daysElapsed,
    prevMutabaahPercent,
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

// The same numbers over the last `days` days ending on `date` (7, 14 or 30),
// rather than a Sunday-to-Saturday week. The trend compares with the same
// number of days before that.
function rangeStats(mutabaahRows, academic, { date, days }) {
  const from = addDays(date, -(days - 1));
  const entryOf = (r) => mutabaahService.toApiShapePublic(r, r.user_id, r.date);
  const doneByDate = Object.fromEntries(mutabaahRows.map((r) => [r.date, doneCount(entryOf(r))]));
  const dayKeys = Array.from({ length: days }, (_, i) => addDays(from, i));
  const counted = mutabaahRows.filter((r) => r.date >= from && r.date <= date);
  const done = counted.reduce((sum, r) => sum + doneByDate[r.date], 0);

  const prevFrom = addDays(from, -days);
  const prevRows = mutabaahRows.filter((r) => r.date >= prevFrom && r.date < from);
  const prevDone = prevRows.reduce((sum, r) => sum + doneByDate[r.date], 0);

  const items = Object.fromEntries(CAMEL_FIELDS.map((key) => [key, 0]));
  counted.forEach((r) => {
    const entry = entryOf(r);
    CAMEL_FIELDS.forEach((key) => {
      if (entry[key]) items[key] += 1;
    });
  });

  const hours = academic.studySessions.reduce((sum, s) => sum + s.hours, 0);
  return {
    // Oldest day first, one figure per day of the range.
    days: dayKeys.map((key) => doneByDate[key] || 0),
    dayKeys,
    items,
    daysElapsed: days,
    prevMutabaahPercent: prevRows.length ? Math.round((prevDone / (days * CAMEL_FIELDS.length)) * 100) : null,
    mutabaahPercent: Math.round((done / (days * CAMEL_FIELDS.length)) * 100),
    mutabaahToday: doneByDate[date] || 0,
    mutabaahTotal: CAMEL_FIELDS.length,
    studyHours: Math.round(hours * 10) / 10,
    studiedToday: academic.studySessions.some((s) => s.date === date),
    studySessions: academic.studySessions.length,
    questions: academic.questionPractice.reduce((sum, q) => sum + (q.questionCount || 0), 0),
    consultations: academic.consultations.length
  };
}

// One person's academic log between two dates. Study sessions and
// consultations carry their own date; practice questions are logged against a
// week, so every week that touches the range is counted.
async function academicInRange(userId, from, to) {
  const firstWeek = getWeekStart(from);
  const [sessions, practice, consults] = await Promise.all([
    supabase.from('study_sessions').select('hours, date').eq('user_id', userId).gte('date', from).lte('date', to),
    supabase.from('question_practice').select('question_count').eq('user_id', userId).gte('week_start', firstWeek).lte('week_start', to),
    supabase.from('lecturer_consultations').select('id, date, week_start').eq('user_id', userId).gte('week_start', firstWeek).lte('week_start', to)
  ]);
  const failed = [sessions, practice, consults].find((r) => r.error);
  if (failed) throw failed.error;
  return {
    studySessions: sessions.data.map((s) => ({ hours: Number(s.hours), date: s.date })),
    questionPractice: practice.data.map((q) => ({ questionCount: q.question_count })),
    consultations: consults.data.filter((c) => !c.date || (c.date >= from && c.date <= to))
  };
}

function groupSummary(people) {
  const n = people.length;
  const avg = (pick) => (n ? people.reduce((sum, p) => sum + pick(p), 0) / n : 0);
  // Trend for the group: only people who logged something the week before.
  const withPrev = people.filter((p) => p.prevMutabaahPercent !== null && p.prevMutabaahPercent !== undefined);
  const mutabaahChange = withPrev.length
    ? Math.round(withPrev.reduce((sum, p) => sum + (p.mutabaahPercent - p.prevMutabaahPercent), 0) / withPrev.length)
    : null;
  return {
    count: n,
    mutabaahChange,
    avgMutabaahPercent: Math.round(avg((p) => p.mutabaahPercent)),
    avgStudyHours: Math.round(avg((p) => p.studyHours) * 10) / 10,
    studiedToday: people.filter((p) => p.studiedToday).length,
    metLecturer: people.filter((p) => p.consultations > 0).length
  };
}

// Overall performance for the week: my mentoring mates (with me among them,
// for comparison) and my mentees, each as a ranked list plus group averages.
// Follows the same visibility rule as the detail page: no mentor, no one else.
// With `days` (7, 14 or 30) it covers that many days ending on `date` instead
// of the week.
async function getDashboard(userId, { date, weekStart, days = null }) {
  const me = await userRepository.findById(userId);
  const [mentees, underMyMentor] = await Promise.all([
    userRepository.findMentees(userId),
    me?.mentor_id ? userRepository.findMentees(me.mentor_id) : []
  ]);
  const mates = underMyMentor.filter((u) => u.id !== userId);
  const everyone = [me, ...mates, ...mentees];

  const from = days ? addDays(date, -(days - 1)) : weekStart;
  const [mutabaahRows, academicLogs, groups] = await Promise.all([
    // From the period before as well, so each person's trend can be worked out.
    days
      ? // One person at a time: a long range for many people is more rows than one request returns.
        Promise.all(everyone.map((u) => mutabaahRepository.findBoundedRangeForUsers([u.id], addDays(from, -days), date))).then((lists) => lists.flat())
      : mutabaahRepository.findBoundedRangeForUsers(
          everyone.map((u) => u.id),
          addDays(weekStart, -7),
          addDays(weekStart, 6)
        ),
    Promise.all(everyone.map((u) => (days ? academicInRange(u.id, from, date) : weeklyLogService.getWeek(u.id, weekStart)))),
    mentoringGroupRepository.findByMentor(userId)
  ]);
  const academicByUser = Object.fromEntries(everyone.map((u, i) => [u.id, academicLogs[i]]));
  const person = (u) => ({
    ...publicUser(u),
    isMe: u.id === userId,
    // Which of the mentor's own groups a mentee sits in, to filter by.
    groupId: u.mentoring_group_id || null,
    ...(days ? rangeStats : weekStats)(
      mutabaahRows.filter((r) => r.user_id === u.id),
      academicByUser[u.id],
      { date, weekStart, days }
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
    days,
    from,
    groups: groups.map(mentoringGroupRepository.serialize),
    hasMentor: !!me?.mentor_id,
    mates: { summary: groupSummary(mateGroup), people: mateGroup },
    mentees: { summary: groupSummary(menteeGroup), people: menteeGroup }
  };
}

module.exports = { getTree, setMentor, getMenteeDetail, getDashboard, parseMemberNo, relationTo, weekStats, rangeStats, groupSummary, alertMentee, saveGroup, removeGroup };
