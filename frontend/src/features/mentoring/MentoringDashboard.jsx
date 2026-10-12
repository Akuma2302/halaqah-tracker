import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock, GraduationCap, Minus, PenLine, Search, Timer, X } from 'lucide-react';
import client from '../../services/apiClient';
import { WEEKLY_TARGET_HOURS } from '../academic/constants';
import { addDays, formatWeekLabel, getWeekStart, toDateKey } from '../academic/weekUtils';
import { MUTABAAH_FIELDS } from '../mutabaah/mutabaahFields';
import { MUTABAAH_ICONS } from '../mutabaah/mutabaahIcons';
import { hueFor } from '../timetable/timetable';

const todayKey = toDateKey(new Date());
const currentWeekKey = toDateKey(getWeekStart());
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const AMAL_LABEL = Object.fromEntries(MUTABAAH_FIELDS.map((f) => [f.key, f.label]));

// The amal a person has skipped most on the days so far, or null if none was skipped.
function mostMissed(person) {
  if (!person.items || !person.daysElapsed) return null;
  const [key, done] = Object.entries(person.items).sort((a, b) => a[1] - b[1])[0] || [];
  return key && done < person.daysElapsed ? { label: AMAL_LABEL[key] || key, missed: person.daysElapsed - done } : null;
}

function shiftWeek(weekKey, weeks) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), weeks * 7));
}

// What to look at: the week (with arrows to earlier weeks), or the last 7, 14 or 30 days.
const PERIODS = [
  ['week', 'Week'],
  [7, '7 days'],
  [14, '14 days'],
  [30, '30 days']
];

// Which side of someone's week to show.
const VIEWS = [
  ['all', 'All'],
  ['mutabaah', 'Mutabaah'],
  ['academic', 'Academic']
];

function rangeLabel(from, to) {
  const fmt = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };
  return `${fmt(from)} – ${fmt(to)}`;
}

// The group's averages, worked out here so they follow the mentoring-group filter.
function summarize(people) {
  const n = people.length;
  const avg = (pick) => (n ? people.reduce((sum, p) => sum + pick(p), 0) / n : 0);
  const withPrev = people.filter((p) => p.prevMutabaahPercent !== null && p.prevMutabaahPercent !== undefined);
  return {
    count: n,
    mutabaahChange: withPrev.length ? Math.round(withPrev.reduce((sum, p) => sum + (p.mutabaahPercent - p.prevMutabaahPercent), 0) / withPrev.length) : null,
    avgMutabaahPercent: Math.round(avg((p) => p.mutabaahPercent)),
    avgStudyHours: Math.round(avg((p) => p.studyHours) * 10) / 10,
    studiedToday: people.filter((p) => p.studiedToday).length,
    metLecturer: people.filter((p) => p.consultations > 0).length,
    questions: people.reduce((sum, p) => sum + (p.questions || 0), 0)
  };
}

function tone(percent) {
  return percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'low';
}

// Change in mutabaah % against the week before, as a small coloured arrow.
function Trend({ now, before, suffix = '', span = 'week' }) {
  if (before === null || before === undefined) return null;
  const change = now - before;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={`perf-trend ${change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}`}
      title={`${change > 0 ? 'Up' : change < 0 ? 'Down' : 'No change'} from ${before}% the ${span} before`}
    >
      <Icon size={12} />
      {change === 0 ? 'same' : `${Math.abs(change)}`}
      {suffix}
    </span>
  );
}

// What a mentor would want to follow up on. Only for the week in progress.
// `view` keeps it to the mutabaah side or the academic side.
function concerns(person, view, when) {
  const list = [];
  if (view !== 'academic') {
    if (person.mutabaahToday === 0) list.push('nothing ticked today');
    else if (person.mutabaahPercent < 50) list.push(`mutabaah at ${person.mutabaahPercent}% ${when}`);
  }
  if (view !== 'mutabaah' && person.studyHours === 0 && person.daysElapsed >= 3) list.push(`no study logged ${when}`);
  return list;
}

// How much of each day's mutabaah was done. For a week it runs Sunday to
// Saturday; for a range (`dayKeys` are its dates) it runs oldest to newest,
// and past 7 days the squares are too small to carry a letter.
function DayStrip({ days, total, dayKeys }) {
  const dayOf = (i) => {
    if (!dayKeys) return { letter: DAY_LETTERS[i], name: DAY_NAMES[i] };
    const [y, m, d] = dayKeys[i].split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return { letter: DAY_LETTERS[date.getDay()], name: date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) };
  };
  const compact = days.length > 7;
  return (
    <span className={`perf-days${compact ? ' compact' : ''}`} aria-label="Mutabaah by day">
      {days.map((done, i) => {
        const { letter, name } = dayOf(i);
        return (
          <span
            key={i}
            className={`perf-day${done === null ? ' future' : done === total ? ' full' : done === 0 ? ' none' : ''}`}
            style={done ? { '--fill': done / total } : undefined}
            title={`${name}: ${done === null ? 'not yet' : `${done}/${total}`}`}
          >
            {compact ? '' : letter}
          </span>
        );
      })}
    </span>
  );
}

function PersonRow({ person, rank, isThisWeek, view, studyTarget, span }) {
  const hoursPercent = Math.min(100, Math.round((person.studyHours / studyTarget) * 100));
  const showMutabaah = view !== 'academic';
  const showAcademic = view !== 'mutabaah';
  const missed = mostMissed(person);
  const body = (
    <>
      <span className="perf-avatar-wrap">
        {person.avatarUrl ? (
          <img className="avatar perf-avatar" src={person.avatarUrl} alt="" />
        ) : (
          <span className="avatar perf-avatar mentor-avatar-letter" style={{ '--hue': hueFor(person.name) }}>
            {(person.name || '?').trim()[0]?.toUpperCase()}
          </span>
        )}
        <span className="perf-rank" title={`Number ${rank} by ${view === 'academic' ? 'study hours' : 'mutabaah'}`}>
          {rank}
        </span>
      </span>
      <div className="perf-body">
        <div className="perf-head">
          <span className="perf-name">{person.name}</span>
          {person.isMe && <span className="badge badge-gold">You</span>}
          {showMutabaah && <DayStrip days={person.days} total={person.mutabaahTotal} dayKeys={person.dayKeys} />}
        </div>
        <div className="perf-bars">
          {showMutabaah && (
            <>
              <span className="perf-bar-label">Mutabaah</span>
              <span className="perf-bar">
                <span className={`perf-bar-fill tone-${tone(person.mutabaahPercent)}`} style={{ width: `${person.mutabaahPercent}%` }} />
              </span>
              <span className="perf-bar-value">
                {person.mutabaahPercent}%
                <Trend now={person.mutabaahPercent} before={person.prevMutabaahPercent} span={span} />
              </span>
            </>
          )}
          {showAcademic && (
            <>
              <span className="perf-bar-label">Study</span>
              <span className="perf-bar">
                <span className={`perf-bar-fill tone-${tone(hoursPercent)}`} style={{ width: `${hoursPercent}%` }} />
              </span>
              <span className="perf-bar-value">{person.studyHours}h</span>
            </>
          )}
        </div>
        <div className="perf-chips">
          {isThisWeek && showMutabaah && (
            <span className={`perf-chip${person.mutabaahToday === person.mutabaahTotal ? ' ok' : ''}`}>
              {person.mutabaahToday}/{person.mutabaahTotal} today
            </span>
          )}
          {isThisWeek && showAcademic && (
            <span className={`perf-chip${person.studiedToday ? ' ok' : ''}`}>{person.studiedToday ? 'Studied today' : 'No study yet today'}</span>
          )}
          {showAcademic && view === 'academic' && (
            <span className="perf-chip">
              {person.studySessions} study session{person.studySessions === 1 ? '' : 's'}
            </span>
          )}
          {showAcademic && person.questions > 0 && <span className="perf-chip">{person.questions} questions</span>}
          {showAcademic && person.consultations > 0 && <span className="perf-chip ok">Met lecturer ×{person.consultations}</span>}
          {showMutabaah && missed && (
            <span className="perf-chip warn" title={`Not done on ${missed.missed} of ${person.daysElapsed} day${person.daysElapsed === 1 ? '' : 's'}`}>
              Misses {missed.label} most
            </span>
          )}
        </div>
      </div>
      {!person.isMe && <ChevronRight size={16} className="mentee-chevron" />}
    </>
  );
  // Your own row isn't a link: your detail lives on your own pages.
  return person.isMe ? (
    <div className="perf-row me">{body}</div>
  ) : (
    <Link to={`/mentoring/${person._id}`} className="perf-row">
      {body}
    </Link>
  );
}

// Overall performance for a week, one group at a time: your mentees, or your
// mentoring mates (you included). Group averages with the trend, who needs
// attention, then everyone with a day-by-day strip.
export default function MentoringDashboard() {
  const [week, setWeek] = useState(currentWeekKey);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [groupKey, setGroupKey] = useState(null); // chosen by the user; null = pick a sensible default
  const [query, setQuery] = useState('');
  // 'week', or the number of days to look back from today.
  const [period, setPeriod] = useState('week');
  const [view, setView] = useState('all');
  // A mentor's own mentoring group to narrow the mentees to: '' = all, 'none' = in no group.
  const [mentoringGroup, setMentoringGroup] = useState('');
  const ranged = period !== 'week';
  // "Today" figures make sense whenever the period reaches today.
  const isThisWeek = ranged || week === currentWeekKey;
  const requestKey = ranged ? `days-${period}` : week;
  const span = ranged ? `${period} days` : 'week';
  // The weekly study target, stretched to the length of the range.
  const studyTarget = ranged ? Math.round((WEEKLY_TARGET_HOURS * period) / 7) : WEEKLY_TARGET_HOURS;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    client
      .get('/mentoring/dashboard', { params: { date: todayKey, weekStart: ranged ? currentWeekKey : week, days: ranged ? period : undefined } })
      .then((res) => !cancelled && setData({ ...res.data, key: requestKey }))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  // Default to mentees when there are any (a mentor's main interest), else mates.
  const active = groupKey || (data && data.mentees.people.length === 0 && data.mates.people.length > 0 ? 'mates' : 'mentees');
  const myGroups = data?.groups || [];
  // The group filter only applies to my own mentees, and only to a group that still exists.
  const groupFilter = active === 'mentees' && (mentoringGroup === 'none' || myGroups.some((g) => g._id === mentoringGroup)) ? mentoringGroup : '';

  // The chosen mentoring group, ranked for the view: study hours first for
  // Academic, otherwise mutabaah first as the server sends them.
  const group = useMemo(() => {
    const raw = data?.[active];
    if (!raw) return null;
    const known = new Set(myGroups.map((g) => g._id));
    let list = raw.people.filter((p) => !groupFilter || (groupFilter === 'none' ? !known.has(p.groupId) : p.groupId === groupFilter));
    if (view === 'academic') list = [...list].sort((a, b) => b.studyHours - a.studyHours || b.questions - a.questions || a.name.localeCompare(b.name));
    return { people: list, summary: summarize(list), total: raw.people.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, active, groupFilter, view]);

  // The search narrows by name or User ID; the rank is the place in the whole list.
  const people = useMemo(() => {
    if (!group) return [];
    const q = query.trim().toLowerCase();
    return group.people
      .map((p, i) => ({ person: p, rank: i + 1 }))
      .filter(({ person }) => !q || person.name.toLowerCase().includes(q) || (person.memberId || '').toLowerCase().includes(q));
  }, [group, query]);

  // Each amal across the whole group for the days so far, least done first.
  const amal = useMemo(() => {
    if (!group) return [];
    const possible = group.people.reduce((sum, p) => sum + (p.daysElapsed || 0), 0);
    if (!possible || !group.people.some((p) => p.items)) return [];
    return MUTABAAH_FIELDS.map((f) => {
      const done = group.people.reduce((sum, p) => sum + (p.items?.[f.key] || 0), 0);
      return { key: f.key, label: f.label, done, possible, percent: Math.round((done / possible) * 100) };
    }).sort((a, b) => a.percent - b.percent);
  }, [group]);

  const attention = useMemo(
    () =>
      group && isThisWeek
        ? group.people
            .filter((p) => !p.isMe)
            .map((p) => ({ person: p, why: concerns(p, view, ranged ? `in ${period} days` : 'this week') }))
            .filter((x) => x.why.length)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group, isThisWeek, view, period]
  );

  const weekNav = (
    <>
      <div className="range-toggle segmented perf-period" role="group" aria-label="Period">
        {PERIODS.map(([key, label]) => (
          <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>
            {label}
          </button>
        ))}
      </div>
      {ranged ? (
        <div className="date-nav perf-range-label">
          <span className="date-label">
            Last {period} days · {rangeLabel(toDateKey(addDays(new Date(), -(period - 1))), todayKey)}
          </span>
        </div>
      ) : (
        <div className="date-nav">
          <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
            <ChevronLeft size={16} />
          </button>
          <span className="date-label">{week === currentWeekKey ? `This week · ${formatWeekLabel(week)}` : formatWeekLabel(week)}</span>
          <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, 1))} disabled={week === currentWeekKey} aria-label="Next week">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );

  if (error) {
    return (
      <>
        {weekNav}
        <div className="card empty-state">
          <h3>Couldn't load the dashboard</h3>
          <p>Check your connection and try again.</p>
        </div>
      </>
    );
  }
  if (!data || data.key !== requestKey) {
    return (
      <>
        {weekNav}
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      </>
    );
  }

  const { summary } = group;
  const studyPercent = Math.min(100, Math.round((summary.avgStudyHours / studyTarget) * 100));
  const others = group.people.filter((p) => !p.isMe).length;

  return (
    <>
      {weekNav}

      <div className="range-toggle segmented perf-groups">
        <button className={active === 'mentees' ? 'active' : ''} onClick={() => setGroupKey('mentees')}>
          Mentees ({data.mentees.summary.count})
        </button>
        <button className={active === 'mates' ? 'active' : ''} onClick={() => setGroupKey('mates')}>
          Mates ({Math.max(0, data.mates.summary.count - 1)})
        </button>
      </div>

      {/* ---------- which mentoring group, and which side of the week ---------- */}
      <div className="perf-filters">
        {active === 'mentees' && myGroups.length > 0 && (
          <label className="field">
            <span>Mentoring group</span>
            <select className="input" value={groupFilter} onChange={(e) => setMentoringGroup(e.target.value)}>
              <option value="">All groups</option>
              {myGroups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
              <option value="none">Not in a group</option>
            </select>
          </label>
        )}
        <div className="field">
          <span>Show</span>
          <div className="chip-row">
            {VIEWS.map(([key, label]) => (
              <button key={key} type="button" className={`chip${view === key ? ' on' : ''}`} aria-pressed={view === key} onClick={() => setView(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {group.people.length === 0 ? (
        <div className="card">
          <p className="log-empty">
            {groupFilter
              ? 'No mentee is in that group yet.'
              : active === 'mentees'
              ? "You don't have any mentees yet. They appear here once they add your User ID as their mentor."
              : data.hasMentor
                ? 'Nobody else is under your mentor yet.'
                : 'Add a mentor on the Tree tab to see how you and your mentoring mates are doing.'}
          </p>
        </div>
      ) : (
        <>
          {/* ---------- group at a glance ---------- */}
          <div className="card perf-overview">
            <div className="perf-hero">
              {view === 'academic' ? (
                <div className={`perf-hero-ring tone-${tone(studyPercent)}`} style={{ '--p': studyPercent }}>
                  <span>{summary.avgStudyHours}h</span>
                </div>
              ) : (
                <div className={`perf-hero-ring tone-${tone(summary.avgMutabaahPercent)}`} style={{ '--p': summary.avgMutabaahPercent }}>
                  <span>{summary.avgMutabaahPercent}%</span>
                </div>
              )}
              <div className="perf-hero-text">
                <div className="perf-hero-title">{view === 'academic' ? 'Average study hours' : 'Average mutabaah'}</div>
                <div className="perf-hero-sub">
                  {active === 'mates'
                    ? 'You and your mentoring mates'
                    : `${groupFilter ? `${summary.count} of your ${group.total}` : `Your ${summary.count}`} mentee${(groupFilter ? group.total : summary.count) === 1 ? '' : 's'}`}
                  {view === 'academic' ? ` · target ${studyTarget}h each` : ''}
                </div>
                {view !== 'academic' && summary.mutabaahChange !== null && (
                  <div className={`perf-hero-trend ${summary.mutabaahChange > 0 ? 'up' : summary.mutabaahChange < 0 ? 'down' : 'flat'}`}>
                    {summary.mutabaahChange > 0 ? <ArrowUpRight size={13} /> : summary.mutabaahChange < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                    {summary.mutabaahChange === 0
                      ? `Same as the ${span} before`
                      : `${Math.abs(summary.mutabaahChange)} points ${summary.mutabaahChange > 0 ? 'up' : 'down'} on the ${span} before`}
                  </div>
                )}
              </div>
            </div>
            <div className="perf-facts">
              {view === 'academic' ? (
                <div className="perf-fact">
                  <span className="perf-fact-icon">
                    <PenLine size={15} />
                  </span>
                  <strong>{summary.questions}</strong>
                  <span>Questions</span>
                </div>
              ) : (
                <div className="perf-fact">
                  <span className="perf-fact-icon">
                    <Timer size={15} />
                  </span>
                  <strong>{summary.avgStudyHours}h</strong>
                  <span>Avg study</span>
                </div>
              )}
              <div className="perf-fact">
                <span className="perf-fact-icon">
                  <Clock size={15} />
                </span>
                <strong>{isThisWeek ? `${summary.studiedToday}/${summary.count}` : '–'}</strong>
                <span>Studied today</span>
              </div>
              <div className="perf-fact">
                <span className="perf-fact-icon">
                  <GraduationCap size={15} />
                </span>
                <strong>
                  {summary.metLecturer}/{summary.count}
                </strong>
                <span>Met lecturer</span>
              </div>
            </div>
          </div>

          {/* ---------- mutabaah, amal by amal: which is skipped most ---------- */}
          {view !== 'academic' && amal.length > 0 && (
            <div className="card perf-amal">
              <div className="log-section-head">
                <span className="log-section-icon">
                  <BarChart3 size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="log-section-title">Mutabaah by amal</div>
                  <div className="log-section-sub">Least done first, {ranged ? `over the last ${period} days` : isThisWeek ? 'this week so far' : 'that week'}</div>
                </div>
              </div>
              {amal[0].percent < 100 && (
                <p className="perf-amal-lead">
                  <strong>{amal[0].label}</strong> is missed the most: done {amal[0].done} of {amal[0].possible} time{amal[0].possible === 1 ? '' : 's'}.
                </p>
              )}
              <div className="perf-amal-list">
                {amal.map((a, i) => {
                  const Icon = MUTABAAH_ICONS[a.key];
                  return (
                    <div className={`perf-amal-row tone-${tone(a.percent)}${i === 0 && a.percent < 100 ? ' worst' : ''}`} key={a.key}>
                      <span className="perf-amal-icon">{Icon && <Icon size={14} />}</span>
                      <span className="perf-amal-name">{a.label}</span>
                      <span className="perf-bar">
                        <span className={`perf-bar-fill tone-${tone(a.percent)}`} style={{ width: `${a.percent}%` }} />
                      </span>
                      <span className="perf-amal-value">
                        {a.percent}%
                        <small>
                          {a.done}/{a.possible}
                        </small>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---------- who to follow up with ---------- */}
          {isThisWeek && others > 0 && (
            <div className={`card perf-attention${attention.length ? '' : ' clear'}`}>
              <div className="perf-attention-title">
                {attention.length ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
                {attention.length ? `Needs attention (${attention.length})` : 'Everyone is on track today'}
              </div>
              {attention.map(({ person, why }) => (
                <Link key={person._id} to={`/mentoring/${person._id}`} className="perf-attention-row">
                  <span className="perf-attention-name">{person.name}</span>
                  <span className="perf-attention-why">{why.join(' · ')}</span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          )}

          {/* ---------- everyone ---------- */}
          <div className="card perf-group">
            <div className="perf-list-head">
              <span className="log-section-title">{active === 'mates' ? 'Mentoring mates' : 'Mentees'}</span>
              <span className="perf-count">
                {query.trim() ? `${people.length} of ${group.people.length}` : `${group.people.length}`}
              </span>
            </div>
            <label className="perf-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or User ID"
                aria-label="Search by name or User ID"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            {people.length === 0 ? (
              <p className="log-empty">Nobody matches "{query.trim()}".</p>
            ) : (
              people.map(({ person, rank }) => (
                <PersonRow key={person._id} person={person} rank={rank} isThisWeek={isThisWeek} view={view} studyTarget={studyTarget} span={span} />
              ))
            )}
          </div>

          <p className="mentor-note">
            {ranged
              ? `Mutabaah is the share of items done over the last ${period} days; the arrow compares it with the ${period} days before. Study is against a ${studyTarget}-hour target for the period. Each square is a day, oldest first: the fuller it is, the more was done.`
              : `Mutabaah is the share of items done on the days of the week so far; the arrow compares it with the whole week before. Study is against the ${WEEKLY_TARGET_HOURS}-hour weekly target. The letters are Sunday to Saturday: the fuller the square, the more was done that day.`}
          </p>
        </>
      )}
    </>
  );
}
