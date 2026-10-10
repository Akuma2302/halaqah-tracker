import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, CalendarRange, Check, ChevronLeft, ChevronRight, Clock, ListChecks, MapPin, MessagesSquare, Minus, PencilLine } from 'lucide-react';
import client from '../services/apiClient';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';
import { MUTABAAH_ICONS } from '../features/mutabaah/mutabaahIcons';
import { STUDY_CATEGORIES, WEEKLY_TARGET_HOURS } from '../features/academic/constants';
import { addDays, formatWeekLabel, getWeekStart, toDateKey } from '../features/academic/weekUtils';
import { DAYS, KIND_LABEL, SHORT_DAYS, clock, hueFor } from '../features/timetable/timetable';

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

// A mentor's view of one mentee: today's mutabaah item by item, the week's
// mutabaah, the week's academic log (studied or not, sessions, questions,
// lecturer consultations) and their class timetable. Read-only.
export default function MenteeDetail() {
  const { id } = useParams();
  const [week, setWeek] = useState(currentWeekKey);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  // The timetable day picked by hand; until then it follows today.
  const [pickedDay, setPickedDay] = useState(null);

  useEffect(() => setPickedDay(null), [id]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    client
      .get(`/mentoring/mentees/${id}`, { params: { date: todayKey, weekStart: week } })
      .then((res) => !cancelled && setData(res.data))
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err.response?.status === 403
              ? "You can't view this person's updates. Only their mentor and mentoring mates can."
              : "Couldn't load this person's updates."
          )
      );
    return () => {
      cancelled = true;
    };
  }, [id, week]);

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
  const isThisWeek = week === currentWeekKey;
  const today = mutabaah.today;
  const doneToday = MUTABAAH_FIELDS.filter((f) => today[f.key]).length;

  const sessions = academic.studySessions;
  const hoursByDay = mutabaah.week.map((day) => sessions.filter((s) => s.date === day.date).reduce((sum, s) => sum + s.hours, 0));
  const totalHours = hoursByDay.reduce((a, b) => a + b, 0);
  const maxDayHours = Math.max(1, ...hoursByDay);
  const hoursToday = sessions.filter((s) => s.date === todayKey).reduce((sum, s) => sum + s.hours, 0);
  const totalQuestions = academic.questionPractice.reduce((sum, q) => sum + (q.questionCount || 0), 0);
  const consultations = academic.consultations;
  const validated = academic.mentorValidation?.isValidated;
  const timetable = data.timetable || [];
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
  const targetPercent = Math.min(100, Math.round((totalHours / WEEKLY_TARGET_HOURS) * 100));
  const thisOrThat = isThisWeek ? 'this week' : 'that week';

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
              <span>Studied {thisOrThat}</span>
            </div>
            <div className={`md-stat${consultations.length > 0 ? ' ok' : ''}`}>
              <strong>{consultations.length > 0 ? consultations.length : 'No'}</strong>
              <span>Met lecturer {thisOrThat}</span>
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

        {/* ---------- week picker: everything below follows it ---------- */}
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

        {/* ---------- mutabaah for the week ---------- */}
        <Section
          icon={CalendarRange}
          title={`Mutabaah ${thisOrThat}`}
          sub={`${weekDone} of ${elapsed.length * MUTABAAH_FIELDS.length} done`}
          aside={<span className={`md-pill${weekPercent >= 80 ? ' ok' : weekPercent >= 50 ? ' mid' : ' low'}`}>{weekPercent}%</span>}
        >
          <div className="mentee-grid" role="table" aria-label="Mutabaah by day">
            <div className="mentee-grid-row head" role="row">
              <span />
              {mutabaah.week.map((day, i) => (
                <span key={day.date} className={day.date === todayKey ? 'today' : ''} role="columnheader">
                  {SHORT_DAYS[i][0]}
                </span>
              ))}
            </div>
            {MUTABAAH_FIELDS.map((f) => (
              <div className="mentee-grid-row" role="row" key={f.key}>
                <span className="mentee-grid-name">{f.label}</span>
                {mutabaah.week.map((day) => (
                  <span
                    key={day.date}
                    role="cell"
                    className={`mentee-dot${day[f.key] ? ' done' : day.date > todayKey ? ' future' : ''}`}
                    title={`${f.label}, ${shortDate(day.date)}: ${day[f.key] ? 'done' : day.date > todayKey ? 'not yet' : 'not done'}`}
                  >
                    {day[f.key] ? <Check size={11} strokeWidth={3} /> : day.date > todayKey ? '' : <Minus size={10} />}
                  </span>
                ))}
              </div>
            ))}
            <div className="mentee-grid-row total" role="row">
              <span className="mentee-grid-name">Done</span>
              {mutabaah.week.map((day) => (
                <span key={day.date} role="cell" className={day.date === todayKey ? 'today' : ''}>
                  {day.date > todayKey ? '' : doneOn(day)}
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* ---------- academic for the week ---------- */}
        <Section
          icon={Clock}
          title="Study hours"
          sub={`${sessions.length} session${sessions.length === 1 ? '' : 's'}${validated ? ' · validated by mentor' : ''}`}
          aside={
            <span className="md-figure">
              {formatHours(totalHours)}
              <small> / {WEEKLY_TARGET_HOURS}h</small>
            </span>
          }
        >
          <div className="md-progress" role="img" aria-label={`${targetPercent}% of the weekly target`}>
            <span style={{ width: `${targetPercent}%` }} />
          </div>
          <div className="day-bars" aria-label="Hours per day">
            {hoursByDay.map((h, i) => (
              <div key={SHORT_DAYS[i]} className={`day-bar${mutabaah.week[i].date === todayKey ? ' today' : ''}`} title={`${SHORT_DAYS[i]}: ${formatHours(h)}`}>
                <span className="day-bar-value">{h ? formatHours(h) : ''}</span>
                <span className="day-bar-track">
                  <span className="day-bar-fill" style={{ height: `${(h / maxDayHours) * 100}%` }} />
                </span>
                <span className="day-bar-label">{SHORT_DAYS[i][0]}</span>
              </div>
            ))}
          </div>
          {sessions.length === 0 ? (
            <p className="log-empty">No study sessions logged {thisOrThat}.</p>
          ) : (
            sessions.map((s) => (
              <div className="log-row" key={s._id}>
                <span className="log-day">{shortDate(s.date).split(',')[0]}</span>
                <div className="log-body">
                  <div className="log-title">{subjectLabel(s.subject)}</div>
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
                <span className="log-amount">{formatHours(s.hours)}</span>
              </div>
            ))
          )}
        </Section>

        <div className="md-two">
          <Section icon={PencilLine} title="Practice questions" sub={`Logged ${thisOrThat}`} aside={<span className="md-figure">{totalQuestions}</span>}>
            {academic.questionPractice.length === 0 ? (
              <p className="log-empty">No practice questions logged {thisOrThat}.</p>
            ) : (
              academic.questionPractice.map((q) => (
                <div className="log-row" key={q._id}>
                  <div className="log-body">
                    <div className="log-title">{subjectLabel(q.subject)}</div>
                    <div className={`log-meta${q.isValidated ? ' ok' : ''}`}>{q.isValidated ? 'Validated' : 'Not validated'}</div>
                  </div>
                  <span className="log-amount">{q.questionCount} Q</span>
                </div>
              ))
            )}
          </Section>

          <Section
            icon={MessagesSquare}
            title="Lecturer consultations"
            sub={`Logged ${thisOrThat}`}
            aside={<span className="md-figure">{consultations.length}</span>}
          >
            {consultations.length === 0 ? (
              <p className="log-empty">No lecturer consultations logged {thisOrThat}.</p>
            ) : (
              consultations.map((c) => (
                <div className="log-row" key={c._id}>
                  <div className="log-body">
                    <div className="log-title">{c.lecturerName || c.subject?.lecturerName || 'Lecturer'}</div>
                    <div className="log-meta">{[c.date && shortDate(c.date), subjectLabel(c.subject), c.venue].filter(Boolean).join(' · ')}</div>
                    {c.detail && <div className="log-meta">{c.detail}</div>}
                  </div>
                </div>
              ))
            )}
          </Section>
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
                        <span className="class-meta">{[e.subject?.code, KIND_LABEL[e.kind] || e.kind].filter(Boolean).join(' · ')}</span>
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
    </div>
  );
}
