import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Ban,
  BookOpen,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileStack,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
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

// The sections of the admin interface, each at its own address.
const SECTIONS = [
  { key: 'dashboard', to: '/admin', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard', sub: "Here's how everyone on Double 4 Flat is doing today." },
  { key: 'users', to: '/admin/users', label: 'Users', icon: Users, title: 'Users', sub: 'Everyone who has signed in, with this week beside each name.' },
  { key: 'mentoring', to: '/admin/mentoring', label: 'Mentoring', icon: Network, title: 'Mentoring', sub: "Each mentor's tree: their groups, their mentees, and the mentees under those." },
  { key: 'groups', to: '/admin/groups', label: 'Groups', icon: GraduationCap, title: 'Groups', sub: 'Every study group that has been created. Open one to read its chat.' },
  { key: 'papers', to: '/admin/papers', label: 'Past papers', icon: FileStack, title: 'Past papers', sub: 'Every paper users have shared. Remove one that should not be there.' }
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

function Stat({ icon: Icon, value, label, sub, tint = 'primary' }) {
  return (
    <div className="card adm-stat">
      <div className="adm-stat-text">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
      <span className={`adm-stat-icon tint-${tint}`}>
        <Icon size={18} />
      </span>
    </div>
  );
}

function Overview({ data, users, onOpen }) {
  const amal = [...data.amal].sort((a, b) => a.done - b.done);
  const amalPossible = Math.max(1, data.amalPeople * 7);
  // Who has been on most recently.
  const recent = [...users]
    .filter((u) => u.lastActiveAt)
    .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
    .slice(0, 6);
  return (
    <>
      <div className="adm-stats">
        <Stat icon={Users} value={data.users} label="Total users" sub={`${data.newThisWeek} joined in the last 7 days`} />
        <Stat icon={Activity} value={data.activeToday} label="Active today" sub={`${data.activeThisWeek} in the last 7 days`} tint="blue" />
        <Stat icon={ListChecks} value={data.mutabaahToday} label="Marked mutabaah today" sub={`of ${data.users} users`} tint="gold" />
        <Stat icon={Clock} value={hours(data.studyHoursThisWeek)} label="Study hours this week" sub={`logged by ${data.studyingThisWeek} users`} tint="purple" />
        <Stat
          icon={GraduationCap}
          value={data.studyGroups}
          label="Groups created"
          sub={`${data.groupsThisWeek} new · ${data.messagesThisWeek} messages in 7 days`}
        />
        <Stat
          icon={AlertTriangle}
          value={data.overdueAssessments}
          label="Overdue assessments"
          sub={`across ${data.subjects} subjects`}
          tint={data.overdueAssessments > 0 ? 'danger' : 'primary'}
        />
        <Stat icon={FileStack} value={data.pastPapers} label="Past papers shared" sub="Open to every user" tint="blue" />
        <Stat icon={Network} value={data.withMentor} label="Have a mentor" sub={`${data.mentors} mentors · ${data.suspended} suspended`} tint="purple" />
      </div>

      <div className="adm-split">
        <div className="card">
          <div className="adm-card-title adm-card-title-row">
            Recently active
            <Link to="/admin/users">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="log-empty">Nobody has been seen yet. This fills in as people open the app.</p>
          ) : (
            <div className="adm-activity">
              {recent.map((u) => {
                const p = percent(u.mutabaahDone, WEEK_POSSIBLE);
                return (
                  <button type="button" className="adm-activity-row" key={u._id} onClick={() => onOpen(u._id)}>
                    <Avatar user={u} size={38} />
                    <span className="adm-user-text">
                      <span className="adm-user-name">
                        {u.name} <Tags user={u} />
                      </span>
                      <span className="adm-user-sub">
                        {u.memberId || 'No ID'} · {u.kampus || 'No kampus'}
                      </span>
                      <span className="adm-user-sub">Active {lastActive(u)}</span>
                    </span>
                    <span className={`adm-pill tone-${tone(p)}`}>{p}% mutabaah</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="adm-card-title">
            Amal this week <span>Least done first</span>
          </div>
          {data.amalPeople === 0 ? (
            <p className="log-empty">Nobody has marked their mutabaah in the last 7 days.</p>
          ) : (
            <div className="adm-rank adm-rank-stacked">
              {amal.map((a) => {
                const p = percent(a.done, amalPossible);
                return (
                  <div className="adm-rank-row" key={a.key}>
                    <span className="adm-rank-name">{AMAL_LABEL[a.key] || a.key}</span>
                    <span className="adm-rank-value">{p}%</span>
                    <span className="adm-rank-bar">
                      <span className={`tone-${tone(p)}`} style={{ width: `${p}%` }} />
                    </span>
                  </div>
                );
              })}
              <p className="adm-foot">Out of every day of the last 7 for the {data.amalPeople} people who marked anything.</p>
            </div>
          )}
        </div>
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
  // The search is kept in the address (?q=), shared with the box in the top bar.
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';
  const setQuery = (text) => setParams(text ? { q: text } : {}, { replace: true });
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
      .filter((u) => !q || [u.name, u.email, u.memberId, u.kampus].some((text) => (text || '').toLowerCase().includes(q)))
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
      <label className="perf-search adm-search adm-search-wide adm-user-search">
        <Search size={16} />
        <input type="search" placeholder="Search a user by name, email, User ID or kampus" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search users by name" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={13} />
          </button>
        )}
      </label>
      <div className="adm-toolbar">
        <div className="chip-row adm-filters">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={`chip${filter === key ? ' on' : ''}`} aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label} <span className="adm-chip-count">{count(key)}</span>
          </button>
        ))}
        </div>
        <select className="input adm-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort users by">
          {SORTS.map(([key, label]) => (
            <option key={key} value={key}>
              Sort: {label}
            </option>
          ))}
        </select>
      </div>

      <div className="dl-result">
        {shown.length} of {users.length} users
        {query && <span>matching "{query}"</span>}
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

// One person in a mentoring tree, with their own mentees (in their groups)
// nested under them. A mentee who mentors others opens to show their tree too.
function TreeNode({ person, childrenOf, groupsOf, onOpen, depth, expandAll, path, flat = false }) {
  const mentees = childrenOf[person._id] || [];
  const [open, setOpen] = useState(depth === 0);
  const shown = expandAll || open || (flat && depth === 0);
  const p = percent(person.mutabaahDone, WEEK_POSSIBLE);
  // A loop in the data would never end, so a person already above is not opened again.
  // By mentor (`flat`), a card stops at the mentor's own mentees.
  const safe = !path.includes(person._id) && !(flat && depth > 0);

  // Mentees by the mentor's groups, then those in no group.
  const groups = groupsOf[person._id] || [];
  const branches = [
    ...groups.map((g) => ({ group: g, people: mentees.filter((m) => m.mentoringGroupId === g._id) })),
    { group: null, people: mentees.filter((m) => !groups.some((g) => g._id === m.mentoringGroupId)) }
  ].filter((b) => b.people.length > 0 || b.group);

  return (
    <div className={`adm-node${depth === 0 ? ' root' : ''}`}>
      <div className="adm-node-row">
        {flat ? null : mentees.length > 0 && safe ? (
          <button type="button" className="icon-btn adm-node-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={shown} aria-label={`${shown ? 'Hide' : 'Show'} ${person.name}'s mentees`}>
            {shown ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="adm-node-leaf" />
        )}
        <button type="button" className="adm-node-person" onClick={() => onOpen(person._id)}>
          <Avatar user={person} size={depth === 0 ? 40 : 32} />
          <span className="adm-user-text">
            <span className="adm-user-name">
              {person.name} <Tags user={person} />
              {mentees.length > 0 && <span className="badge badge-muted">{mentees.length} mentee{mentees.length === 1 ? '' : 's'}</span>}
            </span>
            <span className="adm-user-sub">
              {person.memberId || 'No ID'} · {person.kampus || 'No kampus'} · {lastActive(person).toLowerCase()}
            </span>
          </span>
          <span className={`adm-pill tone-${tone(p)}`}>{p}%</span>
        </button>
      </div>

      {shown && safe && mentees.length > 0 && (
        <div className="adm-node-children">
          {branches.map((b) => (
            <div className="adm-branch" key={b.group?._id || 'none'}>
              {(b.group || groups.length > 0) && (
                <div className="adm-branch-title">
                  {b.group ? b.group.name : 'Not in a group'}
                  {b.group && (
                    <span>
                      {[
                        b.group.dayOfWeek !== null && b.group.dayOfWeek !== undefined ? SHORT_DAYS[b.group.dayOfWeek] : '',
                        b.group.startTime ? clock(b.group.startTime) : '',
                        b.group.venue
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No time set'}
                    </span>
                  )}
                  <em>{b.people.length}</em>
                </div>
              )}
              {b.people.length === 0 ? (
                <p className="adm-foot adm-branch-empty">Nobody in this group yet.</p>
              ) : (
                b.people.map((m) => (
                  <TreeNode key={m._id} person={m} childrenOf={childrenOf} groupsOf={groupsOf} onOpen={onOpen} depth={depth + 1} expandAll={expandAll} path={[...path, person._id]} flat={flat} />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The mentoring trees: one per mentor at the top of a line, with everyone under them.
function MentoringTab({ users, mentoringGroups, onOpen }) {
  const [query, setQuery] = useState('');
  const [expandAll, setExpandAll] = useState(false);
  // 'tree': whole lines from the top mentor down. 'mentor': a card per mentor with their own mentees.
  const [view, setView] = useState('tree');
  const byMentor = view === 'mentor';

  const { childrenOf, groupsOf, mentors, roots } = useMemo(() => {
    const kids = {};
    users.forEach((u) => {
      if (u.mentorId) (kids[u.mentorId] ||= []).push(u);
    });
    Object.values(kids).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    const groups = {};
    mentoringGroups.forEach((g) => (groups[g.mentorId] ||= []).push(g));
    const all = users.filter((u) => kids[u._id]);
    const ids = new Set(users.map((u) => u._id));
    return {
      childrenOf: kids,
      groupsOf: groups,
      mentors: all,
      // Trees start from the mentors who have no mentor themselves.
      roots: all.filter((u) => !u.mentorId || !ids.has(u.mentorId)).sort((a, b) => a.name.localeCompare(b.name))
    };
  }, [users, mentoringGroups]);

  // Searching shows the tree of every mentor that matches, wherever they sit.
  const q = query.trim().toLowerCase();
  const everyMentor = useMemo(() => [...mentors].sort((a, b) => a.name.localeCompare(b.name)), [mentors]);
  const shown = q
    ? mentors.filter((u) => [u.name, u.memberId, u.kampus, u.email].some((t) => (t || '').toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name))
    : byMentor
      ? everyMentor
      : roots;
  const withMentor = users.filter((u) => u.mentorId).length;

  return (
    <>
      <div className="adm-mini adm-group-totals">
        <div>
          <strong>{mentors.length}</strong>
          <span>Mentors</span>
        </div>
        <div>
          <strong>{withMentor}</strong>
          <span>Mentees</span>
        </div>
        <div>
          <strong>{mentoringGroups.length}</strong>
          <span>Mentoring groups</span>
        </div>
        <div>
          <strong>{users.length - withMentor - roots.length}</strong>
          <span>In no tree</span>
        </div>
      </div>

      <div className="range-toggle segmented adm-view">
        <button className={byMentor ? '' : 'active'} onClick={() => setView('tree')}>
          <Network size={14} /> Tree
        </button>
        <button className={byMentor ? 'active' : ''} onClick={() => setView('mentor')}>
          <Users size={14} /> By mentor
        </button>
      </div>

      <div className="adm-toolbar">
        <label className="perf-search adm-search adm-search-wide">
          <Search size={16} />
          <input type="search" placeholder="Search a mentor by name, User ID or kampus" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {!byMentor && (
          <button type="button" className="btn btn-ghost adm-expand" onClick={() => setExpandAll((v) => !v)} aria-pressed={expandAll}>
            {expandAll ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>
      <div className="dl-result">
        {q
          ? `${shown.length} of ${mentors.length} mentors`
          : byMentor
            ? `${mentors.length} mentor${mentors.length === 1 ? '' : 's'}, each with their own mentees`
            : `${roots.length} tree${roots.length === 1 ? '' : 's'} · ${mentors.length} mentors`}
      </div>

      {shown.length === 0 ? (
        <div className="card empty-state">
          <h3>{mentors.length ? 'No mentor matches that' : 'Nobody has mentees yet'}</h3>
          <p>{mentors.length ? 'Try another name or User ID.' : "Set a user's mentor from the Users section, and their tree shows here."}</p>
        </div>
      ) : (
        <div className="adm-trees">
          {shown.map((m) => (
            <div className="card adm-tree" key={m._id}>
              <TreeNode person={m} childrenOf={childrenOf} groupsOf={groupsOf} onOpen={onOpen} depth={0} expandAll={expandAll && !byMentor} path={[]} flat={byMentor} />
            </div>
          ))}
        </div>
      )}
      <p className="adm-foot">The figure beside each person is their mutabaah over the last 7 days. Tap a person to open them and change their mentor or group.</p>
    </>
  );
}

// Every study group, as cards; opening one shows its members and chat.
function GroupsTab({ groups, onOpen }) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => !q || [g.name, g.subject, g.owner?.name].some((t) => (t || '').toLowerCase().includes(q)));
  }, [groups, query]);
  const messages = groups.reduce((sum, g) => sum + g.messages, 0);

  return (
    <>
      <div className="adm-mini adm-group-totals">
        <div>
          <strong>{groups.length}</strong>
          <span>Groups created</span>
        </div>
        <div>
          <strong>{groups.reduce((sum, g) => sum + g.members, 0)}</strong>
          <span>Memberships</span>
        </div>
        <div>
          <strong>{messages}</strong>
          <span>Messages sent</span>
        </div>
        <div>
          <strong>{groups.filter((g) => g.messagesThisWeek > 0).length}</strong>
          <span>Active in 7 days</span>
        </div>
      </div>

      <label className="perf-search adm-search adm-search-wide">
        <Search size={16} />
        <input type="search" placeholder="Search group name, subject or who made it" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="dl-result">
        {shown.length} of {groups.length} groups
      </div>

      {shown.length === 0 ? (
        <div className="card empty-state">
          <h3>{groups.length ? 'No group matches that' : 'No groups created yet'}</h3>
        </div>
      ) : (
        <div className="adm-papers">
          {shown.map((g) => (
            <button type="button" className="card adm-paper adm-group" key={g._id} onClick={() => onOpen(g._id)}>
              <span className="py-icon">
                <GraduationCap size={18} />
              </span>
              <span className="adm-paper-body">
                <span className="adm-user-name">{g.name}</span>
                <span className="adm-user-sub">
                  {g.subject || 'No subject'} · made by {g.owner?.name || 'a deleted user'} · {dayjs(g.createdAt).format('D MMM YYYY')}
                </span>
                <span className="adm-group-facts">
                  <span>
                    <Users size={12} /> {g.members} member{g.members === 1 ? '' : 's'}
                  </span>
                  <span>
                    <MessageSquare size={12} /> {g.messages} message{g.messages === 1 ? '' : 's'}
                  </span>
                  <span>{g.lastMessageAt ? `Last message ${dayjs(g.lastMessageAt).fromNow()}` : 'No messages yet'}</span>
                </span>
              </span>
              <ChevronRight size={16} className="adm-go" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// One group: its members, and its chat to read without joining. Read-only.
function GroupSheet({ groupId, onClose }) {
  const [group, setGroup] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const chatRef = useRef(null);

  // A chat opens at its latest message.
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [group?._id]);

  const load = useCallback(() => {
    if (!groupId) return;
    setFailed(false);
    client
      .get(`/admin/groups/${groupId}`)
      .then((res) => setGroup(res.data))
      .catch(() => setFailed(true));
  }, [groupId]);

  useEffect(() => {
    setGroup(null);
    load();
  }, [load]);

  if (!groupId) return <Sheet open={false} onClose={onClose} title="" />;

  async function loadEarlier() {
    setLoadingEarlier(true);
    try {
      const res = await client.get(`/admin/groups/${groupId}`, { params: { before: group.messages[0].createdAt } });
      setGroup((g) => ({ ...g, messages: [...res.data.messages, ...g.messages], hasEarlier: res.data.hasEarlier }));
    } catch {
      // Left as it is; the button can be tapped again.
    } finally {
      setLoadingEarlier(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={group?.name || 'Group'} stickyHead>
      {failed ? (
        <div className="empty-state">
          <h3>Couldn't load this group</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !group ? (
        <div className="spinner" style={{ margin: '24px auto' }} />
      ) : (
        <div className="adm-detail">
          <p className="adm-foot" style={{ marginTop: 0 }}>
            {group.subject || 'No subject'} · created {dayjs(group.createdAt).format('D MMM YYYY')}
          </p>

          <div className="adm-section">Members ({group.members.length})</div>
          <div className="adm-amal">
            {group.members.map((m) => (
              <span key={m._id} className={m.role === 'admin' ? 'good' : ''}>
                <strong>{m.name}</strong> {m.memberId || ''}
                {m.role === 'admin' ? ' · group admin' : ''}
              </span>
            ))}
          </div>

          <div className="adm-section">Chat · read only</div>
          {group.messages.length === 0 ? (
            <p className="log-empty">Nobody has written in this group yet.</p>
          ) : (
            <div className="adm-chat" ref={chatRef}>
              {group.hasEarlier && (
                <button type="button" className="btn btn-ghost btn-sm adm-chat-earlier" onClick={loadEarlier} disabled={loadingEarlier}>
                  {loadingEarlier ? 'Loading…' : 'Show earlier messages'}
                </button>
              )}
              {group.messages.map((m, i) => {
                const prev = group.messages[i - 1];
                const newDay = !prev || !dayjs(prev.createdAt).isSame(m.createdAt, 'day');
                return (
                  <div key={m._id}>
                    {newDay && <div className="adm-chat-day">{dayjs(m.createdAt).format('ddd, D MMM YYYY')}</div>}
                    <div className="adm-chat-msg">
                      <div className="adm-chat-who">
                        <strong>{m.sender?.name || 'Deleted user'}</strong>
                        <span>{dayjs(m.createdAt).format('h:mm a')}</span>
                      </div>
                      {m.content && <p>{m.content}</p>}
                      {m.attachmentType === 'image' && m.attachmentUrl && (
                        <a href={m.attachmentUrl} target="_blank" rel="noreferrer">
                          <img src={m.attachmentUrl} alt="Shared in the chat" loading="lazy" />
                        </a>
                      )}
                      {m.attachmentType === 'file' && m.attachmentUrl && (
                        <a className="file-link" href={m.attachmentUrl} target="_blank" rel="noreferrer">
                          <FileText size={13} /> Open the shared file
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="adm-foot">You are reading as an admin. The group is not told, and you can't post from here.</p>
        </div>
      )}
    </Sheet>
  );
}

// The users table as a spreadsheet file (opens in Excel).
function downloadUsers(users) {
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const head = ['User ID', 'Name', 'Email', 'Kampus', 'Joined', 'Last active', 'Mutabaah 7 days (%)', 'Study hours this week', 'Subjects', 'Assessments done', 'Assessments', 'Overdue', 'Mentor', 'Mentees', 'Admin', 'Suspended'];
  const rows = users.map((u) => [
    u.memberId,
    u.name,
    u.email,
    u.kampus,
    dayjs(u.createdAt).format('YYYY-MM-DD'),
    u.lastActiveAt ? dayjs(u.lastActiveAt).format('YYYY-MM-DD HH:mm') : '',
    percent(u.mutabaahDone, WEEK_POSSIBLE),
    Math.round(u.studyHours * 10) / 10,
    u.subjects,
    u.assessmentsDone,
    u.assessments,
    u.overdue,
    u.mentorName,
    u.mentees,
    u.isAdmin ? 'Yes' : '',
    u.suspendedAt ? 'Yes' : ''
  ]);
  const csv = [head, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  // The BOM makes Excel read names with accents correctly.
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `double4flat-users-${toDateKey(new Date())}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The admin interface, at /admin: its own layout (a sidebar, a top bar with
// search) rather than the user app's. Everyone who uses the app, in numbers,
// with the few things an admin may change. Only admins get in.
export default function Admin() {
  const { user, logout } = useAuth();
  const [toast, showToast] = useToast();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState(null);
  const [papers, setPapers] = useState(null);
  const [groups, setGroups] = useState(null);
  const [mentoringGroups, setMentoringGroups] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openUser, setOpenUser] = useState(null);
  // On a phone the sidebar is a menu that slides in; it closes on moving to a section.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const section = SECTIONS.find((s) => s.to !== '/admin' && pathname.startsWith(s.to)) || SECTIONS[0];
  const search = section.key === 'users' ? params.get('q') || '' : '';

  // My own today and week, so days line up with my timezone.
  const period = useMemo(() => ({ date: toDateKey(new Date()), weekStart: toDateKey(getWeekStart()) }), []);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([
      client.get('/admin/overview', { params: period }),
      client.get('/admin/users', { params: period }),
      client.get('/admin/past-papers'),
      client.get('/admin/groups'),
      client.get('/admin/mentoring-groups')
    ])
      .then(([o, u, p, g, mg]) => {
        setMentoringGroups(mg.data);
        setOverview(o.data);
        setUsers(u.data);
        setPapers(p.data);
        setGroups(g.data);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    if (user?.isAdmin) load();
  }, [user?.isAdmin, load]);

  useEffect(() => {
    document.title = 'Admin · Double 4 Flat';
    return () => {
      document.title = 'Double 4 Flat — Halaqah Tracker';
    };
  }, []);

  if (!user?.isAdmin) return <Navigate to="/" replace />;

  const counts = { users: users?.length, groups: groups?.length, papers: papers?.length };

  return (
    <div className={`adm-shell${menuOpen ? ' menu-open' : ''}`}>
      {menuOpen && <div className="adm-backdrop" onClick={() => setMenuOpen(false)} />}
      <aside className="adm-side" id="adm-menu">
        <div className="adm-brand">
          <span className="brand-mark">
            <ShieldCheck size={16} />
          </span>
          <span>
            Double 4 Flat
            <small>Admin</small>
          </span>
          <button type="button" className="icon-btn adm-menu-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={15} />
          </button>
        </div>
        <nav className="adm-nav" aria-label="Admin sections">
          {SECTIONS.map(({ key, to, label, icon: Icon }) => (
            <NavLink key={key} to={to} end={to === '/admin'} className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}>
              <Icon size={17} />
              <span>{label}</span>
              {counts[key] !== undefined && <span className="adm-chip-count">{counts[key]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="adm-side-foot">
          <Link to="/" className="adm-nav-link">
            <ArrowLeft size={17} />
            <span>Back to the app</span>
          </Link>
          <button type="button" className="adm-nav-link" onClick={logout}>
            <LogOut size={17} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <button type="button" className="icon-btn adm-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="adm-menu">
            <Menu size={18} />
          </button>
          <label className="perf-search adm-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search users by name, email, User ID or kampus"
              value={search}
              onChange={(e) => navigate(e.target.value ? `/admin/users?q=${encodeURIComponent(e.target.value)}` : '/admin/users', { replace: section.key === 'users' })}
              aria-label="Search users"
            />
            {search && (
              <button type="button" onClick={() => navigate('/admin/users', { replace: true })} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </label>
          <div className="adm-me">
            <Avatar user={user} size={34} />
            <span className="adm-user-text">
              <span className="adm-user-name">{user.name}</span>
              <span className="adm-user-sub">{user.email}</span>
            </span>
          </div>
        </header>

        <main className="adm-content">
          <div className="adm-header">
            <div>
              <h1 className="page-title">{section.title}</h1>
              <p className="page-subtitle">{section.sub}</p>
            </div>
            <div className="adm-header-actions">
              <button type="button" className="btn btn-ghost" onClick={() => users && downloadUsers(users)} disabled={!users}>
                <Download size={14} /> Export users
              </button>
              <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'adm-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {failed ? (
            <div className="card empty-state">
              <h3>Couldn't load the dashboard</h3>
              <p>Check your connection and try again.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
                Try again
              </button>
            </div>
          ) : !overview || !users || !papers || !groups || !mentoringGroups ? (
            <div className="spinner" style={{ margin: '40px auto' }} />
          ) : section.key === 'dashboard' ? (
            <Overview data={overview} users={users} onOpen={setOpenUser} />
          ) : section.key === 'users' ? (
            <UsersTab users={users} onOpen={setOpenUser} />
          ) : section.key === 'mentoring' ? (
            <MentoringTab users={users} mentoringGroups={mentoringGroups} onOpen={setOpenUser} />
          ) : section.key === 'groups' ? (
            <GroupsTab groups={groups} onOpen={setOpenGroup} />
          ) : (
            <PapersTab papers={papers} showToast={showToast} onRemoved={(id) => setPapers((list) => list.filter((p) => p._id !== id))} />
          )}

          <p className="mentor-note adm-privacy">
            <ShieldCheck size={13} /> This dashboard shows activity and counts, and lets admins read study group chats. It never shows what people wrote for themselves: their
            journal notes, tadabbur notes or files.
          </p>
        </main>
      </div>

      <GroupSheet groupId={openGroup} onClose={() => setOpenGroup(null)} />
      <UserSheet userId={openUser} users={users || []} period={period} me={user} onClose={() => setOpenUser(null)} onChanged={load} showToast={showToast} />
      {toast}
    </div>
  );
}
