import { Link } from 'react-router-dom';
import { CalendarDays, Check, Clock, ListChecks, NotebookPen, Pencil, Percent, Target } from 'lucide-react';
import Sheet from '../../components/Sheet';
import { DAYS, SHORT_DAYS, clock } from '../timetable/timetable';
import { daysUntil, isExam } from './deadlines';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { y, m, d, weekday: new Date(y, m - 1, d).getDay() };
}

function subjectLabel(s) {
  if (!s) return 'No subject';
  return s.code ? `${s.name} (${s.code})` : s.name;
}

// "3 days", "Tomorrow", "2d late", "Done"...
function countdown(deadline) {
  if (deadline.isDone) return 'Done';
  if (!deadline.dueDate) return 'No date';
  const days = daysUntil(deadline.dueDate);
  return days < 0 ? `${-days}d late` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
}

function toneOf(deadline) {
  if (deadline.isDone || !deadline.dueDate) return 'later';
  const days = daysUntil(deadline.dueDate);
  return days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'later';
}

// One of your own deadlines: a date tile, what it is, how soon, how far along.
// Tapping it opens its detail.
export function DeadlineTile({ deadline: d, onOpen }) {
  const exam = isExam(d.type);
  const date = d.dueDate ? parts(d.dueDate) : null;
  const overdue = !d.isDone && d.dueDate && daysUntil(d.dueDate) < 0;
  return (
    <button type="button" className={`md-deadline tone-${toneOf(d)}${overdue ? ' overdue' : ''}${d.isDone ? ' done' : ''}`} onClick={() => onOpen(d)}>
      <span className="md-date" aria-hidden="true">
        <small>{date ? MONTHS[date.m - 1] : '–'}</small>
        <strong>{date ? date.d : '?'}</strong>
      </span>
      <div className="md-deadline-body">
        <div className="md-deadline-title">
          {d.title}
          {d.type && <span className={`md-kind${exam ? ' exam' : ''}`}>{exam ? 'Exam' : 'Due'}</span>}
        </div>
        <div className="md-deadline-meta">{subjectLabel(d.subject)}</div>
        <div className="md-deadline-meta">
          {[date && SHORT_DAYS[date.weekday], d.dueTime && clock(d.dueTime), d.weight ? `${d.weight}%` : ''].filter(Boolean).join(' · ') || 'No date set'}
        </div>
      </div>
      <span className="md-countdown">{countdown(d)}</span>
      {d.type && (
        <div className="dl-progress">
          <span className="dl-progress-bar">
            <span style={{ width: `${d.progress || 0}%` }} />
          </span>
          <span className="dl-progress-text">
            {d.tasks?.length ? `${d.tasks.filter((t) => t.isDone).length}/${d.tasks.length} tasks · ` : ''}
            {d.progress || 0}% {exam ? 'revised' : 'done'}
          </span>
        </div>
      )}
    </button>
  );
}

// Everything about one assessment, with the way in to change it.
export function AssessmentSheet({ deadline: d, onClose }) {
  if (!d) return <Sheet open={false} onClose={onClose} title="" />;
  const exam = isExam(d.type);
  const date = d.dueDate ? parts(d.dueDate) : null;
  return (
    <Sheet open onClose={onClose} title={d.title}>
      <div className="as-detail">
        <div className={`as-hero tone-${toneOf(d)}`}>
          <span className="md-date as-date" aria-hidden="true">
            <small>{date ? MONTHS[date.m - 1] : '–'}</small>
            <strong>{date ? date.d : '?'}</strong>
          </span>
          <div className="as-hero-text">
            <strong>{subjectLabel(d.subject)}</strong>
            <span>
              {d.type && <span className={`md-kind${exam ? ' exam' : ''}`}>{exam ? 'Exam' : 'Due'}</span>}
              {d.subject?.lecturerName || ''}
            </span>
          </div>
          <span className="md-countdown">{countdown(d)}</span>
        </div>

        <div className="as-facts">
          <div className="as-fact">
            <CalendarDays size={15} />
            <span>{exam ? 'Exam date' : 'Due date'}</span>
            <strong>{date ? `${DAYS[date.weekday]}, ${date.d} ${MONTHS[date.m - 1]} ${date.y}` : 'Not set'}</strong>
          </div>
          <div className="as-fact">
            <Clock size={15} />
            <span>Time</span>
            <strong>{d.dueTime ? clock(d.dueTime) : 'Not set'}</strong>
          </div>
          {d.type && (
            <div className="as-fact">
              <Percent size={15} />
              <span>Weight</span>
              <strong>{d.weight ? `${d.weight}% of the grade` : 'Not set'}</strong>
            </div>
          )}
        </div>

        {d.type && (
          <div className="as-block">
            <div className="as-block-title">
              {d.isDone ? <Check size={14} /> : <Target size={14} />}
              {exam ? 'Study progress' : 'Work progress'}
              <strong>{d.isDone ? 'Done' : `${d.progress || 0}%`}</strong>
            </div>
            <div className="md-progress as-progress">
              <span style={{ width: `${d.progress || 0}%` }} />
            </div>
          </div>
        )}

        {d.tasks?.length > 0 && (
          <div className="as-block">
            <div className="as-block-title">
              <ListChecks size={14} /> Tasks
              <strong>
                {d.tasks.filter((t) => t.isDone).length} of {d.tasks.length}
              </strong>
            </div>
            <ul className="as-tasks">
              {d.tasks.map((t, i) => {
                const late = !t.isDone && t.dueDate && daysUntil(t.dueDate) < 0;
                return (
                  <li key={i} className={t.isDone ? 'done' : ''}>
                    <span className="as-task-check">{t.isDone && <Check size={11} strokeWidth={3} />}</span>
                    <span className="as-task-title">{t.title}</span>
                    {t.dueDate && (
                      <span className={`as-task-due${late ? ' late' : ''}`}>
                        {parts(t.dueDate).d} {MONTHS[parts(t.dueDate).m - 1]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {exam && (
          <div className="as-block">
            <div className="as-block-title">
              <Target size={14} /> Topics to focus on
            </div>
            <p className={d.topics ? '' : 'as-empty'}>{d.topics || 'None added yet.'}</p>
          </div>
        )}

        {d.type && (
          <div className="as-block">
            <div className="as-block-title">
              <NotebookPen size={14} /> Note
            </div>
            <p className={d.note ? '' : 'as-empty'}>{d.note || 'No note.'}</p>
          </div>
        )}

        {d.subject?._id && d.type ? (
          <Link to={`/subject-list?edit=${d.subject._id}`} className="btn btn-primary as-edit">
            <Pencil size={14} /> Edit in the subject
          </Link>
        ) : (
          <Link to="/academic-journal" className="btn btn-ghost as-edit">
            Manage in Academic
          </Link>
        )}
      </div>
    </Sheet>
  );
}
