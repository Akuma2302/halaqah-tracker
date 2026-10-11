import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileStack,
  FileText,
  LayoutDashboard,
  ListChecks,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { getWeekStart, toDateKey } from '../features/academic/weekUtils';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';
import { SHORT_DAYS, clock } from '../features/timetable/timetable';

dayjs.extend(relativeTime);

const AMAL_LABEL = Object.fromEntries(MUTABAAH_FIELDS.map((f) => [f.key, f.label]));
// Seven amal on each of the last seven days.
const WEEK_POSSIBLE = 49;

const TABS = [
  ['overview', 'Overview', LayoutDashboard],
  ['users', 'Users', Users],
  ['papers', 'Papers', FileStack]
];

const FILTERS = [
  ['all', 'All'],
  ['active', 'Active this week'],
  ['quiet', 'Quiet'],
  ['nomentor', 'No mentor'],
  ['overdue', 'Has overdue'],
  ['admins', 'Admins'],
  ['suspended', 'Suspended']
];

const SORTS = [
  ['id', 'User ID'],
  ['active', 'Last active'],
  ['mutabaah', 'Mutabaah this week'],
  ['study', 'Study hours'],
  ['joined', 'Newest']
];

const errorText = (err, fallback) => err.response?.data?.error || fallback;
const hours = (h) => `${Math.round(h * 10) / 10}h`;
const activeWithin = (user, days) => !!user.lastActiveAt && dayjs().diff(dayjs(user.lastActiveAt), 'day', true) <= days;
const lastActive = (user) => (user.lastActiveAt ? dayjs(user.lastActiveAt).fromNow() : 'Not seen yet');
const percent = (done, possible) => (possible ? Math.round((done / possible) * 100) : 0);
const tone = (p) => (p >= 70 ? 'good' : p >= 40 ? 'mid' : 'low');

function Avatar({ user, size = 34 }) {
  return user.avatarUrl ? (
    <img className="avatar adm-avatar" src={user.avatarUrl} alt="" style={{ width: size, height: size }} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar adm-avatar adm-avatar-letter" style={{ width: size, height: size }}>
      {(user.name || '?').charAt(0).toUpperCase()}
    </span>
  );
}

function Tags({ user }) {
  return (
    <>
      {user.suspendedAt && <span className="badge adm-badge-danger">Suspended</span>}
      {user.isOwner ? <span className="badge badge-gold">Owner</span> : user.isAdmin ? <span className="badge badge-primary">Admin</span> : null}
    </>
  );
}

// A row of bars with a value above each and a label below.
function Bars({ items, max, label }) {
  const top = Math.max(1, max ?? Math.max(...items.map((i) => i.value)));
  return (
    <div className="adm-bars" role="img" aria-label={label}>
      {items.map((i) => (
        <div className={`adm-bar${i.strong ? ' strong' : ''}`} key={i.key} title={i.title}>
          <span className="adm-bar-value">{i.value || ''}</span>
          <span className="adm-bar-track">
            <span style={{ height: `${(i.value / top) * 100}%` }} />
          </span>
          <span className="adm-bar-label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

function Stat({ icon: Icon, value, label, sub, warn }) {
  return (
    <div className={`aj-action sem-static${warn ? ' adm-stat-warn' : ''}`}>
      <span className="aj-action-icon">
        <Icon size={16} />
      </span>
      <span className="aj-action-text">
        <strong>{value}</strong>
        <span>{label}</span>
        <small>{sub}</small>
      </span>
    </div>
  );
}

function Overview({ data }) {
  const amal = [...data.amal].sort((a, b) => a.done - b.done);
  const amalPossible = Math.max(1, data.amalPeople * 7);
  return (
    <>
      <div className="aj-actions adm-stats">
        <Stat icon={Users} value={data.users} label="Users" sub={`${data.newThisWeek} joined in the last 7 days`} />
        <Stat icon={Activity} value={data.activeToday} label="Active today" sub={`${data.activeThisWeek} in the last 7 days`} />
        <Stat icon={ListChecks} value={data.mutabaahToday} label="Marked mutabaah today" sub={`of ${data.users} users`} />
        <Stat icon={Clock} value={hours(data.studyHoursThisWeek)} label="Study hours this week" sub={`logged by ${data.studyingThisWeek} users`} />
        <Stat icon={Network} value={data.withMentor} label="Have a mentor" sub={`${data.mentors} mentors`} />
        <Stat
          icon={AlertTriangle}
          value={data.overdueAssessments}
          label="Overdue assessments"
          sub={`across ${data.subjects} subjects`}
          warn={data.overdueAssessments > 0}
        />
        <Stat icon={FileStack} value={data.pastPapers} label="Past papers shared" sub={`${data.studyGroups} study groups`} />
        <Stat icon={Ban} value={data.suspended} label="Suspended" sub="Accounts switched off" warn={data.suspended > 0} />
      </div>

      <div className="adm-grid">
        <div className="card">
          <div className="adm-card-title">
            Mutabaah, last 14 days <span>People who marked at least one amal</span>
          </div>
          <Bars
            label="People who marked their mutabaah each day"
            max={Math.max(1, data.users)}
            items={data.days.map((d, i) => ({
              key: d.date,
              value: d.people,
              label: Number(d.date.slice(8)),
              strong: i === data.days.length - 1,
              title: `${dayjs(d.date).format('ddd D MMM')}: ${d.people} people, ${d.average} of 7 on average`
            }))}
          />
        </div>

        <div className="card">
          <div className="adm-card-title">
            New users <span>By week, last 8 weeks</span>
          </div>
          <Bars
            label="New users each week"
            items={data.signups.map((w, i) => ({
              key: w.week,
              value: w.users,
              label: dayjs(w.week).format('D/M'),
              strong: i === data.signups.length - 1,
              title: `Week of ${dayjs(w.week).format('D MMM')}: ${w.users} joined`
            }))}
          />
        </div>

        <div className="card">
          <div className="adm-card-title">
            Amal this week <span>Least done first</span>
          </div>
          {data.amalPeople === 0 ? (
            <p className="log-empty">Nobody has marked their mutabaah in the last 7 days.</p>
          ) : (
            <div className="adm-rank">
              {amal.map((a) => {
                const p = percent(a.done, amalPossible);
                return (
                  <div className="adm-rank-row" key={a.key}>
                    <span className="adm-rank-name">{AMAL_LABEL[a.key] || a.key}</span>
                    <span className="adm-rank-bar">
                      <span className={`tone-${tone(p)}`} style={{ width: `${p}%` }} />
                    </span>
                    <span className="adm-rank-value">{p}%</span>
                  </div>
                );
              })}
              <p className="adm-foot">Out of every day of the last 7 for the {data.amalPeople} people who marked anything.</p>
            </div>
          )}
        </div>

        <div className="card">
          <div className="adm-card-title">
            Where users are from <span>Kampus on their profile</span>
          </div>
          <div className="adm-rank">
            {data.kampus.map((k) => (
              <div className="adm-rank-row" key={k.kampus}>
                <span className="adm-rank-name">{k.kampus}</span>
                <span className="adm-rank-bar">
                  <span className="tone-good" style={{ width: `${percent(k.users, data.users)}%` }} />
                </span>
                <span className="adm-rank-value">{k.users}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function UsersTab({ users, onOpen }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('id');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = {
      all: () => true,
      active: (u) => activeWithin(u, 7),
      quiet: (u) => !activeWithin(u, 7),
      nomentor: (u) => !u.mentorId,
      overdue: (u) => u.overdue > 0,
      admins: (u) => u.isAdmin,
      suspended: (u) => !!u.suspendedAt
    }[filter];
    const by = {
      id: (a, b) => (a.memberId || 'z').localeCompare(b.memberId || 'z'),
      active: (a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0),
      mutabaah: (a, b) => b.mutabaahDone - a.mutabaahDone,
      study: (a, b) => b.studyHours - a.studyHours,
      joined: (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    }[sort];
    return users
      .filter(match)
      .filter((u) => !q || [u.name, u.email, u.memberId, u.kampus, u.mentorName].some((text) => (text || '').toLowerCase().includes(q)))
      .sort(by);
  }, [users, query, filter, sort]);

  const count = (key) =>
    ({
      all: users.length,
      active: users.filter((u) => activeWithin(u, 7)).length,
      quiet: users.filter((u) => !activeWithin(u, 7)).length,
      nomentor: users.filter((u) => !u.mentorId).length,
      overdue: users.filter((u) => u.overdue > 0).length,
      admins: users.filter((u) => u.isAdmin).length,
      suspended: users.filter((u) => u.suspendedAt).length
    })[key];

  return (
    <>
      <div className="adm-toolbar">
        <label className="perf-search adm-search">
          <Search size={16} />
          <input type="search" placeholder="Search name, email, User ID or kampus" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </label>
        <select className="input adm-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort users by">
          {SORTS.map(([key, label]) => (
            <option key={key} value={key}>
              Sort: {label}
            </option>
          ))}
        </select>
      </div>
      <div className="chip-row adm-filters">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={`chip${filter === key ? ' on' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label} <span className="adm-chip-count">{count(key)}</span>
          </button>
        ))}
      </div>

      <div className="dl-result">
        {shown.length} of {users.length} users
      </div>

      {shown.length === 0 ? (
        <div className="card empty-state">
          <h3>No user matches that</h3>
          <p>Try another name, or choose a different filter.</p>
        </div>
      ) : (
        <div className="card adm-table-card">
          <div className="adm-table" role="table" aria-label="Users">
            <div className="adm-row adm-head" role="row">
              <span role="columnheader">User</span>
              <span role="columnheader">Last active</span>
              <span role="columnheader">Mutabaah · 7 days</span>
              <span role="columnheader">Study</span>
              <span role="columnheader">Assessments</span>
              <span role="columnheader">Mentor</span>
              <span />
            </div>
            {shown.map((u) => {
              const p = percent(u.mutabaahDone, WEEK_POSSIBLE);
              return (
                <button type="button" className={`adm-row${u.suspendedAt ? ' off' : ''}`} key={u._id} onClick={() => onOpen(u._id)} role="row">
                  <span className="adm-cell-user" role="cell">
                    <Avatar user={u} />
                    <span className="adm-user-text">
                      <span className="adm-user-name">
                        {u.name} <Tags user={u} />
                      </span>
                      <span className="adm-user-sub">
                        {u.memberId || 'No ID'} · {u.kampus || 'No kampus'}
                      </span>
                    </span>
                  </span>
                  <span className="adm-cell" data-label="Last active" role="cell">
                    <i className={`adm-dot${activeWithin(u, 1) ? ' on' : activeWithin(u, 7) ? ' week' : ''}`} />
                    {lastActive(u)}
                  </span>
                  <span className="adm-cell adm-cell-meter" data-label="Mutabaah" role="cell">
                    <span className="adm-meter">
                      <span className={`tone-${tone(p)}`} style={{ width: `${p}%` }} />
                    </span>
                    {p}%
                  </span>
                  <span className="adm-cell" data-label="Study" role="cell">
                    {hours(u.studyHours)}
                  </span>
                  <span className="adm-cell" data-label="Assessments" role="cell">
                    {u.assessments ? `${u.assessmentsDone}/${u.assessments}` : '–'}
                    {u.overdue > 0 && <span className="adm-overdue">{u.overdue} late</span>}
                  </span>
                  <span className="adm-cell" data-label="Mentor" role="cell">
                    {u.mentorName || '–'}
                    {u.mentees > 0 && <span className="adm-muted"> · {u.mentees} mentees</span>}
                  </span>
                  <ChevronRight size={16} className="adm-go" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// One user: their numbers, their place in the mentoring tree, and the account actions.
function UserSheet({ userId, users, period, me, onClose, onChanged, showToast }) {
  const [detail, setDetail] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');

  const load = useCallback(() => {
    if (!userId) return;
    setFailed(false);
    client
      .get(`/admin/users/${userId}`, { params: period })
      .then((res) => setDetail(res.data))
      .catch(() => setFailed(true));
  }, [userId, period]);

  useEffect(() => {
    setDetail(null);
    setConfirmDelete(false);
    setTyped('');
    load();
  }, [load]);

  if (!userId) return <Sheet open={false} onClose={onClose} title="" />;

  async function change(body, done) {
    setBusy(true);
    try {
      await client.patch(`/admin/users/${userId}`, body);
      showToast(done);
      load();
      onChanged();
    } catch (err) {
      showToast(errorText(err, "Couldn't save that change."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await client.delete(`/admin/users/${userId}`);
      showToast(`${detail.name}'s account was deleted`);
      onChanged();
      onClose();
    } catch (err) {
      showToast(errorText(err, "Couldn't delete the account."));
    } finally {
      setBusy(false);
    }
  }

  const self = userId === me._id;
  const locked = self || detail?.isOwner;
  const weekDone = detail ? detail.amal.reduce((sum, a) => sum + a.done, 0) : 0;
  const maxStudy = detail ? Math.max(1, ...detail.studyWeeks.map((w) => w.hours)) : 1;

  return (
    <Sheet open onClose={onClose} title={detail?.name || 'User'} stickyHead>
      {failed ? (
        <div className="empty-state">
          <h3>Couldn't load this user</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !detail ? (
        <div className="spinner" style={{ margin: '24px auto' }} />
      ) : (
        <div className="adm-detail">
          <div className="adm-detail-head">
            <Avatar user={detail} size={52} />
            <div className="adm-user-text">
              <span className="adm-user-name">
                {detail.memberId || 'No ID'} <Tags user={detail} />
              </span>
              <span className="adm-user-sub">{detail.email}</span>
              <span className="adm-user-sub">
                {detail.kampus || 'No kampus'} · joined {dayjs(detail.createdAt).format('D MMM YYYY')} · {lastActive(detail).toLowerCase()}
              </span>
            </div>
          </div>

          <div className="adm-mini">
            <div>
              <strong>{percent(weekDone, WEEK_POSSIBLE)}%</strong>
              <span>Mutabaah, 7 days</span>
            </div>
            <div>
              <strong>{hours(detail.studyWeeks[detail.studyWeeks.length - 1]?.hours || 0)}</strong>
              <span>Study this week</span>
            </div>
            <div>
              <strong>{detail.subjects.length}</strong>
              <span>Subjects</span>
            </div>
            <div>
              <strong>{detail.mentees.length}</strong>
              <span>Mentees</span>
            </div>
          </div>

          <div className="adm-section">Mutabaah, last 14 days (out of 7)</div>
          <Bars
            label="Amal done each day"
            max={7}
            items={detail.mutabaahDays.map((d, i) => ({
              key: d.date,
              value: d.done,
              label: Number(d.date.slice(8)),
              strong: i === detail.mutabaahDays.length - 1,
              title: `${dayjs(d.date).format('ddd D MMM')}: ${d.done} of 7`
            }))}
          />
          <div className="adm-amal">
            {detail.amal.map((a) => (
              <span key={a.key} className={a.done >= 5 ? 'good' : a.done <= 1 ? 'low' : ''}>
                {AMAL_LABEL[a.key] || a.key} <strong>{a.done}/7</strong>
              </span>
            ))}
          </div>

          <div className="adm-section">Study hours, last 6 weeks</div>
          <Bars
            label="Study hours each week"
            max={maxStudy}
            items={detail.studyWeeks.map((w, i) => ({
              key: w.weekStart,
              value: Math.round(w.hours * 10) / 10,
              label: dayjs(w.weekStart).format('D/M'),
              strong: i === detail.studyWeeks.length - 1,
              title: `Week of ${dayjs(w.weekStart).format('D MMM')}: ${hours(w.hours)}`
            }))}
          />
          <p className="adm-foot">
            This week: {detail.practiceSets} practice set{detail.practiceSets === 1 ? '' : 's'}, {detail.consultations} lecturer consultation
            {detail.consultations === 1 ? '' : 's'}. In {detail.studyGroups} study group{detail.studyGroups === 1 ? '' : 's'}, shared {detail.pastPapers} past paper
            {detail.pastPapers === 1 ? '' : 's'}, saved {detail.tadabburAyat} ayat for tadabbur.
          </p>

          <div className="adm-section">Subjects</div>
          {detail.subjects.length === 0 ? (
            <p className="log-empty">No subjects added.</p>
          ) : (
            <div className="adm-subjects">
              {detail.subjects.map((s) => (
                <div className="adm-subject" key={s._id}>
                  <BookOpen size={14} />
                  <span className="adm-subject-name">
                    {s.name}
                    {s.code && <small>{s.code}</small>}
                  </span>
                  <span className="adm-subject-count">
                    {s.assessments ? `${s.done}/${s.assessments} done` : 'No assessments'}
                    {s.overdue > 0 && <span className="adm-overdue">{s.overdue} late</span>}
                    {s.nextDue && <small>next {dayjs(s.nextDue).format('D MMM')}</small>}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="adm-section">Mentoring</div>
          <div className="field">
            <label htmlFor="adm-mentor">Mentor</label>
            <select
              id="adm-mentor"
              className="input"
              value={detail.mentorId || ''}
              disabled={busy}
              onChange={(e) => change({ mentorId: e.target.value || null }, e.target.value ? 'Mentor changed' : 'Mentor removed')}
            >
              <option value="">No mentor</option>
              {users
                .filter((u) => u._id !== userId)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.memberId || 'no ID'})
                  </option>
                ))}
            </select>
          </div>
          {detail.mentorId && (
            <div className="field">
              <label htmlFor="adm-group">Mentoring group</label>
              <select
                id="adm-group"
                className="input"
                value={detail.mentoringGroupId || ''}
                disabled={busy || detail.mentorGroups.length === 0}
                onChange={(e) => change({ mentoringGroupId: e.target.value || null }, e.target.value ? 'Group changed' : 'Taken out of the group')}
              >
                <option value="">{detail.mentorGroups.length ? 'Not in a group' : `${detail.mentor?.name || 'The mentor'} has made no groups yet`}</option>
                {detail.mentorGroups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                    {g.dayOfWeek !== null && g.dayOfWeek !== undefined ? ` · ${SHORT_DAYS[g.dayOfWeek]}` : ''}
                    {g.startTime ? ` ${clock(g.startTime)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {detail.mentees.length > 0 && (
            <p className="adm-foot">
              Mentees: {detail.mentees.map((m) => m.name).join(', ')}
            </p>
          )}

          <div className="adm-section">Account</div>
          {locked ? (
            <p className="adm-foot">{self ? "This is your own account, so its admin rights and status can't be changed here." : "This is the owner's account. It is always an admin and can't be suspended or deleted."}</p>
          ) : (
            <>
              <div className="adm-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => change({ isAdmin: !detail.isAdmin }, detail.isAdmin ? `${detail.name} is no longer an admin` : `${detail.name} is now an admin`)}
                >
                  <ShieldCheck size={14} /> {detail.isAdmin ? 'Remove admin' : 'Make admin'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => change({ suspended: !detail.suspendedAt }, detail.suspendedAt ? `${detail.name} can sign in again` : `${detail.name} is suspended`)}
                >
                  {detail.suspendedAt ? <CheckCircle2 size={14} /> : <Ban size={14} />} {detail.suspendedAt ? 'Lift suspension' : 'Suspend'}
                </button>
                <button type="button" className="btn btn-ghost adm-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={14} /> Delete account
                </button>
              </div>
              <p className="adm-foot">
                {detail.suspendedAt
                  ? `Suspended ${dayjs(detail.suspendedAt).fromNow()}. They are signed out and can't sign back in until it is lifted. Their data is kept.`
                  : 'Suspending signs them out and blocks sign-in, but keeps their data. Deleting removes the account and everything in it.'}
              </p>
              {confirmDelete && (
                <div className="adm-confirm">
                  <strong>Delete {detail.name}'s account?</strong>
                  <p>
                    This removes their mutabaah, journal, subjects, files, notes and messages for good. It can't be undone. Type <b>{detail.name}</b> to confirm.
                  </p>
                  <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={detail.name} aria-label="Type the user's name to confirm" autoFocus />
                  <div className="adm-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger" onClick={remove} disabled={busy || typed.trim() !== detail.name.trim()}>
                      Delete for good
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function PapersTab({ papers, onRemoved, showToast }) {
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return papers.filter((p) => !q || [p.subject, p.subjectCode, p.course, p.university, p.uploader?.name, p.fileName].some((t) => (t || '').toLowerCase().includes(q)));
  }, [papers, query]);

  async function remove(paper) {
    setBusy(true);
    try {
      await client.delete(`/admin/past-papers/${paper._id}`);
      showToast('Paper removed');
      setAsking(null);
      onRemoved(paper._id);
    } catch (err) {
      showToast(errorText(err, "Couldn't remove the paper."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="perf-search adm-search">
        <Search size={16} />
        <input type="search" placeholder="Search subject, course, university or who shared it" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="dl-result">
        {shown.length} of {papers.length} papers
      </div>
      {shown.length === 0 ? (
        <div className="card empty-state">
          <h3>{papers.length ? 'No paper matches that' : 'No papers shared yet'}</h3>
        </div>
      ) : (
        <div className="adm-papers">
          {shown.map((p) => (
            <div className="card adm-paper" key={p._id}>
              <span className="py-icon">
                <FileText size={18} />
              </span>
              <div className="adm-paper-body">
                <div className="adm-user-name">
                  {p.subject} {p.subjectCode && <span className="subject-code">{p.subjectCode}</span>}
                </div>
                <div className="adm-user-sub">
                  {[p.course, p.university].filter(Boolean).join(' · ')}
                </div>
                <div className="adm-user-sub">
                  {[p.year, p.paperType].filter(Boolean).join(' · ')}
                  {p.year || p.paperType ? ' · ' : ''}
                  Shared by {p.uploader ? `${p.uploader.name} (${p.uploader.memberId || 'no ID'})` : 'a deleted user'} · {dayjs(p.createdAt).fromNow()} · {p.favourites} favourite
                  {p.favourites === 1 ? '' : 's'}
                </div>
                {asking === p._id && (
                  <div className="adm-confirm">
                    <strong>Remove this paper for everyone?</strong>
                    <div className="adm-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setAsking(null)} disabled={busy}>
                        Cancel
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => remove(p)} disabled={busy}>
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="adm-paper-actions">
                <a className="btn btn-ghost btn-sm" href={p.fileUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
                <button type="button" className="icon-btn adm-danger" onClick={() => setAsking(p._id)} aria-label={`Remove ${p.subject}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// The admin dashboard: everyone who uses the app, in numbers, with the few
// things an admin may change. Only admins get here.
export default function Admin() {
  const { user } = useAuth();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [papers, setPapers] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openUser, setOpenUser] = useState(null);

  // My own today and week, so days line up with my timezone.
  const period = useMemo(() => ({ date: toDateKey(new Date()), weekStart: toDateKey(getWeekStart()) }), []);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      client.get('/admin/overview', { params: period }),
      client.get('/admin/users', { params: period }),
      client.get('/admin/past-papers')
    ])
      .then(([o, u, p]) => {
        setOverview(o.data);
        setUsers(u.data);
        setPapers(p.data);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    if (user?.isAdmin) load();
  }, [user?.isAdmin, load]);

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="page admin">
      <div className="page-header adm-header">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={22} /> Admin
          </h1>
          <p className="page-subtitle">Everyone using Double 4 Flat, in numbers</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="range-toggle segmented adm-tabs">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon size={14} /> {label}
            {key === 'users' && users ? <span className="adm-chip-count">{users.length}</span> : null}
            {key === 'papers' && papers ? <span className="adm-chip-count">{papers.length}</span> : null}
          </button>
        ))}
      </div>

      {failed ? (
        <div className="card empty-state">
          <h3>Couldn't load the dashboard</h3>
          <p>Check your connection and try again.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !overview || !users || !papers ? (
        <div className="spinner" style={{ margin: '40px auto' }} />
      ) : tab === 'overview' ? (
        <Overview data={overview} />
      ) : tab === 'users' ? (
        <UsersTab users={users} onOpen={setOpenUser} />
      ) : (
        <PapersTab papers={papers} showToast={showToast} onRemoved={(id) => setPapers((list) => list.filter((p) => p._id !== id))} />
      )}

      <p className="mentor-note adm-privacy">
        <ShieldCheck size={13} /> This dashboard shows activity and counts only. It never shows what people wrote: their notes, messages or files.
      </p>

      <UserSheet userId={openUser} users={users || []} period={period} me={user} onClose={() => setOpenUser(null)} onChanged={load} showToast={showToast} />
      {toast}
    </div>
  );
}
