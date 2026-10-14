import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, BellRing, CalendarClock, CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, CircleDashed, Clock, ListChecks, MapPin, MessagesSquare, Minus, PencilLine } from 'lucide-react';
import client from '../services/apiClient';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';
import { MUTABAAH_ICONS } from '../features/mutabaah/mutabaahIcons';
import { STUDY_CATEGORIES, WEEKLY_TARGET_HOURS } from '../features/academic/constants';
import { addDays, formatWeekLabel, getWeekStart, toDateKey } from '../features/academic/weekUtils';
import { DAYS, KIND_LABEL, SHORT_DAYS, clock, hueFor } from '../features/timetable/timetable';
import { ASSESSMENT_LABEL, isExam } from '../features/academic/deadlines';
import { useToast } from '../hooks/useToast';
import SocialLinks from '../components/SocialLinks';
import { Delta } from '../features/mentoring/MentoringDashboard';

const CATEGORY_LABEL = Object.fromEntries(STUDY_CATEGORIES.map((c) => [c.value, c.label]));
const todayKey = toDateKey(new Date());
const currentWeekKey = toDateKey(getWeekStart());

function shiftWeek(weekKey, weeks) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), weeks * 7));
}

function formatHours(h) {
  return `${Math.round(h * 10) / 10}h`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Whole days from today to a YYYY-MM-DD date.
function daysUntil(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const now = new Date();
  return Math.round((new Date(y, m - 1, d) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}

function weekdayOf(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}

function shortDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

// A card with an icon, a title, a line under it and something on the right.
function Section({ icon: Icon, title, sub, aside, children }) {
  return (
    <div className="card">
      <div className="log-section-head">
        <span className="log-section-icon">
          <Icon size={16} />
        </span>
        <div className="md-head-text">
          <div className="log-section-title">{title}</div>
          {sub && <div className="log-section-sub">{sub}</div>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

function subjectLabel(s) {
  if (!s) return 'No subject';
  return s.code ? `${s.name} (${s.code})` : s.name;
}

// What the page covers: the week (with arrows to earlier weeks), or the last 7, 14 or 30 days.
const PERIODS = [
  ['week', 'Week'],
  [7, '7 days'],
  [14, '14 days'],
  [30, '30 days']
];

// A mentor's view of one mentee: today's mutabaah item by item, the week's
// mutabaah, the week's academic log (studied or not, sessions, questions,
// lecturer consultations) and their class timetable. Read-only.
export default function MenteeDetail() {
  const { id } = useParams();
  const [week, setWeek] = useState(currentWeekKey);
  // 'week', or the number of days to look back from today (7, 14 or 30).
  const [period, setPeriod] = useState('week');
  const ranged = period !== 'week';
  const requestKey = `${id}|${ranged ? `days-${period}` : week}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The timetable day picked by hand; until then it follows today.
  const [pickedDay, setPickedDay] = useState(null);

  // Exam reminders sent from this visit: assessment id -> 'sending' | 'sent'.
  const [alerts, setAlerts] = useState({});
  const [toast, showToast] = useToast();

  useEffect(() => {
    setPickedDay(null);
    setAlerts({});
  }, [id]);

  async function sendAlert(deadline) {
    setAlerts((a) => ({ ...a, [deadline._id]: 'sending' }));
    try {
      await client.post(`/mentoring/mentees/${id}/alerts`, { assessmentId: deadline._id, date: todayKey });
      setAlerts((a) => ({ ...a, [deadline._id]: 'sent' }));
      showToast('Reminder sent');
    } catch (err) {
      setAlerts((a) => ({ ...a, [deadline._id]: undefined }));
      showToast(err.response?.data?.error || "Couldn't send the reminder");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setError('');
    client
      .get(`/mentoring/mentees/${id}`, { params: { date: todayKey, weekStart: ranged ? currentWeekKey : week, days: ranged ? period : undefined } })
      .then((res) => !cancelled && setData({ ...res.data, key: requestKey }))
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err.response?.status === 403
              ? "You can't view this person's updates. Only their mentor and the mates in their group can."
              : "Couldn't load this person's updates."
          )
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const back = (
    <Link to="/mentoring" className="quran-back">
      <ChevronLeft size={16} /> Mentoring Tree
    </Link>
  );

  if (error) {
    return (
      <div className="page">
        {back}
        <div className="card empty-state">
          <h3>{error}</h3>
        </div>
      </div>
    );
  }
  // Never show one person's updates under another's address while loading.
  if (!data || data.user._id !== id) {
    return (
      <div className="page">
        {back}
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      </div>
    );
  }

  const { user, mutabaah, academic } = data;
  // "Today" belongs to the period whenever the period reaches today.
  const isThisWeek = ranged || week === currentWeekKey;
  // While another period loads, the last one stays on screen, dimmed.
  const stale = data.key !== requestKey;
  const shownDays = mutabaah.week.length;
  // A long range: small squares and thin bars, with a date at each Sunday.
  const compact = shownDays > 7;
  const dateOf = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const dayMark = (key, i) => (compact ? (dateOf(key).getDay() === 0 || i === 0 ? dateOf(key).getDate() : '') : SHORT_DAYS[dateOf(key).getDay()]);
  // The weekly study target, stretched to the length of the range.
  const studyTarget = ranged ? Math.round((WEEKLY_TARGET_HOURS * period) / 7) : WEEKLY_TARGET_HOURS;
  // With the period before to compare against, a last column shows each amal's change.
  const compare = !!mutabaah.prevItems;
  const gridColumns = compact
    ? { gridTemplateColumns: `minmax(84px, 112px) repeat(${shownDays}, minmax(0, 1fr)) 40px${compare ? ' 34px' : ''}` }
    : undefined;
  const span = ranged ? `${period} days` : 'week';
  const prevAll = Object.values(mutabaah.prevItems || {}).reduce((sum, n) => sum + n, 0);
  const today = mutabaah.today;
  const doneToday = MUTABAAH_FIELDS.filter((f) => today[f.key]).length;

  const sessions = academic.studySessions;
  const hoursByDay = mutabaah.week.map((day) => sessions.filter((s) => s.date === day.date).reduce((sum, s) => sum + s.hours, 0));
  const totalHours = hoursByDay.reduce((a, b) => a + b, 0);
  const maxDayHours = Math.max(1, ...hoursByDay);
  const hoursToday = sessions.filter((s) => s.date === todayKey).reduce((sum, s) => sum + s.hours, 0);
  const totalQuestions = academic.questionPractice.reduce((sum, q) => sum + (q.questionCount || 0), 0);
  const consultations = academic.consultations;
  const maxQuestions = Math.max(1, ...academic.questionPractice.map((q) => q.questionCount || 0));
  const validatedSets = academic.questionPractice.filter((q) => q.isValidated).length;
  // Hours per subject for the week, most first.
  const hoursBySubject = Object.values(
    sessions.reduce((acc, x) => {
      const name = x.subject?.name || 'No subject';
      acc[name] = { name, hours: (acc[name]?.hours || 0) + x.hours };
      return acc;
    }, {})
  ).sort((a, b) => b.hours - a.hours);
  const validated = academic.mentorValidation?.isValidated;
  const timetable = data.timetable || [];
  const deadlines = data.deadlines || [];
  const isMentor = data.relation === 'mentee';
  const examCount = deadlines.filter((d) => isExam(d.type)).length;
  const weekday = new Date().getDay();
  const classesOn = (day) => timetable.filter((e) => e.dayOfWeek === day);
  const firstClassDay = DAYS.findIndex((_, day) => classesOn(day).length);
  const shownDay = pickedDay ?? (classesOn(weekday).length || firstClassDay === -1 ? weekday : firstClassDay);

  // The week so far: only days that have already come count towards the percentage.
  const elapsed = mutabaah.week.filter((day) => day.date <= todayKey);
  const doneOn = (day) => MUTABAAH_FIELDS.filter((f) => day[f.key]).length;
  const weekDone = elapsed.reduce((sum, day) => sum + doneOn(day), 0);
  const weekPercent = elapsed.length ? Math.round((weekDone / (elapsed.length * MUTABAAH_FIELDS.length)) * 100) : 0;
  const todayPercent = Math.round((doneToday / MUTABAAH_FIELDS.length) * 100);
  const ringTone = doneToday === MUTABAAH_FIELDS.length ? 'done' : doneToday === 0 ? 'none' : todayPercent >= 50 ? 'mid' : 'low';
  const targetPercent = Math.min(100, Math.round((totalHours / studyTarget) * 100));
  const thisOrThat = ranged ? `in the last ${period} days` : isThisWeek ? 'this week' : 'that week';

  const itemNote = (f) => {
    if (f.key === 'tilawah' && today.tilawahPages) return `${today.tilawahPages} pages`;
    if (f.key === 'zikir' && today.zikirCount) return `${today.zikirCount}x`;
    return today[f.key] ? 'Done' : 'Not done';
  };

  return (
    <div className="page">
      {back}
      <div className="md-stack">
        {/* ---------- who, and today at a glance ---------- */}
        <div className="card md-hero" style={{ '--hue': hueFor(user.name) }}>
          <div className="md-hero-band" />
          <div className="md-hero-main">
            {user.avatarUrl ? (
              <img className="avatar md-avatar" src={user.avatarUrl} alt="" />
            ) : (
              <div className="avatar md-avatar mentor-avatar-letter">{(user.name || '?').trim()[0]?.toUpperCase()}</div>
            )}
            <div className="md-hero-text">
              <h1 className="md-name">{user.name}</h1>
              <div className="md-meta">
                <span className="badge badge-gold">{data.relation === 'mate' ? 'Mentoring mate' : 'Your mentee'}</span>
                {[user.memberId, user.kampus].filter(Boolean).join(' · ')}
              </div>
              <SocialLinks person={user} />
            </div>
            <div className="md-ring-wrap">
              <span className={`today-ring md-ring tone-${ringTone}`} style={{ '--p': todayPercent }}>
                <span>
                  {doneToday}
                  <small>/{MUTABAAH_FIELDS.length}</small>
                </span>
              </span>
              <span className="md-ring-label">Mutabaah today</span>
            </div>
          </div>
          <div className="md-stats">
            {isThisWeek ? (
              <div className={`md-stat${hoursToday > 0 ? ' ok' : ''}`}>
                <strong>{hoursToday > 0 ? formatHours(hoursToday) : 'Not yet'}</strong>
                <span>Studied today</span>
              </div>
            ) : (
              <div className={`md-stat${weekPercent >= 50 ? ' ok' : ''}`}>
                <strong>{weekPercent}%</strong>
                <span>Mutabaah that week</span>
              </div>
            )}
            <div className={`md-stat${totalHours > 0 ? ' ok' : ''}`}>
              <strong>{formatHours(totalHours)}</strong>
              <span>Studied {ranged ? `in ${period} days` : thisOrThat}</span>
            </div>
            <div className={`md-stat${consultations.length > 0 ? ' ok' : ''}`}>
              <strong>{consultations.length > 0 ? consultations.length : 'No'}</strong>
              <span>Met lecturer {ranged ? `in ${period} days` : thisOrThat}</span>
            </div>
          </div>
        </div>

        {/* ---------- mutabaah today, item by item ---------- */}
        <Section
          icon={ListChecks}
          title="Mutabaah today"
          sub={doneToday === MUTABAAH_FIELDS.length ? 'Everything done' : `${MUTABAAH_FIELDS.length - doneToday} still to do`}
        >
          <div className="md-items">
            {MUTABAAH_FIELDS.map((f) => {
              const Icon = MUTABAAH_ICONS[f.key];
              return (
                <div key={f.key} className={`md-item${today[f.key] ? ' done' : ''}`}>
                  <span className="md-item-icon">{Icon && <Icon size={16} />}</span>
                  <span className="md-item-text">
                    <strong>{f.label}</strong>
                    <span>{itemNote(f)}</span>
                  </span>
                  {today[f.key] && (
                    <span className="md-item-check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        {/* ---------- exams and deadlines still to come ---------- */}
        <Section
          icon={CalendarClock}
          title="Exams and deadlines"
          sub={
            deadlines.length === 0
              ? 'From their subjects'
              : `${examCount} exam${examCount === 1 ? '' : 's'} · ${deadlines.length - examCount} due date${deadlines.length - examCount === 1 ? '' : 's'}`
          }
          aside={<span className="md-figure">{deadlines.length}</span>}
        >
          {deadlines.length === 0 ? (
            <p className="log-empty">Nothing coming up in their subjects.</p>
          ) : (
            <div className="md-deadlines">
              {deadlines.map((d) => {
                const days = daysUntil(d.dueDate);
                const tone = days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'later';
                const state = alerts[d._id];
                const [, month, day] = d.dueDate.split('-').map(Number);
                return (
                  <div className={`md-deadline tone-${tone}`} key={d._id}>
                    <span className="md-date" aria-hidden="true">
                      <small>{MONTHS[month - 1]}</small>
                      <strong>{day}</strong>
                    </span>
                    <div className="md-deadline-body">
                      <div className="md-deadline-title">
                        {ASSESSMENT_LABEL[d.type] || d.type}
                        <span className={`md-kind${isExam(d.type) ? ' exam' : ''}`}>{isExam(d.type) ? 'Exam' : 'Due'}</span>
                      </div>
                      <div className="md-deadline-meta">{subjectLabel(d.subject)}</div>
                      {isExam(d.type) && d.focusTopics && <div className="md-deadline-meta md-focus">Focus: {d.focusTopics}</div>}
                      <div className="md-deadline-meta">
                        {[weekdayOf(d.dueDate), d.dueTime && clock(d.dueTime), d.percentage ? `${d.percentage}%` : '', `${d.progressPercentage || 0}% ${isExam(d.type) ? 'revised' : 'done'}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <span className="md-countdown">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`}</span>
                    {isMentor && (
                      <div className="md-deadline-actions">
                        <span>{state === 'sent' ? `${user.name.split(' ')[0]} has been notified` : 'Notify their phone'}</span>
                        <button
                          type="button"
                          className={`btn btn-sm md-alert${state === 'sent' ? ' sent' : ''}`}
                          onClick={() => sendAlert(d)}
                          disabled={!!state}
                          aria-label={`Remind ${user.name} about this`}
                        >
                          {state === 'sent' ? <Check size={13} strokeWidth={3} /> : <BellRing size={13} />}
                          {state === 'sent' ? 'Sent' : state === 'sending' ? 'Sending…' : 'Remind'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ---------- which period the rest of the page covers ---------- */}
        <div className="range-toggle segmented md-period" role="group" aria-label="Period">
          {PERIODS.map(([key, label]) => (
            <button key={key} className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
        {ranged ? (
          <div className="md-week md-week-range">
            <div className="md-week-label">
              <strong>Last {period} days</strong>
              <span>
                {shortDate(toDateKey(addDays(new Date(), -(period - 1)))).split(', ')[1]} – {shortDate(todayKey).split(', ')[1]}
              </span>
            </div>
          </div>
        ) : (
          <div className="md-week">
            <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
              <ChevronLeft size={16} />
            </button>
            <div className="md-week-label">
              <strong>{isThisWeek ? 'This week' : formatWeekLabel(week)}</strong>
              {isThisWeek ? (
                <span>{formatWeekLabel(week)}</span>
              ) : (
                <button type="button" className="md-week-reset" onClick={() => setWeek(currentWeekKey)}>
                  Back to this week
                </button>
              )}
            </div>
            <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, 1))} disabled={isThisWeek} aria-label="Next week">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div className={`md-stack md-period-body${stale ? ' stale' : ''}`}>
        {/* ---------- mutabaah for the week ---------- */}
        <Section
          icon={CalendarRange}
          title={ranged ? `Mutabaah, last ${period} days` : `Mutabaah ${thisOrThat}`}
          sub={`${weekDone} of ${elapsed.length * MUTABAAH_FIELDS.length} done`}
          aside={<span className={`md-pill${weekPercent >= 80 ? ' ok' : weekPercent >= 50 ? ' mid' : ' low'}`}>{weekPercent}%</span>}
        >
          <div className={`mentee-grid perf-grid with-sum${compare ? ' with-delta' : ''}${compact ? ' compact' : ''}`} role="table" aria-label="Mutabaah by day">
            <div className="mentee-grid-row head" role="row" style={gridColumns}>
              <span />
              {mutabaah.week.map((day, i) => (
                <span key={day.date} className={day.date === todayKey ? 'today' : ''} role="columnheader">
                  {compact ? dayMark(day.date, i) : SHORT_DAYS[dateOf(day.date).getDay()][0]}
                </span>
              ))}
              <span className="perf-grid-sum" role="columnheader">
                Done
              </span>
              {compare && (
                <span className="perf-grid-sum" role="columnheader" title={`Change from the ${span} before`}>
                  ±
                </span>
              )}
            </div>
            {MUTABAAH_FIELDS.map((f) => (
              <div className="mentee-grid-row" role="row" key={f.key} style={gridColumns}>
                <span className="mentee-grid-name">{f.label}</span>
                {mutabaah.week.map((day) => (
                  <span
                    key={day.date}
                    role="cell"
                    className={`mentee-dot${day[f.key] ? ' done' : day.date > todayKey ? ' future' : ''}`}
                    title={`${f.label}, ${shortDate(day.date)}: ${day[f.key] ? 'done' : day.date > todayKey ? 'not yet' : 'not done'}`}
                  >
                    {compact ? '' : day[f.key] ? <Check size={11} strokeWidth={3} /> : day.date > todayKey ? '' : <Minus size={10} />}
                  </span>
                ))}
                {/* How many of the days so far this amal was done */}
                {(() => {
                  const done = elapsed.filter((day) => day[f.key]).length;
                  return (
                    <span
                      role="cell"
                      className={`perf-grid-sum${elapsed.length && done === elapsed.length ? ' full' : done * 2 < elapsed.length ? ' low' : ''}`}
                      title={`${f.label}: done on ${done} of ${elapsed.length} day${elapsed.length === 1 ? '' : 's'}`}
                    >
                      {done}
                      <small>/{elapsed.length}</small>
                    </span>
                  );
                })()}
                {compare && (
                  <Delta now={elapsed.filter((day) => day[f.key]).length} before={mutabaah.prevItems[f.key] || 0} known={mutabaah.hasPrev} what={span} />
                )}
              </div>
            ))}
            <div className="mentee-grid-row total" role="row" style={gridColumns}>
              <span className="mentee-grid-name">Done</span>
              {mutabaah.week.map((day) => (
                <span key={day.date} role="cell" className={day.date === todayKey ? 'today' : ''}>
                  {compact || day.date > todayKey ? '' : doneOn(day)}
                </span>
              ))}
              <span role="cell" className="perf-grid-sum">
                {weekDone}
                <small>/{elapsed.length * MUTABAAH_FIELDS.length}</small>
              </span>
              {compare && <Delta now={weekDone} before={prevAll} known={mutabaah.hasPrev} what={span} />}
            </div>
          </div>
          {compare && (
            <p className="perf-grid-note">
              {mutabaah.hasPrev
                ? `± is the change from ${ranged ? `the ${span} before` : elapsed.length < 7 ? 'the same days the week before' : 'the week before'}.`
                : `Nothing was logged the ${span} before, so there is no change to show.`}
            </p>
          )}
        </Section>

        {/* ---------- academic for the week ---------- */}
        <Section
          icon={Clock}
          title="Study hours"
          sub={`${sessions.length} session${sessions.length === 1 ? '' : 's'} ${thisOrThat}`}
          aside={
            <span className="md-figure">
              {formatHours(totalHours)}
              <small> / {studyTarget}h</small>
            </span>
          }
        >
          <div className="md-progress" role="img" aria-label={`${targetPercent}% of the target`}>
            <span style={{ width: `${targetPercent}%` }} />
          </div>
          <div className="md-target">
            <span>
              <strong>{targetPercent}%</strong> of the {ranged ? `${period}-day` : 'weekly'} target
            </span>
            <span>{totalHours >= studyTarget ? 'Target reached' : `${formatHours(studyTarget - totalHours)} to go`}</span>
          </div>
          {validated && (
            <div className="md-validated">
              <BadgeCheck size={14} /> Validated by mentor
            </div>
          )}

          <div
            className={`day-bars md-day-bars${compact ? ' compact' : ''}`}
            style={compact ? { gridTemplateColumns: `repeat(${shownDays}, minmax(0, 1fr))` } : undefined}
            aria-label="Hours per day"
          >
            {hoursByDay.map((h, i) => (
              <div
                key={mutabaah.week[i].date}
                className={`day-bar${mutabaah.week[i].date === todayKey ? ' today' : ''}${h ? ' has' : ''}`}
                title={`${shortDate(mutabaah.week[i].date)}: ${formatHours(h)}`}
              >
                <span className="day-bar-value">{h && !compact ? formatHours(h) : ''}</span>
                <span className="day-bar-track">
                  <span className="day-bar-fill" style={{ height: `${(h / maxDayHours) * 100}%` }} />
                </span>
                <span className="day-bar-label">{dayMark(mutabaah.week[i].date, i)}</span>
              </div>
            ))}
          </div>

          {sessions.length === 0 ? (
            <p className="log-empty">No study sessions logged {thisOrThat}.</p>
          ) : (
            <>
              {hoursBySubject.length > 1 && (
                <div className="md-subject-split" aria-label="Hours by subject">
                  {hoursBySubject.map((x) => (
                    <span key={x.name} style={{ '--hue': hueFor(x.name) }}>
                      <i />
                      {x.name} <strong>{formatHours(x.hours)}</strong>
                    </span>
                  ))}
                </div>
              )}
              <div className="md-sessions">
                {sessions.map((s) => {
                  const [, , day] = s.date.split('-').map(Number);
                  return (
                    <div className="md-session" key={s._id} style={{ '--hue': hueFor(s.subject?.name || '') }}>
                      <span className="md-date md-date-sm" aria-hidden="true">
                        <small>{shortDate(s.date).split(',')[0]}</small>
                        <strong>{day}</strong>
                      </span>
                      <div className="md-session-body">
                        <div className="md-session-title">{subjectLabel(s.subject)}</div>
                        {s.categories?.length > 0 && (
                          <div className="log-tags">
                            {s.categories.map((c) => (
                              <span key={c} className="log-tag">
                                {CATEGORY_LABEL[c] || c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="md-hours">{formatHours(s.hours)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Section>

        <div className="md-two">
          <Section
            icon={PencilLine}
            title="Practice questions"
            sub={
              academic.questionPractice.length
                ? `${validatedSets} of ${academic.questionPractice.length} set${academic.questionPractice.length === 1 ? '' : 's'} validated`
                : `Logged ${thisOrThat}`
            }
            aside={
              <span className="md-figure">
                {totalQuestions}
                <small> Q</small>
              </span>
            }
          >
            {academic.questionPractice.length === 0 ? (
              <p className="log-empty">No practice questions logged {thisOrThat}.</p>
            ) : (
              <div className="md-practice">
                {academic.questionPractice.map((q) => (
                  <div className="md-practice-row" key={q._id} style={{ '--hue': hueFor(q.subject?.name || '') }}>
                    <div className="md-practice-top">
                      <span className="md-practice-name">{subjectLabel(q.subject)}</span>
                      <span className="md-practice-count">
                        {q.questionCount || 0}
                        <small> Q</small>
                      </span>
                    </div>
                    <div className="md-practice-bar">
                      <span style={{ width: `${Math.round(((q.questionCount || 0) / maxQuestions) * 100)}%` }} />
                    </div>
                    <span className={`md-practice-state${q.isValidated ? ' ok' : ''}`}>
                      {q.isValidated ? <BadgeCheck size={13} /> : <CircleDashed size={13} />}
                      {q.isValidated ? 'Validated' : 'Not validated yet'}
                    </span>
                    {q.photoUrls?.length > 0 && (
                      <div className="photo-strip">
                        {q.photoUrls.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer" aria-label="Open photo">
                            <img src={url} alt="Questions done" loading="lazy" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            icon={MessagesSquare}
            title="Lecturer consultations"
            sub={consultations.length ? `Met a lecturer ${thisOrThat}` : `Logged ${thisOrThat}`}
            aside={<span className="md-figure">{consultations.length}</span>}
          >
            {consultations.length === 0 ? (
              <p className="log-empty">No lecturer consultations logged {thisOrThat}.</p>
            ) : (
              <div className="md-consults">
                {consultations.map((c) => {
                  const lecturer = c.lecturerName || c.subject?.lecturerName || 'Lecturer';
                  return (
                    <div className="md-consult" key={c._id}>
                      <div className="md-consult-head">
                        <span className="avatar md-consult-avatar mentor-avatar-letter" style={{ '--hue': hueFor(lecturer) }}>
                          {lecturer.replace(/^(dr|prof|ustaz|ustazah|encik|puan|mr|mrs|ms)\.?\s+/i, '').trim()[0]?.toUpperCase() || 'L'}
                        </span>
                        <div className="md-consult-who">
                          <strong>{lecturer}</strong>
                          {c.subject && <span>{subjectLabel(c.subject)}</span>}
                        </div>
                      </div>
                      <div className="md-consult-facts">
                        {c.date && (
                          <span>
                            <CalendarDays size={12} /> {shortDate(c.date)}
                          </span>
                        )}
                        {c.venue && (
                          <span>
                            <MapPin size={12} /> {c.venue}
                          </span>
                        )}
                      </div>
                      {c.detail && <p className="md-consult-note">{c.detail}</p>}
                      {c.signatureUrl && (
                        <div className="log-signature">
                          <img src={c.signatureUrl} alt="Lecturer's signature" loading="lazy" />
                          <span>Signed by the lecturer</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        </div>

        {/* ---------- their weekly classes, a day at a time ---------- */}
        <Section
          icon={CalendarDays}
          title="Timetable"
          sub="The same every week"
          aside={
            <span className="md-figure">
              {timetable.length}
              <small> class{timetable.length === 1 ? '' : 'es'}</small>
            </span>
          }
        >
          {timetable.length === 0 ? (
            <p className="log-empty">No classes in their timetable yet.</p>
          ) : (
            <>
              <div className="day-tabs md-day-tabs">
                {SHORT_DAYS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    className={`day-tab${day === shownDay ? ' selected' : ''}${day === weekday ? ' today' : ''}`}
                    onClick={() => setPickedDay(day)}
                    aria-pressed={day === shownDay}
                    aria-label={`${DAYS[day]}, ${classesOn(day).length} classes`}
                  >
                    {label}
                    <small>{classesOn(day).length || '·'}</small>
                  </button>
                ))}
              </div>
              {classesOn(shownDay).length === 0 ? (
                <p className="log-empty">
                  No classes on {DAYS[shownDay]}
                  {shownDay === weekday ? ' (today)' : ''}.
                </p>
              ) : (
                <div className="class-list">
                  {classesOn(shownDay).map((e) => (
                    <div key={e._id} className="class-card static" style={{ '--hue': hueFor(e.subject?.name || e.title) }}>
                      <span className="class-time">
                        <strong>{clock(e.startTime)}</strong>
                        <span>{clock(e.endTime)}</span>
                      </span>
                      <span className="class-body">
                        <span className="class-name">{e.title || e.subject?.name || 'Class'}</span>
                        <span className="class-meta">{[e.subject?.code, e.customKind || KIND_LABEL[e.kind] || e.kind].filter(Boolean).join(' · ')}</span>
                        {e.venue && (
                          <span className="class-meta">
                            <MapPin size={11} /> {e.venue}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      </div>
      {toast}
    </div>
  );
}
