import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import client from '../../services/apiClient';
import { WEEKLY_TARGET_HOURS } from '../academic/constants';
import { addDays, formatWeekLabel, getWeekStart, toDateKey } from '../academic/weekUtils';

const todayKey = toDateKey(new Date());
const currentWeekKey = toDateKey(getWeekStart());
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORTS = [
  ['mutabaah', 'Mutabaah'],
  ['study', 'Study'],
  ['name', 'Name']
];

function shiftWeek(weekKey, weeks) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), weeks * 7));
}

function tone(percent) {
  return percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'low';
}

// Change in mutabaah % against the week before, as a small coloured arrow.
function Trend({ now, before, suffix = '' }) {
  if (before === null || before === undefined) return null;
  const change = now - before;
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={`perf-trend ${change > 0 ? 'up' : change < 0 ? 'down' : 'flat'}`}
      title={`${change > 0 ? 'Up' : change < 0 ? 'Down' : 'No change'} from ${before}% the week before`}
    >
      <Icon size={12} />
      {change === 0 ? 'same' : `${Math.abs(change)}`}
      {suffix}
    </span>
  );
}

// What a mentor would want to follow up on. Only for the week in progress.
function concerns(person) {
  const list = [];
  if (person.mutabaahToday === 0) list.push('nothing ticked today');
  else if (person.mutabaahPercent < 50) list.push(`mutabaah at ${person.mutabaahPercent}% this week`);
  if (person.studyHours === 0 && person.daysElapsed >= 3) list.push('no study logged this week');
  return list;
}

// Sunday-to-Saturday strip: how much of each day's mutabaah was done.
function DayStrip({ days, total }) {
  return (
    <span className="perf-days" aria-label="Mutabaah by day">
      {days.map((done, i) => (
        <span
          key={i}
          className={`perf-day${done === null ? ' future' : done === total ? ' full' : done === 0 ? ' none' : ''}`}
          style={done ? { '--fill': done / total } : undefined}
          title={`${DAY_NAMES[i]}: ${done === null ? 'not yet' : `${done}/${total}`}`}
        >
          {DAY_LETTERS[i]}
        </span>
      ))}
    </span>
  );
}

function PersonRow({ person, rank, isThisWeek }) {
  const hoursPercent = Math.min(100, Math.round((person.studyHours / WEEKLY_TARGET_HOURS) * 100));
  const body = (
    <>
      {rank !== null && <span className="perf-rank">{rank}</span>}
      <div className="perf-body">
        <div className="perf-head">
          <span className="perf-name">{person.name}</span>
          {person.isMe && <span className="badge badge-gold">You</span>}
          <DayStrip days={person.days} total={person.mutabaahTotal} />
        </div>
        <div className="perf-bars">
          <span className="perf-bar-label">Mutabaah</span>
          <span className="perf-bar">
            <span className={`perf-bar-fill tone-${tone(person.mutabaahPercent)}`} style={{ width: `${person.mutabaahPercent}%` }} />
          </span>
          <span className="perf-bar-value">
            {person.mutabaahPercent}%
            <Trend now={person.mutabaahPercent} before={person.prevMutabaahPercent} />
          </span>
          <span className="perf-bar-label">Study</span>
          <span className="perf-bar">
            <span className={`perf-bar-fill tone-${tone(hoursPercent)}`} style={{ width: `${hoursPercent}%` }} />
          </span>
          <span className="perf-bar-value">{person.studyHours}h</span>
        </div>
        <div className="perf-chips">
          {isThisWeek && (
            <span className={`perf-chip${person.mutabaahToday === person.mutabaahTotal ? ' ok' : ''}`}>
              {person.mutabaahToday}/{person.mutabaahTotal} today
            </span>
          )}
          {isThisWeek && <span className={`perf-chip${person.studiedToday ? ' ok' : ''}`}>{person.studiedToday ? 'Studied today' : 'No study yet today'}</span>}
          {person.questions > 0 && <span className="perf-chip">{person.questions} questions</span>}
          {person.consultations > 0 && <span className="perf-chip ok">Met lecturer ×{person.consultations}</span>}
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
  const [sort, setSort] = useState('mutabaah');
  const isThisWeek = week === currentWeekKey;

  useEffect(() => {
    let cancelled = false;
    setError(false);
    client
      .get('/mentoring/dashboard', { params: { date: todayKey, weekStart: week } })
      .then((res) => !cancelled && setData(res.data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [week]);

  // Default to mentees when there are any (a mentor's main interest), else mates.
  const active = groupKey || (data && data.mentees.people.length === 0 && data.mates.people.length > 0 ? 'mates' : 'mentees');
  const group = data?.[active];

  const people = useMemo(() => {
    if (!group) return [];
    const list = [...group.people];
    if (sort === 'study') list.sort((a, b) => b.studyHours - a.studyHours || b.mutabaahPercent - a.mutabaahPercent);
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list; // 'mutabaah' is the order the server sends
  }, [group, sort]);

  const attention = useMemo(
    () => (group && isThisWeek ? group.people.filter((p) => !p.isMe).map((p) => ({ person: p, why: concerns(p) })).filter((x) => x.why.length) : []),
    [group, isThisWeek]
  );

  const weekNav = (
    <div className="date-nav">
      <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
        <ChevronLeft size={16} />
      </button>
      <span className="date-label">{isThisWeek ? `This week · ${formatWeekLabel(week)}` : formatWeekLabel(week)}</span>
      <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, 1))} disabled={isThisWeek} aria-label="Next week">
        <ChevronRight size={16} />
      </button>
    </div>
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
  if (!data || data.weekStart !== week) {
    return (
      <>
        {weekNav}
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      </>
    );
  }

  const { summary } = group;
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

      {group.people.length === 0 ? (
        <div className="card">
          <p className="log-empty">
            {active === 'mentees'
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
              <div className={`perf-hero-ring tone-${tone(summary.avgMutabaahPercent)}`} style={{ '--p': summary.avgMutabaahPercent }}>
                <span>{summary.avgMutabaahPercent}%</span>
              </div>
              <div className="perf-hero-text">
                <div className="perf-hero-title">Average mutabaah</div>
                <div className="perf-hero-sub">
                  {active === 'mates' ? 'You and your mentoring mates' : `Your ${summary.count} mentee${summary.count === 1 ? '' : 's'}`}
                </div>
                {summary.mutabaahChange !== null && (
                  <div className={`perf-hero-trend ${summary.mutabaahChange > 0 ? 'up' : summary.mutabaahChange < 0 ? 'down' : 'flat'}`}>
                    {summary.mutabaahChange > 0 ? <ArrowUpRight size={13} /> : summary.mutabaahChange < 0 ? <ArrowDownRight size={13} /> : <Minus size={13} />}
                    {summary.mutabaahChange === 0 ? 'Same as the week before' : `${Math.abs(summary.mutabaahChange)} points ${summary.mutabaahChange > 0 ? 'up' : 'down'} on the week before`}
                  </div>
                )}
              </div>
            </div>
            <div className="week-stats perf-summary">
              <div className="week-stat">
                <span className="week-stat-value">{summary.avgStudyHours}h</span>
                <span className="week-stat-label">Avg study</span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">{isThisWeek ? `${summary.studiedToday}/${summary.count}` : '–'}</span>
                <span className="week-stat-label">Studied today</span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">
                  {summary.metLecturer}/{summary.count}
                </span>
                <span className="week-stat-label">Met lecturer</span>
              </div>
            </div>
          </div>

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
              <span className="perf-sort" role="group" aria-label="Sort by">
                {SORTS.map(([key, label]) => (
                  <button key={key} type="button" className={`chip${sort === key ? ' on' : ''}`} onClick={() => setSort(key)}>
                    {label}
                  </button>
                ))}
              </span>
            </div>
            {people.map((p, i) => (
              <PersonRow key={p._id} person={p} rank={sort === 'name' ? null : i + 1} isThisWeek={isThisWeek} />
            ))}
          </div>

          <p className="mentor-note">
            Mutabaah is the share of items done on the days of the week so far; the arrow compares it with the whole week
            before. Study is against the {WEEKLY_TARGET_HOURS}-hour weekly target. The letters are Sunday to Saturday: the
            fuller the square, the more was done that day.
          </p>
        </>
      )}
    </>
  );
}
