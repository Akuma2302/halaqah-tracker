import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock, GraduationCap, Minus, Search, Timer, X } from 'lucide-react';
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
        <span className="perf-rank" title={`Number ${rank} by mutabaah`}>
          {rank}
        </span>
      </span>
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
          {missed && (
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

  // Best mutabaah first, as the server sends them; the search narrows by name or User ID.
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
            <div className="perf-facts">
              <div className="perf-fact">
                <span className="perf-fact-icon">
                  <Timer size={15} />
                </span>
                <strong>{summary.avgStudyHours}h</strong>
                <span>Avg study</span>
              </div>
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
          {amal.length > 0 && (
            <div className="card perf-amal">
              <div className="log-section-head">
                <span className="log-section-icon">
                  <BarChart3 size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="log-section-title">Mutabaah by amal</div>
                  <div className="log-section-sub">Least done first, {isThisWeek ? 'this week so far' : 'that week'}</div>
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
              people.map(({ person, rank }) => <PersonRow key={person._id} person={person} rank={rank} isThisWeek={isThisWeek} />)
            )}
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
