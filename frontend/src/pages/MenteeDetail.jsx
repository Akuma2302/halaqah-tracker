import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Minus, X } from 'lucide-react';
import client from '../services/apiClient';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';
import { STUDY_CATEGORIES, WEEKLY_TARGET_HOURS } from '../features/academic/constants';
import { addDays, formatWeekLabel, getWeekStart, toDateKey } from '../features/academic/weekUtils';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

function subjectLabel(s) {
  if (!s) return 'No subject';
  return s.code ? `${s.name} (${s.code})` : s.name;
}

// A mentor's view of one mentee: today's mutabaah item by item, the week's
// mutabaah, and the week's academic log (studied or not, sessions, questions,
// lecturer consultations). Read-only.
export default function MenteeDetail() {
  const { id } = useParams();
  const [week, setWeek] = useState(currentWeekKey);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    client
      .get(`/mentoring/mentees/${id}`, { params: { date: todayKey, weekStart: week } })
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(err.response?.status === 403 ? 'This user is not your mentee.' : "Couldn't load this mentee."));
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
  if (!data) {
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

  return (
    <div className="page">
      {back}
      <div className="page-header">
        <div>
          <h1 className="page-title">{user.name}</h1>
          <p className="page-subtitle">{[user.memberId, user.kampus].filter(Boolean).join(' · ') || 'Mentee'}</p>
        </div>
      </div>

      {/* ---------- today at a glance ---------- */}
      <div className="mentee-today">
        <div className={`mentee-today-tile${doneToday === MUTABAAH_FIELDS.length ? ' ok' : ''}`}>
          <span className="mentee-today-value">
            {doneToday}/{MUTABAAH_FIELDS.length}
          </span>
          <span className="mentee-today-label">Mutabaah today</span>
        </div>
        {isThisWeek ? (
          <div className={`mentee-today-tile${hoursToday > 0 ? ' ok' : ''}`}>
            <span className="mentee-today-value">{hoursToday > 0 ? formatHours(hoursToday) : 'Not yet'}</span>
            <span className="mentee-today-label">Studied today</span>
          </div>
        ) : (
          <div className={`mentee-today-tile${totalHours > 0 ? ' ok' : ''}`}>
            <span className="mentee-today-value">{formatHours(totalHours)}</span>
            <span className="mentee-today-label">Studied that week</span>
          </div>
        )}
        <div className={`mentee-today-tile${consultations.length > 0 ? ' ok' : ''}`}>
          <span className="mentee-today-value">{consultations.length > 0 ? consultations.length : 'No'}</span>
          <span className="mentee-today-label">Met lecturer {isThisWeek ? 'this week' : 'that week'}</span>
        </div>
      </div>

      {/* ---------- mutabaah today ---------- */}
      <div className="card">
        <div className="log-section-title">Mutabaah today</div>
        {MUTABAAH_FIELDS.map((f) => (
          <div key={f.key} className="member-row">
            <span className={`mentee-check${today[f.key] ? ' done' : ''}`}>{today[f.key] ? <Check size={13} strokeWidth={3} /> : <X size={12} />}</span>
            <div style={{ flex: 1 }}>
              <div className="name">{f.label}</div>
            </div>
            <span className="mentee-extra">
              {f.key === 'tilawah' && today.tilawahPages ? `${today.tilawahPages} pages` : ''}
              {f.key === 'zikir' && today.zikirCount ? `${today.zikirCount}x` : ''}
              {!today[f.key] && !(f.key === 'tilawah' && today.tilawahPages) && !(f.key === 'zikir' && today.zikirCount) ? 'Not done' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* ---------- week picker ---------- */}
      <div className="date-nav">
        <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <span className="date-label">{isThisWeek ? `This week · ${formatWeekLabel(week)}` : formatWeekLabel(week)}</span>
        <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, 1))} disabled={isThisWeek} aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ---------- mutabaah for the week ---------- */}
      <div className="card">
        <div className="log-section-title">{isThisWeek ? 'Mutabaah this week' : 'Mutabaah that week'}</div>
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
        </div>
      </div>

      {/* ---------- academic for the week ---------- */}
      <div className="card">
        <div className="log-section-title">Study hours</div>
        <p className="mentee-summary">
          {formatHours(totalHours)} of {WEEKLY_TARGET_HOURS}h target · {sessions.length} session{sessions.length === 1 ? '' : 's'}
          {validated ? ' · validated by mentor' : ''}
        </p>
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
          <p className="log-empty">No study sessions logged this week.</p>
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
      </div>

      <div className="card">
        <div className="log-section-title">Practice questions · {totalQuestions}</div>
        {academic.questionPractice.length === 0 ? (
          <p className="log-empty">No practice questions logged this week.</p>
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
      </div>

      <div className="card">
        <div className="log-section-title">Lecturer consultations · {consultations.length}</div>
        {consultations.length === 0 ? (
          <p className="log-empty">No lecturer consultations logged this week.</p>
        ) : (
          consultations.map((c) => (
            <div className="log-row" key={c._id}>
              <div className="log-body">
                <div className="log-title">{c.lecturerName || c.subject?.lecturerName || 'Lecturer'}</div>
                <div className="log-meta">
                  {[c.date && shortDate(c.date), subjectLabel(c.subject), c.venue].filter(Boolean).join(' · ')}
                </div>
                {c.detail && <div className="log-meta">{c.detail}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
