const pool = require('../config/db');
const { isOwner, isAdmin, setSuspended } = require('../utils/accountState');

// The admin dashboard: everyone who uses the app, in numbers. It reads
// activity and counts, plus the study groups and their chats (read-only) —
// never what people wrote for themselves (journal notes, tadabbur notes, files).

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const memberId = (no) => (Number.isInteger(no) ? `D4F-${String(no).padStart(4, '0')}` : null);

// The seven daily amal, as columns of mutabaah_entries.
const AMAL = [
  ['tahajud', 'tahajud'],
  ['subuhBerjemaah', 'subuh_berjemaah'],
  ['mathuratPagi', 'mathurat_pagi'],
  ['mathuratPetang', 'mathurat_petang'],
  ['dhuha', 'dhuha'],
  ['tilawah', 'tilawah'],
  ['zikir', 'zikir']
];
// How many of the seven a row has ticked.
const DONE = AMAL.map(([, column]) => `${column}::int`).join(' + ');
const AMAL_SUMS = AMAL.map(([key, column]) => `coalesce(sum(${column}::int), 0)::int as "${key}"`).join(', ');

const num = (value) => Number(value) || 0;

// App-wide figures. `date` is the admin's own today and `weekStart` the
// Sunday of their week, as elsewhere in the API.
async function getOverview({ date, weekStart }) {
  const [totals, amal, days, signups, kampus] = await Promise.all([
    pool.query(
      `select
         (select count(*) from users)::int as users,
         (select count(*) from users where created_at >= now() - interval '7 days')::int as "newThisWeek",
         (select count(*) from users where last_active_at >= now() - interval '1 day')::int as "activeToday",
         (select count(*) from users where last_active_at >= now() - interval '7 days')::int as "activeThisWeek",
         (select count(*) from users where suspended_at is not null)::int as suspended,
         (select count(*) from users where mentor_id is not null)::int as "withMentor",
         (select count(distinct mentor_id) from users where mentor_id is not null)::int as mentors,
         (select count(*) from study_groups)::int as "studyGroups",
         (select count(*) from study_groups where created_at >= now() - interval '7 days')::int as "groupsThisWeek",
         (select count(*) from messages where created_at >= now() - interval '7 days')::int as "messagesThisWeek",
         (select count(*) from subjects)::int as subjects,
         (select count(*) from subject_assessments a where not a.is_done and a.due_date < $1::date)::int as "overdueAssessments",
         (select count(*) from past_papers)::int as "pastPapers",
         (select count(*) from quran_tadabbur)::int as "tadabburAyat",
         (select coalesce(sum(hours), 0) from study_sessions where week_start = $2::date)::float as "studyHoursThisWeek",
         (select count(distinct user_id) from study_sessions where week_start = $2::date)::int as "studyingThisWeek",
         (select count(*) from mutabaah_entries where date = $1::date and (${DONE}) > 0)::int as "mutabaahToday"`,
      [date, weekStart]
    ),
    // Each amal over the last 7 days, across everyone.
    pool.query(
      `select ${AMAL_SUMS}, count(distinct user_id)::int as people
         from mutabaah_entries where date between $1::date - 6 and $1::date and (${DONE}) > 0`,
      [date]
    ),
    // The last 14 days: how many people ticked anything, and their average out of 7.
    pool.query(
      `select d::date::text as date,
              count(e.id) filter (where (${DONE}) > 0)::int as people,
              coalesce(round(avg(${DONE}) filter (where (${DONE}) > 0), 1), 0)::float as average
         from generate_series($1::date - 13, $1::date, interval '1 day') d
         left join mutabaah_entries e on e.date = d::date
        group by d order by d`,
      [date]
    ),
    pool.query(
      `select w::date::text as week, count(u.id)::int as users
         from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w
         left join users u on date_trunc('week', u.created_at) = w
        group by w order by w`
    ),
    pool.query(
      `select coalesce(nullif(trim(kampus), ''), 'Not set') as kampus, count(*)::int as users
         from users group by 1 order by 2 desc, 1 limit 8`
    )
  ]);

  const { people, ...amalTotals } = amal.rows[0];
  return {
    ...totals.rows[0],
    // Out of (people who ticked anything that week) x 7 days.
    amal: AMAL.map(([key]) => ({ key, done: amalTotals[key] })),
    amalPeople: people,
    days: days.rows,
    signups: signups.rows,
    kampus: kampus.rows
  };
}

const USER_COLUMNS = `u.id, u.member_no, u.name, u.email, u.kampus, u.avatar_url, u.created_at, u.last_active_at,
  u.is_admin, u.suspended_at, u.mentor_id, u.mentoring_group_id`;

function userShape(row) {
  return {
    _id: row.id,
    memberId: memberId(row.member_no),
    name: row.name,
    email: row.email,
    kampus: row.kampus || '',
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    isAdmin: isAdmin(row),
    isOwner: isOwner(row),
    suspendedAt: row.suspended_at,
    mentorId: row.mentor_id,
    mentoringGroupId: row.mentoring_group_id
  };
}

// Everyone, with the week's numbers beside each name.
async function listUsers({ date, weekStart }) {
  const { rows } = await pool.query(
    `select ${USER_COLUMNS}, m.name as mentor_name,
            (select count(*) from users c where c.mentor_id = u.id)::int as mentees,
            coalesce(mu.done, 0)::int as mutabaah_done, coalesce(mu.days, 0)::int as mutabaah_days,
            coalesce(ss.hours, 0)::float as study_hours,
            coalesce(sb.subjects, 0)::int as subjects, coalesce(sb.assessments, 0)::int as assessments,
            coalesce(sb.done, 0)::int as assessments_done, coalesce(sb.overdue, 0)::int as overdue
       from users u
       left join users m on m.id = u.mentor_id
       left join (
         select user_id, sum(${DONE}) as done, count(*) filter (where (${DONE}) > 0) as days
           from mutabaah_entries where date between $1::date - 6 and $1::date group by user_id
       ) mu on mu.user_id = u.id
       left join (
         select user_id, sum(hours) as hours from study_sessions where week_start = $2::date group by user_id
       ) ss on ss.user_id = u.id
       left join (
         select s.user_id, count(distinct s.id) as subjects, count(a.id) as assessments,
                count(a.id) filter (where a.is_done) as done,
                count(a.id) filter (where not a.is_done and a.due_date < $1::date) as overdue
           from subjects s left join subject_assessments a on a.subject_id = s.id group by s.user_id
       ) sb on sb.user_id = u.id
      order by u.member_no nulls last, u.created_at`,
    [date, weekStart]
  );
  return rows.map((row) => ({
    ...userShape(row),
    mentorName: row.mentor_name,
    mentees: row.mentees,
    // Out of 49: seven amal on each of the last seven days.
    mutabaahDone: row.mutabaah_done,
    mutabaahDays: row.mutabaah_days,
    studyHours: row.study_hours,
    subjects: row.subjects,
    assessments: row.assessments,
    assessmentsDone: row.assessments_done,
    overdue: row.overdue
  }));
}

async function findUser(id) {
  const { rows } = await pool.query(`select ${USER_COLUMNS} from users u where u.id = $1`, [id]);
  return rows[0] || null;
}

// One user: who they are linked to and their recent numbers.
async function getUser(id, { date, weekStart }) {
  const row = await findUser(id).catch(() => null);
  if (!row) throw fail(404, 'User not found');
  const [mentor, mentees, groups, days, amal, weeks, subjects, counts] = await Promise.all([
    row.mentor_id ? pool.query('select id, name, member_no from users where id = $1', [row.mentor_id]) : { rows: [] },
    pool.query('select id, name, member_no from users where mentor_id = $1 order by name', [id]),
    // The groups this user's mentor has made, to place them in one.
    row.mentor_id
      ? pool.query('select id, name, day_of_week, start_time from mentoring_groups where mentor_id = $1 order by created_at', [row.mentor_id])
      : { rows: [] },
    pool.query(
      `select d::date::text as date, coalesce(${DONE.replace(/(\w+)::int/g, 'e.$1::int')}, 0)::int as done
         from generate_series($2::date - 13, $2::date, interval '1 day') d
         left join mutabaah_entries e on e.date = d::date and e.user_id = $1
        order by d`,
      [id, date]
    ),
    pool.query(`select ${AMAL_SUMS} from mutabaah_entries where user_id = $1 and date between $2::date - 6 and $2::date`, [id, date]),
    pool.query(
      `select w::date::text as "weekStart", coalesce(sum(s.hours), 0)::float as hours
         from generate_series($2::date - 35, $2::date, interval '7 days') w
         left join study_sessions s on s.week_start = w::date and s.user_id = $1
        group by w order by w`,
      [id, weekStart]
    ),
    pool.query(
      `select s.id, s.name, s.code, count(a.id)::int as assessments, count(a.id) filter (where a.is_done)::int as done,
              count(a.id) filter (where not a.is_done and a.due_date < $2::date)::int as overdue,
              min(a.due_date) filter (where not a.is_done and a.due_date >= $2::date)::text as "nextDue"
         from subjects s left join subject_assessments a on a.subject_id = s.id
        where s.user_id = $1 group by s.id order by s.name`,
      [id, date]
    ),
    pool.query(
      `select
         (select count(*) from study_group_members where user_id = $1)::int as "studyGroups",
         (select count(*) from past_papers where uploader_id = $1)::int as "pastPapers",
         (select count(*) from quran_tadabbur where user_id = $1)::int as "tadabburAyat",
         (select count(*) from question_practice where user_id = $1 and week_start = $2::date)::int as "practiceSets",
         (select count(*) from lecturer_consultations where user_id = $1 and week_start = $2::date)::int as consultations`,
      [id, weekStart]
    )
  ]);
  const person = (r) => ({ _id: r.id, name: r.name, memberId: memberId(r.member_no) });
  return {
    ...userShape(row),
    mentor: mentor.rows[0] ? person(mentor.rows[0]) : null,
    mentees: mentees.rows.map(person),
    mentorGroups: groups.rows.map((g) => ({
      _id: g.id,
      name: g.name,
      dayOfWeek: g.day_of_week,
      startTime: g.start_time ? String(g.start_time).slice(0, 5) : null
    })),
    mutabaahDays: days.rows,
    amal: AMAL.map(([key]) => ({ key, done: num(amal.rows[0]?.[key]) })),
    studyWeeks: weeks.rows,
    subjects: subjects.rows.map((s) => ({ _id: s.id, name: s.name, code: s.code, assessments: s.assessments, done: s.done, overdue: s.overdue, nextDue: s.nextDue })),
    ...counts.rows[0]
  };
}

// Change an account: admin rights, suspension, who mentors them and which of
// that mentor's groups they sit in. Returns what changed, for the caller.
async function updateUser(adminId, id, changes) {
  const row = await findUser(id).catch(() => null);
  if (!row) throw fail(404, 'User not found');
  const self = id === adminId;
  const result = { suspended: null };

  if (typeof changes.isAdmin === 'boolean') {
    if (self) throw fail(400, "You can't change your own admin rights");
    if (isOwner(row)) throw fail(400, 'The owner is always an admin');
    await pool.query('update users set is_admin = $2 where id = $1', [id, changes.isAdmin]);
  }

  if (typeof changes.suspended === 'boolean') {
    if (self) throw fail(400, "You can't suspend your own account");
    if (isOwner(row)) throw fail(400, "The owner's account can't be suspended");
    await pool.query('update users set suspended_at = $2 where id = $1', [id, changes.suspended ? new Date() : null]);
    setSuspended(id, changes.suspended);
    result.suspended = changes.suspended;
  }

  let mentorId = row.mentor_id;
  if (changes.mentorId !== undefined) {
    mentorId = changes.mentorId;
    if (mentorId) {
      if (mentorId === id) throw fail(400, "A user can't be their own mentor");
      // No loops: the new mentor must not be somewhere below this user in the tree.
      const { rows } = await pool.query(
        `with recursive line as (
           select id, mentor_id, 1 as depth from users where id = $1
           union all
           select u.id, u.mentor_id, line.depth + 1 from users u join line on u.id = line.mentor_id where line.depth < 50
         )
         select (select count(*) from users where id = $1)::int as found, count(*) filter (where id = $2)::int as loops from line`,
        [mentorId, id]
      );
      if (!rows[0].found) throw fail(404, 'That mentor does not exist');
      if (rows[0].loops) throw fail(400, "That user is in this person's own mentee line, so they can't be the mentor");
    }
    // A group belongs to the mentor who made it, so it doesn't follow to a new one.
    await pool.query(
      'update users set mentor_id = $2, mentoring_group_id = case when mentor_id is not distinct from $2 then mentoring_group_id else null end where id = $1',
      [id, mentorId || null]
    );
  }

  if (changes.mentoringGroupId !== undefined) {
    const groupId = changes.mentoringGroupId || null;
    if (groupId) {
      const { rows } = await pool.query('select mentor_id from mentoring_groups where id = $1', [groupId]);
      if (!rows[0] || rows[0].mentor_id !== mentorId) throw fail(400, "That group doesn't belong to this user's mentor");
    }
    await pool.query('update users set mentoring_group_id = $2 where id = $1', [id, groupId]);
  }

  return result;
}

// Removes the account and everything stored under it (the database cascades).
async function deleteUser(adminId, id) {
  const row = await findUser(id).catch(() => null);
  if (!row) throw fail(404, 'User not found');
  if (id === adminId) throw fail(400, "You can't delete your own account here");
  if (isOwner(row)) throw fail(400, "The owner's account can't be deleted");
  await pool.query('delete from users where id = $1', [id]);
  setSuspended(id, false);
}

async function listPastPapers() {
  const { rows } = await pool.query(
    `select p.id, p.university, p.course, p.subject, p.subject_code, p.year, p.paper_type, p.file_url, p.file_name,
            p.file_size, p.created_at, u.id as uploader_id, u.name as uploader_name, u.member_no,
            (select count(*) from past_paper_favourites f where f.paper_id = p.id)::int as favourites
       from past_papers p left join users u on u.id = p.uploader_id
      order by p.created_at desc limit 500`
  );
  return rows.map((p) => ({
    _id: p.id,
    university: p.university,
    course: p.course,
    subject: p.subject,
    subjectCode: p.subject_code,
    year: p.year,
    paperType: p.paper_type,
    fileUrl: p.file_url,
    fileName: p.file_name,
    fileSize: num(p.file_size),
    createdAt: p.created_at,
    favourites: p.favourites,
    uploader: p.uploader_id ? { _id: p.uploader_id, name: p.uploader_name, memberId: memberId(p.member_no) } : null
  }));
}

async function removePastPaper(id) {
  const { rowCount } = await pool.query('delete from past_papers where id = $1', [id]).catch(() => ({ rowCount: 0 }));
  if (!rowCount) throw fail(404, 'Paper not found');
}

// Every study group: who made it, how big it is and how busy its chat is.
async function listGroups() {
  const { rows } = await pool.query(
    `select g.id, g.name, g.subject, g.created_at, u.id as owner_id, u.name as owner_name, u.member_no,
            (select count(*) from study_group_members m where m.study_group_id = g.id)::int as members,
            coalesce(ms.total, 0)::int as messages, coalesce(ms.week, 0)::int as messages_week, ms.last_at
       from study_groups g
       left join users u on u.id = g.admin_id
       left join (
         select study_group_id, count(*) as total, max(created_at) as last_at,
                count(*) filter (where created_at >= now() - interval '7 days') as week
           from messages group by study_group_id
       ) ms on ms.study_group_id = g.id
      order by g.created_at desc`
  );
  return rows.map((g) => ({
    _id: g.id,
    name: g.name,
    subject: g.subject || '',
    createdAt: g.created_at,
    owner: g.owner_id ? { _id: g.owner_id, name: g.owner_name, memberId: memberId(g.member_no) } : null,
    members: g.members,
    messages: g.messages,
    messagesThisWeek: g.messages_week,
    lastMessageAt: g.last_at
  }));
}

const MESSAGE_PAGE = 100;

// One group's members and its chat, newest page first, to read without
// joining. `before` (a timestamp) pages back through older messages.
async function getGroup(id, { before } = {}) {
  const { rows: groups } = await pool.query('select id, name, subject, created_at, admin_id from study_groups where id = $1', [id]);
  const group = groups[0];
  if (!group) throw fail(404, 'Group not found');
  const cutoff = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;
  const [members, messages] = await Promise.all([
    pool.query(
      `select u.id, u.name, u.member_no, u.avatar_url, m.role, m.joined_at
         from study_group_members m join users u on u.id = m.user_id
        where m.study_group_id = $1 order by (m.role = 'admin') desc, u.name`,
      [id]
    ),
    pool.query(
      `select ms.id, ms.content, ms.attachment_url, ms.attachment_type, ms.created_at, u.id as sender_id, u.name as sender_name
         from messages ms left join users u on u.id = ms.sender_id
        where ms.study_group_id = $1 and ($2::timestamptz is null or ms.created_at < $2::timestamptz)
        order by ms.created_at desc limit ${MESSAGE_PAGE + 1}`,
      [id, cutoff]
    )
  ]);
  const page = messages.rows.slice(0, MESSAGE_PAGE);
  return {
    _id: group.id,
    name: group.name,
    subject: group.subject || '',
    createdAt: group.created_at,
    members: members.rows.map((m) => ({
      _id: m.id,
      name: m.name,
      memberId: memberId(m.member_no),
      avatarUrl: m.avatar_url || '',
      role: m.role,
      joinedAt: m.joined_at
    })),
    // Oldest first, as a chat reads.
    messages: page.reverse().map((ms) => ({
      _id: ms.id,
      content: ms.content,
      attachmentUrl: ms.attachment_url,
      attachmentType: ms.attachment_type,
      createdAt: ms.created_at,
      sender: ms.sender_id ? { _id: ms.sender_id, name: ms.sender_name } : null
    })),
    hasEarlier: messages.rows.length > MESSAGE_PAGE
  };
}

// Every mentor's own groupings of their mentees ("Mentoring 1"), with when
// and where each meets. Who mentors whom comes with the users list.
async function listMentoringGroups() {
  const { rows } = await pool.query(
    'select id, mentor_id, name, day_of_week, start_time, venue from mentoring_groups order by mentor_id, created_at'
  );
  return rows.map((g) => ({
    _id: g.id,
    mentorId: g.mentor_id,
    name: g.name,
    dayOfWeek: g.day_of_week,
    startTime: g.start_time ? String(g.start_time).slice(0, 5) : null,
    venue: g.venue || ''
  }));
}

module.exports = {
  getOverview,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  listPastPapers,
  removePastPaper,
  listGroups,
  getGroup,
  listMentoringGroups
};
