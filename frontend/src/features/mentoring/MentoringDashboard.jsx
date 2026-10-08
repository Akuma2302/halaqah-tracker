import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import client from '../../services/apiClient';
import { WEEKLY_TARGET_HOURS } from '../academic/constants';
import { addDays, formatWeekLabel, getWeekStart, toDateKey } from '../academic/weekUtils';

const todayKey = toDateKey(new Date());
const currentWeekKey = toDateKey(getWeekStart());

function shiftWeek(weekKey, weeks) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), weeks * 7));
}

function tone(percent) {
  return percent >= 80 ? 'good' : percent >= 50 ? 'mid' : 'low';
}

function PersonRow({ person, rank, isThisWeek }) {
  const hoursPercent = Math.min(100, Math.round((person.studyHours / WEEKLY_TARGET_HOURS) * 100));
  const body = (
    <>
      <span className="perf-rank">{rank}</span>
      <div className="perf-body">
        <div className="perf-name">
          {person.name}
          {person.isMe && <span className="badge badge-gold">You</span>}
        </div>
        <div className="perf-bars">
          <span className="perf-bar-label">Mutabaah</span>
          <span className="perf-bar">
            <span className={`perf-bar-fill tone-${tone(person.mutabaahPercent)}`} style={{ width: `${person.mutabaahPercent}%` }} />
          </span>
          <span className="perf-bar-value">{person.mutabaahPercent}%</span>
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
          <span className="perf-chip">{person.questions} questions</span>
          <span className={`perf-chip${person.consultations ? ' ok' : ''}`}>
            {person.consultations ? `Met lecturer ×${person.consultations}` : 'No lecturer visit'}
          </span>
        </div>
      </div>
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

function Group({ title, group, emptyText, isThisWeek }) {
  const { summary, people } = group;
  return (
    <div className="card perf-group">
      <div className="log-section-title">
        {title} ({summary.count})
      </div>
      {people.length === 0 ? (
        <p className="log-empty">{emptyText}</p>
      ) : (
        <>
          <div className="week-stats perf-summary">
            <div className="week-stat">
              <span className="week-stat-value">{summary.avgMutabaahPercent}%</span>
              <span className="week-stat-label">Avg mutabaah</span>
            </div>
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
          {people.map((p, i) => (
            <PersonRow key={p._id} person={p} rank={i + 1} isThisWeek={isThisWeek} />
          ))}
        </>
      )}
    </div>
  );
}

// Overall performance for a week: mentoring mates (you included) and mentees,
// each with group averages and a list ranked by mutabaah, then study hours.
export default function MentoringDashboard() {
  const [week, setWeek] = useState(currentWeekKey);
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
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

  return (
    <>
      <div className="date-nav">
        <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, -1))} aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <span className="date-label">{isThisWeek ? `This week · ${formatWeekLabel(week)}` : formatWeekLabel(week)}</span>
        <button className="icon-btn" onClick={() => setWeek(shiftWeek(week, 1))} disabled={isThisWeek} aria-label="Next week">
          <ChevronRight size={16} />
        </button>
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Couldn't load the dashboard</h3>
          <p>Check your connection and try again.</p>
        </div>
      ) : !data || data.weekStart !== week ? (
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      ) : (
        <>
          <Group
            title="Mentoring mates"
            group={data.mates}
            isThisWeek={isThisWeek}
            emptyText={data.hasMentor ? 'Nobody else is under your mentor yet.' : 'Add a mentor on the Tree tab to see how you and your mentoring mates are doing.'}
          />
          <Group
            title="My mentees"
            group={data.mentees}
            isThisWeek={isThisWeek}
            emptyText="You don't have any mentees yet."
          />
          <p className="mentor-note">
            Mutabaah is the share of items done on the days of the week so far. Study is against the {WEEKLY_TARGET_HOURS}
            -hour weekly target. Ranked by mutabaah, then study hours.
          </p>
        </>
      )}
    </>
  );
}
