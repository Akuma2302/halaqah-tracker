import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Download,
  ClipboardList,
  Users as UsersIcon,
  CheckCircle2,
  Paperclip,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Clock,
  PenLine,
  CalendarClock,
  BookOpen,
  Camera
} from 'lucide-react';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useToast } from '../hooks/useToast';
import { STUDY_CATEGORIES, WEEKLY_TARGET_HOURS } from '../features/academic/constants';
import { formatWeekLabel, getWeekStart, toDateKey, addDays, dateForDayInWeek } from '../features/academic/weekUtils';
import { dueLabel, formatDueDate, upcomingDeadlines } from '../features/academic/deadlines';
import SubjectFiles from '../features/academic/SubjectFiles';

const MAX_WEEKS_BACK = 15; // the week picker used to offer this week + 15 previous weeks
const currentWeekKey = toDateKey(getWeekStart());
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_PRESETS = [1, 1.5, 2, 3];
const QUESTION_PRESETS = [5, 10, 20];
const CATEGORY_LABEL = Object.fromEntries(STUDY_CATEGORIES.map((c) => [c.value, c.label]));
const MAX_DEADLINES = 5;

function shiftWeek(weekKey, weeks) {
  const [y, m, d] = weekKey.split('-').map(Number);
  return toDateKey(addDays(new Date(y, m - 1, d), weeks * 7));
}

function weeksBack(weekKey) {
  const [y, m, d] = weekKey.split('-').map(Number);
  const [cy, cm, cd] = currentWeekKey.split('-').map(Number);
  return Math.round((new Date(cy, cm - 1, cd) - new Date(y, m - 1, d)) / (7 * 86400000));
}

// 0 = Sunday ... 6 = Saturday, for a "YYYY-MM-DD" date in the given week.
function dayIndexInWeek(weekKey, dateKey) {
  const [y, m, d] = weekKey.split('-').map(Number);
  const [dy, dm, dd] = dateKey.split('-').map(Number);
  return Math.round((new Date(dy, dm - 1, dd) - new Date(y, m - 1, d)) / 86400000);
}

function formatHours(h) {
  return `${Math.round(h * 10) / 10}h`;
}

function subjectLabel(s) {
  if (!s) return 'No subject';
  return s.code ? `${s.name} (${s.code})` : s.name;
}

function todayIndexFor(weekKey) {
  return weekKey === currentWeekKey ? new Date().getDay() : 1; // default to Monday for past weeks
}

const emptyQuestionForm = { subjectId: '', questionCount: '', isValidated: false };
const emptyConsultForm = { subjectId: '', lecturerName: '', detail: '', date: '', venue: '', photoUrl: '' };

export default function AcademicJournal() {
  const [overview, setOverview] = useState(null);
  const [subjects, setSubjects] = useState([]);

  const [week, setWeek] = useState(currentWeekKey);
  const [weekData, setWeekData] = useState(null);
  const [weekLoading, setWeekLoading] = useState(true);
  const [weekError, setWeekError] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Add-entry sheet: which form is open, its fields, and save state.
  const [sheet, setSheet] = useState(null); // 'study' | 'question' | 'consult' | null
  const [studyForm, setStudyForm] = useState(null);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [consultForm, setConsultForm] = useState(emptyConsultForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [toast, showToast] = useToast();

  // Subject whose files are expanded in "Subjects & files".
  const [openFilesFor, setOpenFilesFor] = useState(null);

  useEffect(() => {
    Promise.all([client.get('/academic/overview'), client.get('/academic/subjects')])
      .then(([ov, subs]) => {
        setOverview(ov.data);
        setSubjects(subs.data);
      })
      .catch(() => {
        setOverview(null);
        setSubjects([]);
      });
  }, []);

  function loadWeek(weekStart) {
    setWeekLoading(true);
    setWeekError(false);
    client
      .get(`/academic/weeks/${weekStart}`)
      .then((res) => setWeekData(res.data))
      .catch(() => {
        setWeekData(null);
        setWeekError(true);
      })
      .finally(() => setWeekLoading(false));
  }

  useEffect(() => {
    loadWeek(week);
    setExportOpen(false);
  }, [week]);

  // ---------- weekly summary (for the selected week) ----------
  const studySessions = weekData?.studySessions || [];
  const questionPractice = weekData?.questionPractice || [];
  const consultations = weekData?.consultations || [];
  const totalHours = studySessions.reduce((sum, s) => sum + (Number(s.hours) || 0), 0);
  const totalQuestions = questionPractice.reduce((sum, q) => sum + (Number(q.questionCount) || 0), 0);
  const hoursByDay = useMemo(() => {
    const days = Array(7).fill(0);
    for (const s of studySessions) {
      const i = dayIndexInWeek(week, s.date);
      if (i >= 0 && i < 7) days[i] += Number(s.hours) || 0;
    }
    return days;
  }, [studySessions, week]);
  const maxDayHours = Math.max(...hoursByDay, 1);
  const percent = Math.min(100, Math.round((totalHours / WEEKLY_TARGET_HOURS) * 100));
  const validated = !!weekData?.mentorValidation?.isValidated;
  const isCurrentWeek = week === currentWeekKey;
  const todayIndex = isCurrentWeek ? new Date().getDay() : -1;

  // Assessment due dates set in Subjects, plus any standalone assignments.
  const deadlines = useMemo(() => upcomingDeadlines(subjects, overview?.assignments || []), [subjects, overview]);

  // ---------- add-entry sheet ----------
  function openSheet(kind) {
    setFormError('');
    if (kind === 'study') setStudyForm({ day: todayIndexFor(week), subjectId: '', categories: [], hours: '' });
    if (kind === 'question') setQuestionForm(emptyQuestionForm);
    if (kind === 'consult') setConsultForm({ ...emptyConsultForm, date: isCurrentWeek ? toDateKey(new Date()) : '' });
    setSheet(kind);
  }

  function closeSheet() {
    if (!saving) setSheet(null);
  }

  async function submit(kind, addAnother) {
    setSaving(true);
    setFormError('');
    try {
      if (kind === 'study') {
        const hours = Number(studyForm.hours);
        if (!(hours >= 1 && hours <= 24)) throw new Error('Enter between 1 and 24 hours.');
        await client.post('/academic/weeks/study-sessions', {
          subjectId: studyForm.subjectId || null,
          date: dateForDayInWeek(week, studyForm.day),
          categories: studyForm.categories,
          hours
        });
      } else if (kind === 'question') {
        const count = Number(questionForm.questionCount);
        if (!Number.isInteger(count) || count < 1) throw new Error('Enter how many questions you did.');
        await client.post('/academic/weeks/question-practice', {
          subjectId: questionForm.subjectId || null,
          weekStart: week,
          questionCount: count,
          isValidated: questionForm.isValidated
        });
      } else {
        if (!consultForm.subjectId && !consultForm.lecturerName.trim()) throw new Error('Choose a subject or enter the lecturer.');
        await client.post('/academic/weeks/consultations', { ...consultForm, weekStart: week });
      }
      loadWeek(week);
      showToast('Saved');
      if (addAnother) openSheet(kind);
      else setSheet(null);
    } catch (err) {
      setFormError(err.response ? "Couldn't save. Check your connection and try again." : err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleConsultPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setFormError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await client.post('/academic/weeks/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setConsultForm((f) => ({ ...f, photoUrl: res.data.url }));
    } catch {
      setFormError("Couldn't upload the photo. Try again.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  }

  async function removeEntry(kind, id) {
    if (!window.confirm('Delete this entry?')) return;
    const path = { study: 'study-sessions', question: 'question-practice', consult: 'consultations' }[kind];
    try {
      await client.delete(`/academic/weeks/${path}/${id}`);
      loadWeek(week);
      showToast('Deleted');
    } catch {
      showToast("Couldn't delete. Try again.");
    }
  }

  async function toggleMentorValidation() {
    const nextValue = !validated;
    setWeekData((prev) => ({ ...prev, mentorValidation: { ...prev.mentorValidation, isValidated: nextValue } }));
    try {
      const res = await client.put(`/academic/weeks/${week}/mentor-validation`, { isValidated: nextValue });
      if (res.data) setWeekData((prev) => ({ ...prev, mentorValidation: res.data }));
    } catch {
      loadWeek(week);
      showToast("Couldn't update. Try again.");
    }
  }

  async function downloadReport(format) {
    setExportOpen(false);
    setDownloading(true);
    try {
      const res = await client.get(`/academic/weeks/${week}/report`, { params: { format }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `academic-report-${week}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("Couldn't download the report. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  const subjectOptions = (
    <>
      <option value="">No subject</option>
      {subjects.map((s) => (
        <option key={s._id} value={s._id}>
          {subjectLabel(s)}
        </option>
      ))}
    </>
  );

  return (
    <div className="page academic">
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Journal</h1>
          <p className="page-subtitle">Log your study week and track your progress</p>
        </div>
        <Link to="/subject-list" className="btn btn-ghost btn-sm">
          <ClipboardList size={14} /> Subjects
        </Link>
      </div>

      {/* ---------- week bar ---------- */}
      <div className="week-bar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setWeek(shiftWeek(week, -1))}
          disabled={weeksBack(week) >= MAX_WEEKS_BACK}
          aria-label="Previous week"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="week-bar-label">
          <span className="week-bar-range">{formatWeekLabel(week)}</span>
          {isCurrentWeek ? (
            <span className="badge badge-primary">This week</span>
          ) : (
            <button type="button" className="week-bar-today" onClick={() => setWeek(currentWeekKey)}>
              Back to this week
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setWeek(shiftWeek(week, 1))}
          disabled={isCurrentWeek}
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
        <div className="export-menu">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setExportOpen((v) => !v)}
            disabled={downloading}
            aria-expanded={exportOpen}
          >
            <Download size={13} /> {downloading ? 'Preparing…' : 'Export'}
          </button>
          {exportOpen && (
            <div className="export-pop" role="menu">
              <button role="menuitem" onClick={() => downloadReport('pdf')}>
                PDF report
              </button>
              <button role="menuitem" onClick={() => downloadReport('excel')}>
                Excel (.xlsx)
              </button>
            </div>
          )}
        </div>
      </div>

      {weekLoading && !weekData ? (
        <div className="spinner" style={{ margin: '24px auto' }} />
      ) : weekError ? (
        <div className="card empty-state">
          <h3>Couldn't load this week</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => loadWeek(week)}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* ---------- weekly summary ---------- */}
          <div className={`card week-summary${weekLoading ? ' loading' : ''}`}>
            <div className="week-summary-head">
              <div>
                <div className="week-summary-hours">
                  <strong>{formatHours(totalHours)}</strong> / {WEEKLY_TARGET_HOURS}h
                </div>
                <div className="setup-text">study hours {isCurrentWeek ? 'this week' : 'that week'}</div>
              </div>
              <span className={`week-summary-pct${percent >= 100 ? ' done' : ''}`}>{percent}%</span>
            </div>
            <span className="hours-bar">
              <span className="hours-bar-fill" style={{ width: `${percent}%` }} />
            </span>

            <div className="day-bars" aria-label="Hours per day">
              {hoursByDay.map((h, i) => (
                <div key={SHORT_DAYS[i]} className={`day-bar${i === todayIndex ? ' today' : ''}`} title={`${SHORT_DAYS[i]}: ${formatHours(h)}`}>
                  <span className="day-bar-value">{h ? formatHours(h) : ''}</span>
                  <span className="day-bar-track">
                    <span className="day-bar-fill" style={{ height: `${(h / maxDayHours) * 100}%` }} />
                  </span>
                  <span className="day-bar-label">{SHORT_DAYS[i][0]}</span>
                </div>
              ))}
            </div>

            <div className="week-stats">
              <div className="week-stat">
                <span className="week-stat-value">{studySessions.length}</span>
                <span className="week-stat-label">
                  <Clock size={12} /> Sessions
                </span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">{totalQuestions}</span>
                <span className="week-stat-label">
                  <PenLine size={12} /> Questions
                </span>
              </div>
              <div className="week-stat">
                <span className="week-stat-value">{consultations.length}</span>
                <span className="week-stat-label">
                  <UsersIcon size={12} /> Consults
                </span>
              </div>
              <div className={`week-stat${validated ? ' ok' : ''}`} title={validated ? 'Validated by mentor' : 'Not validated by mentor yet'}>
                <span className="week-stat-value">{validated ? <CheckCircle2 size={18} /> : '–'}</span>
                <span className="week-stat-label">Mentor</span>
              </div>
            </div>
          </div>

          {/* ---------- study hours ---------- */}
          <LogSection
            icon={Clock}
            title="Study hours"
            subtitle="Notes, questions, projects, study groups"
            onAdd={() => openSheet('study')}
            empty={!studySessions.length}
            emptyText="No study sessions logged for this week yet."
          >
            {[...studySessions]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((s) => (
                <div className="log-row" key={s._id}>
                  <span className="log-day">{SHORT_DAYS[dayIndexInWeek(week, s.date)] || s.date}</span>
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
                  <button className="icon-btn log-delete" onClick={() => removeEntry('study', s._id)} aria-label="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </LogSection>

          {/* ---------- practice questions ---------- */}
          <LogSection
            icon={PenLine}
            title="Practice questions"
            subtitle="Past year, tutorial, exercise"
            onAdd={() => openSheet('question')}
            empty={!questionPractice.length}
            emptyText="No practice questions logged for this week yet."
          >
            {questionPractice.map((q) => (
              <div className="log-row" key={q._id}>
                <div className="log-body">
                  <div className="log-title">{subjectLabel(q.subject)}</div>
                  <div className={`log-meta${q.isValidated ? ' ok' : ''}`}>{q.isValidated ? 'Validated' : 'Not validated'}</div>
                </div>
                <span className="log-amount">{q.questionCount} Q</span>
                <button className="icon-btn log-delete" onClick={() => removeEntry('question', q._id)} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </LogSection>

          {/* ---------- lecturer consultations ---------- */}
          <LogSection
            icon={UsersIcon}
            title="Lecturer consultations"
            subtitle="Questions asked, discussions"
            onAdd={() => openSheet('consult')}
            empty={!consultations.length}
            emptyText="No consultations logged for this week yet."
          >
            {consultations.map((c) => (
              <div className="log-row" key={c._id}>
                {c.photoUrl ? <img src={c.photoUrl} alt="" className="log-photo" /> : <span className="log-photo placeholder"><UsersIcon size={15} /></span>}
                <div className="log-body">
                  <div className="log-title">
                    {subjectLabel(c.subject)}
                    {c.lecturerName ? ` · ${c.lecturerName}` : ''}
                  </div>
                  <div className="log-meta">{[c.date, c.venue].filter(Boolean).join(' · ') || 'No date or venue'}</div>
                  {c.detail && <div className="log-detail">{c.detail}</div>}
                </div>
                {c.photoUrl && (
                  <a href={c.photoUrl} target="_blank" rel="noreferrer" className="icon-btn" aria-label="View photo">
                    <Paperclip size={14} />
                  </a>
                )}
                <button className="icon-btn log-delete" onClick={() => removeEntry('consult', c._id)} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </LogSection>

          {/* ---------- mentor validation ---------- */}
          <div className="card mentor-card">
            <span className={`mentor-icon${validated ? ' ok' : ''}`}>
              <CheckCircle2 size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="log-section-title">Validated by mentor</div>
              <div className="setup-text">
                {validated
                  ? `Validated${weekData?.mentorValidation?.validatedDate ? ` on ${weekData.mentorValidation.validatedDate}` : ''}`
                  : 'Turn on once your mentor has checked this week'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={validated}
              aria-label="Validated by mentor"
              className={`switch${validated ? ' on' : ''}`}
              onClick={toggleMentorValidation}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </>
      )}

      {/* ---------- assignments and subjects ---------- */}
      <div className="grid-2 academic-ref">
        <div className="card">
          <div className="log-section-head">
            <span className="log-section-icon">
              <CalendarClock size={16} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="log-section-title">Upcoming deadlines</div>
              <div className="log-section-sub">From your subjects' assessments</div>
            </div>
          </div>
          {deadlines.length ? (
            <>
              {deadlines.slice(0, MAX_DEADLINES).map((d) => {
                const due = d.dueDate ? dueLabel(d.dueDate) : null;
                return (
                  <div className="log-row" key={d.id}>
                    <div className="log-body">
                      <div className="log-title">
                        {d.title}
                        {d.weight ? <span className="log-weight"> · {d.weight}%</span> : null}
                      </div>
                      <div className="log-meta">{subjectLabel(d.subject)}</div>
                    </div>
                    <div className={`log-due${due?.overdue ? ' overdue' : due?.soon ? ' soon' : ''}`}>
                      <span>{d.dueDate ? formatDueDate(d.dueDate) : 'No date'}</span>
                      {due && <span className="log-due-rel">{due.text}</span>}
                    </div>
                  </div>
                );
              })}
              <Link to="/subject-list" className="log-more">
                {deadlines.length > MAX_DEADLINES ? `View all ${deadlines.length} in Subjects` : 'Manage in Subjects'}
              </Link>
            </>
          ) : (
            <p className="log-empty">
              No upcoming deadlines. Add due dates to your assessments in <Link to="/subject-list">Subjects</Link>.
            </p>
          )}
        </div>

        <div className="card">
          <div className="log-section-head">
            <span className="log-section-icon">
              <BookOpen size={16} />
            </span>
            <div className="log-section-title">Subjects & files</div>
          </div>
          {overview?.subjects?.length ? (
            overview.subjects.map((s) => (
              <div key={s._id}>
                <button type="button" className="subject-row" onClick={() => setOpenFilesFor((id) => (id === s._id ? null : s._id))} aria-expanded={openFilesFor === s._id}>
                  <div className="log-body">
                    <div className="log-title">{s.name}</div>
                    <div className="log-meta">{s.code || s.lecturerName || '—'}</div>
                  </div>
                  <FolderOpen size={15} className="subject-row-icon" />
                </button>

                {openFilesFor === s._id && <SubjectFiles subject={s} showToast={showToast} />}
              </div>
            ))
          ) : (
            <p className="log-empty">
              No subjects yet. <Link to="/subject-list">Add one in Subjects</Link>.
            </p>
          )}
        </div>
      </div>

      {/* ---------- add-entry sheets ---------- */}
      <Sheet
        open={!!sheet}
        onClose={closeSheet}
        title={{ study: 'Log study hours', question: 'Log practice questions', consult: 'Log a consultation' }[sheet] || ''}
      >
        {sheet === 'study' && studyForm && (
          <div className="entry-form">
            <div className="field">
              <label>Day</label>
              <div className="chip-row">
                {SHORT_DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    className={`chip${studyForm.day === i ? ' on' : ''}`}
                    onClick={() => setStudyForm((f) => ({ ...f, day: i }))}
                    disabled={isCurrentWeek && i > new Date().getDay()}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Subject</label>
              <select className="input" value={studyForm.subjectId} onChange={(e) => setStudyForm((f) => ({ ...f, subjectId: e.target.value }))}>
                {subjectOptions}
              </select>
            </div>
            <div className="field">
              <label>What did you do?</label>
              <div className="chip-row">
                {STUDY_CATEGORIES.map((c) => {
                  const on = studyForm.categories.includes(c.value);
                  return (
                    <button
                      key={c.value}
                      type="button"
                      className={`chip${on ? ' on' : ''}`}
                      aria-pressed={on}
                      onClick={() =>
                        setStudyForm((f) => ({
                          ...f,
                          categories: on ? f.categories.filter((x) => x !== c.value) : [...f.categories, c.value]
                        }))
                      }
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <label>Hours</label>
              <div className="chip-row">
                {HOUR_PRESETS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`chip${Number(studyForm.hours) === h ? ' on' : ''}`}
                    onClick={() => setStudyForm((f) => ({ ...f, hours: String(h) }))}
                  >
                    {h}h
                  </button>
                ))}
                <input
                  className="input chip-input"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  max="24"
                  step="0.5"
                  placeholder="Other"
                  value={HOUR_PRESETS.includes(Number(studyForm.hours)) ? '' : studyForm.hours}
                  onChange={(e) => setStudyForm((f) => ({ ...f, hours: e.target.value }))}
                  aria-label="Other number of hours"
                />
              </div>
            </div>
          </div>
        )}

        {sheet === 'question' && (
          <div className="entry-form">
            <div className="field">
              <label>Subject</label>
              <select className="input" value={questionForm.subjectId} onChange={(e) => setQuestionForm((f) => ({ ...f, subjectId: e.target.value }))}>
                {subjectOptions}
              </select>
            </div>
            <div className="field">
              <label>How many questions?</label>
              <div className="chip-row">
                {QUESTION_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`chip${Number(questionForm.questionCount) === n ? ' on' : ''}`}
                    onClick={() => setQuestionForm((f) => ({ ...f, questionCount: String(n) }))}
                  >
                    {n}
                  </button>
                ))}
                <input
                  className="input chip-input"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  placeholder="Other"
                  value={QUESTION_PRESETS.includes(Number(questionForm.questionCount)) ? '' : questionForm.questionCount}
                  onChange={(e) => setQuestionForm((f) => ({ ...f, questionCount: e.target.value }))}
                  aria-label="Other number of questions"
                />
              </div>
            </div>
            <label className="toggle-row">
              <span>
                <span className="log-title">Answers checked</span>
                <span className="setup-text">Validated by a lecturer, mentor or answer scheme</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={questionForm.isValidated}
                className={`switch${questionForm.isValidated ? ' on' : ''}`}
                onClick={() => setQuestionForm((f) => ({ ...f, isValidated: !f.isValidated }))}
              >
                <span className="switch-knob" />
              </button>
            </label>
          </div>
        )}

        {sheet === 'consult' && (
          <div className="entry-form">
            <div className="field">
              <label>Subject</label>
              <select
                className="input"
                value={consultForm.subjectId}
                onChange={(e) => {
                  const subjectId = e.target.value;
                  const subj = subjects.find((s) => s._id === subjectId);
                  setConsultForm((f) => ({ ...f, subjectId, lecturerName: subj?.lecturerName || f.lecturerName }));
                }}
              >
                {subjectOptions}
              </select>
            </div>
            <div className="field">
              <label>Lecturer</label>
              <input
                className="input"
                value={consultForm.lecturerName}
                onChange={(e) => setConsultForm((f) => ({ ...f, lecturerName: e.target.value }))}
                placeholder="Filled from the subject, editable"
              />
            </div>
            <div className="field">
              <label>What did you discuss?</label>
              <textarea
                className="input"
                rows={3}
                value={consultForm.detail}
                onChange={(e) => setConsultForm((f) => ({ ...f, detail: e.target.value }))}
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Date</label>
                <input
                  className="input"
                  type="date"
                  value={consultForm.date}
                  min={week}
                  max={dateForDayInWeek(week, 6)}
                  onChange={(e) => setConsultForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Venue</label>
                <input className="input" value={consultForm.venue} onChange={(e) => setConsultForm((f) => ({ ...f, venue: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Photo (optional)</label>
              <div className="photo-pick">
                {consultForm.photoUrl && <img src={consultForm.photoUrl} alt="Consultation" />}
                <label className="btn btn-ghost btn-sm">
                  <Camera size={13} /> {uploadingPhoto ? 'Uploading…' : consultForm.photoUrl ? 'Change photo' : 'Add photo'}
                  <input type="file" accept="image/*" hidden onChange={handleConsultPhoto} disabled={uploadingPhoto} />
                </label>
              </div>
            </div>
          </div>
        )}

        {sheet && (
          <>
            {formError && <p className="form-error">{formError}</p>}
            <div className="entry-actions">
              <button className="btn btn-ghost" onClick={() => submit(sheet, true)} disabled={saving || uploadingPhoto}>
                Save & add another
              </button>
              <button className="btn btn-primary" onClick={() => submit(sheet, false)} disabled={saving || uploadingPhoto}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </Sheet>

      {toast}
    </div>
  );
}

function LogSection({ icon: Icon, title, subtitle, onAdd, empty, emptyText, children }) {
  return (
    <div className="card log-section">
      <div className="log-section-head">
        <span className="log-section-icon">
          <Icon size={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="log-section-title">{title}</div>
          <div className="log-section-sub">{subtitle}</div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
          <Plus size={14} /> Add
        </button>
      </div>
      {empty ? <p className="log-empty">{emptyText}</p> : <div className="log-list">{children}</div>}
    </div>
  );
}
