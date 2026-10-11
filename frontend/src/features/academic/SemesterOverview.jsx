import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, ChevronRight, ClipboardCheck, LayoutDashboard, TrendingUp } from 'lucide-react';
import { ASSESSMENT_TYPES } from './constants';
import { daysUntil, isExam } from './deadlines';
import { CLASS_KINDS, KIND_LABEL, minutes } from '../timetable/timetable';

const CLASS_KIND_KEYS = CLASS_KINDS.map(([value]) => value);

// "Class" -> "Classes", "Quiz" -> "Quizzes", "Lab" -> "Labs"; unchanged for one.
function plural(word, count) {
  if (count === 1) return word;
  if (/z$/i.test(word)) return `${word}zes`;
  return /s$/i.test(word) ? `${word}es` : `${word}s`;
}

function hoursText(mins) {
  const h = Math.round((mins / 60) * 10) / 10;
  return `${h}h`;
}

// The semester at a glance, from the subjects and the weekly timetable: how
// many subjects, classes and assessments there are, how many of each kind of
// assessment, and how much of it is done. Hidden subjects are left out.
// `embedded` drops the card and its header, to sit inside the week's summary card.
export default function SemesterOverview({ subjects, timetable, embedded = false }) {
  const visible = subjects.filter((s) => s.isVisible !== false);
  const assessments = visible.flatMap((s) => s.assessments || []);
  const classes = timetable.filter((e) => CLASS_KIND_KEYS.includes(e.kind) && e.subject?.isVisible !== false && !e.shared);
  if (!visible.length && !classes.length) return null;

  const credits = visible.reduce((sum, s) => sum + (Number(s.creditHour) || 0), 0);
  const classMinutes = classes.reduce((sum, e) => sum + Math.max(0, minutes(e.endTime) - minutes(e.startTime)), 0);
  const done = assessments.filter((a) => a.isDone).length;
  const overdue = assessments.filter((a) => !a.isDone && a.dueDate && daysUntil(a.dueDate) < 0).length;

  // Progress across everything, weighted by each assessment's share of its subject's grade.
  const weight = assessments.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
  const progress = weight
    ? Math.round(assessments.reduce((sum, a) => sum + (Number(a.percentage) || 0) * (a.isDone ? 100 : Number(a.progressPercentage) || 0), 0) / weight)
    : 0;

  const byType = ASSESSMENT_TYPES.map((t) => {
    const list = assessments.filter((a) => a.type === t.value);
    return { ...t, total: list.length, done: list.filter((a) => a.isDone).length };
  }).filter((t) => t.total > 0);
  const maxOfType = Math.max(1, ...byType.map((t) => t.total));

  const byKind = CLASS_KINDS.map(([value]) => ({ value, total: classes.filter((e) => e.kind === value).length })).filter((k) => k.total > 0);

  return (
    <div className={embedded ? 'sem-overview sem-embedded' : 'card sem-overview'}>
      {embedded ? (
        <div className="sem-embedded-title">
          <LayoutDashboard size={14} /> This semester
          <span>Everything in your subjects</span>
        </div>
      ) : (
        <div className="log-section-head">
          <span className="log-section-icon">
            <LayoutDashboard size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="log-section-title">Semester dashboard</div>
            <div className="log-section-sub">Everything in your subjects, in numbers</div>
          </div>
        </div>
      )}

      {/* The same tiles as the week's log: the ones that open a page carry an arrow */}
      <div className="aj-actions sem-tiles">
        <Link to="/subject-list" className="aj-action">
          <span className="aj-action-icon">
            <BookOpen size={16} />
          </span>
          <span className="aj-action-text">
            <strong>{visible.length}</strong>
            <span>Subject{visible.length === 1 ? '' : 's'}</span>
            <small>{credits} credit hours</small>
          </span>
          <ChevronRight size={15} className="aj-action-go" />
        </Link>
        <Link to="/timetable" className="aj-action">
          <span className="aj-action-icon">
            <CalendarDays size={16} />
          </span>
          <span className="aj-action-text">
            <strong>{classes.length}</strong>
            <span>Class{classes.length === 1 ? '' : 'es'} a week</span>
            <small>{hoursText(classMinutes)} in class</small>
          </span>
          <ChevronRight size={15} className="aj-action-go" />
        </Link>
        <Link to="/deadlines" className="aj-action">
          <span className="aj-action-icon">
            <ClipboardCheck size={16} />
          </span>
          <span className="aj-action-text">
            <strong>
              {done}
              <em>/{assessments.length}</em>
            </strong>
            <span>Assessments done</span>
            <small className={overdue ? 'warn' : ''}>{overdue ? `${overdue} overdue` : `${assessments.length - done} to go`}</small>
          </span>
          <ChevronRight size={15} className="aj-action-go" />
        </Link>
        <div className="aj-action sem-static">
          <span className="aj-action-icon">
            <TrendingUp size={16} />
          </span>
          <span className="aj-action-text">
            <strong>{progress}%</strong>
            <span>Overall progress</span>
            <small>Weighted by grade</small>
          </span>
        </div>
      </div>

      {byType.length > 0 && (
        <>
          <div className="sem-heading">Assessments by type</div>
          <div className="sem-types">
            {byType.map((t) => (
              <div className="sem-type" key={t.value}>
                <span className="sem-type-name">
                  <i className={isExam(t.value) ? 'exam' : ''} />
                  {plural(t.label, t.total)}
                </span>
                <span className="sem-type-bar" title={`${t.done} of ${t.total} done`}>
                  <span className="sem-type-total" style={{ width: `${(t.total / maxOfType) * 100}%` }}>
                    <span style={{ width: `${(t.done / t.total) * 100}%` }} />
                  </span>
                </span>
                <span className="sem-type-count">
                  <strong>{t.total}</strong>
                  <small>{t.done} done</small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {byKind.length > 0 && (
        <>
          <div className="sem-heading">Classes each week</div>
          <div className="sem-kinds">
            {byKind.map((k) => (
              <span className="sem-kind" key={k.value}>
                <strong>{k.total}</strong> {plural(KIND_LABEL[k.value], k.total)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
