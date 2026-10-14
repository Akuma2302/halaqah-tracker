import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronLeft } from 'lucide-react';
import client from '../services/apiClient';
import { ASSESSMENT_TYPES } from '../features/academic/constants';
import { daysUntil, upcomingDeadlines } from '../features/academic/deadlines';
import { AssessmentSheet, DeadlineTile } from '../features/academic/DeadlineTile';
import { Select } from '../components/pickers';
import Skeleton from '../components/Skeleton';

// When it falls: the first four hide finished ones, "Done" shows only those.
const DUE_FILTERS = [
  ['all', 'All'],
  ['overdue', 'Overdue'],
  ['week', 'Next 7 days'],
  ['later', 'Later'],
  ['done', 'Done']
];

function matchesDue(d, due) {
  if (due === 'done') return d.isDone;
  if (d.isDone) return false;
  if (due === 'all') return true;
  if (!d.dueDate) return due === 'later';
  const days = daysUntil(d.dueDate);
  return due === 'overdue' ? days < 0 : due === 'week' ? days >= 0 && days <= 7 : days > 7;
}

// Every deadline from your subjects in one list, narrowed by when it falls,
// by subject and by kind of assessment. Tapping one opens its detail.
export default function Deadlines() {
  const [subjects, setSubjects] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [error, setError] = useState(false);
  const [due, setDue] = useState('all');
  const [subjectId, setSubjectId] = useState('');
  const [type, setType] = useState('');
  const [open, setOpen] = useState(null);

  function load() {
    setError(false);
    Promise.all([client.get('/academic/subjects'), client.get('/academic/overview').catch(() => ({ data: {} }))])
      .then(([subjectsRes, overviewRes]) => {
        setSubjects(subjectsRes.data);
        setAssignments(overviewRes.data?.assignments || []);
      })
      .catch(() => setError(true));
  }

  useEffect(load, []);

  const all = useMemo(() => upcomingDeadlines(subjects || [], assignments, { includeDone: true }), [subjects, assignments]);
  const bySubjectAndType = useMemo(
    () => all.filter((d) => (!subjectId || d.subject?._id === subjectId) && (!type || d.type === type)),
    [all, subjectId, type]
  );
  const shown = bySubjectAndType.filter((d) => matchesDue(d, due));
  const countFor = (key) => bySubjectAndType.filter((d) => matchesDue(d, key)).length;
  const filtered = due !== 'all' || subjectId || type;

  return (
    <div className="page">
      <Link to="/academic-journal" className="quran-back">
        <ChevronLeft size={16} /> Academic Journal
      </Link>
      <div className="page-header">
        <div>
          <h1 className="page-title">Deadlines</h1>
          <p className="page-subtitle">Every exam and due date from your subjects</p>
        </div>
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Couldn't load your deadlines</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : !subjects ? (
        <Skeleton variant="cards" count={4} />
      ) : (
        <>
          <div className="notif-filters" role="tablist" aria-label="When it is due">
            {DUE_FILTERS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={due === key} className={`notif-filter${due === key ? ' active' : ''}`} onClick={() => setDue(key)}>
                {label}
                <span className={`dl-count${key === 'overdue' && countFor(key) ? ' warn' : ''}`}>{countFor(key)}</span>
              </button>
            ))}
          </div>

          <div className="dl-selects">
            <label className="field">
              <span>Subject</span>
              <Select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">All subjects</option>
                {subjects
                  .filter((s) => s.isVisible !== false)
                  .map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.code ? `${s.code} · ${s.name}` : s.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span>Assessment type</span>
              <Select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All types</option>
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="dl-result">
            <span>
              {shown.length} deadline{shown.length === 1 ? '' : 's'}
            </span>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setDue('all');
                  setSubjectId('');
                  setType('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="card empty-state notif-empty">
              <CalendarClock size={24} />
              <h3>{all.length === 0 ? 'No deadlines yet' : 'Nothing matches these filters'}</h3>
              {all.length === 0 && (
                <p>
                  Add dates to your assessments in <Link to="/subject-list">Subjects</Link>.
                </p>
              )}
            </div>
          ) : (
            <div className="md-deadlines dl-own">
              {shown.map((d) => (
                <DeadlineTile key={d.id} deadline={d} onOpen={setOpen} />
              ))}
            </div>
          )}
        </>
      )}

      <AssessmentSheet deadline={open} onClose={() => setOpen(null)} />
    </div>
  );
}
