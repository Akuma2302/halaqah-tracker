import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Eye, EyeOff, X, ChevronDown, ChevronLeft, Clock, MoreVertical, User, CalendarClock, Check, BookOpen, AlertTriangle } from 'lucide-react';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useToast } from '../hooks/useToast';
import { ASSESSMENT_TYPES } from '../features/academic/constants';
import { ASSESSMENT_LABEL, dueLabel, formatDueDate, isExam } from '../features/academic/deadlines';
import { CLASS_KINDS, DAYS, KINDS, KIND_LABEL, SHORT_DAYS, clock, hueFor } from '../features/timetable/timetable';

const TYPE_LABEL = ASSESSMENT_LABEL;
const CREDIT_PRESETS = [2, 3, 4];
const emptyForm = { name: '', code: '', lecturerName: '', creditHour: '', assessments: [], classes: [] };
// A stable id for each card in the editor, so it stays open or closed as others are added and removed.
let nextKey = 0;
const newKey = () => `k${(nextKey += 1)}`;

const emptyClass = { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', venue: '', kind: 'lecture' };

// Overall progress weighted by each assessment's percentage (done = 100%).
function subjectProgress(assessments) {
  const total = assessments.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
  if (!total) return null;
  const done = assessments.reduce(
    (sum, a) => sum + (Number(a.percentage) || 0) * ((a.isDone ? 100 : Number(a.progressPercentage) || 0) / 100),
    0
  );
  return Math.round((done / total) * 100);
}

function nextDue(assessments) {
  return assessments
    .filter((a) => !a.isDone && a.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

// An assessment's tasks that have been given a name.
function tasksOf(assessment) {
  return (assessment.tasks || []).filter((t) => t.title.trim());
}

function progressTone(value) {
  if (value >= 100) return 'done';
  if (value >= 60) return 'good';
  if (value >= 30) return 'mid';
  return 'low';
}

export default function SubjectList() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  // Which class-time and assessment cards are opened out in the editor.
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const toggleOpen = (key) =>
    setOpenKeys((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const [toast, showToast] = useToast();
  // Every class slot in the timetable; each subject's own are shown and edited here.
  const [timetable, setTimetable] = useState([]);
  const [timetableReady, setTimetableReady] = useState(false);

  function loadTimetable() {
    client
      .get('/timetable')
      .then((res) => setTimetable(res.data))
      .catch(() => setTimetable([]))
      .finally(() => setTimetableReady(true));
  }

  const classesOf = (subjectId) => timetable.filter((e) => e.subject?._id === subjectId);

  function load() {
    setLoading(true);
    setLoadError(false);
    client
      .get('/academic/subjects')
      .then((res) => setSubjects(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    loadTimetable();
  }, []);

  // Arriving from a deadline: open that subject's editor straight away.
  const [params, setParams] = useSearchParams();
  const editParam = params.get('edit');
  useEffect(() => {
    // The class times must be in too, or the editor would open without them.
    if (!editParam || loading || !timetableReady) return;
    const subject = subjects.find((s) => s._id === editParam);
    if (subject) openEdit(subject);
    setParams({}, { replace: true });
  }, [editParam, loading, timetableReady, subjects]);

  // Close the ⋯ menu on any outside tap.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuFor]);

  function openNew() {
    setOpenKeys(new Set());
    setForm(emptyForm);
    setEditingId(null);
    setError('');
    setSheetOpen(true);
  }

  function openEdit(subject) {
    setForm({
      name: subject.name,
      code: subject.code || '',
      lecturerName: subject.lecturerName || '',
      creditHour: subject.creditHour ? String(subject.creditHour) : '',
      assessments: subject.assessments.map((a) => ({
        _key: newKey(),
        type: a.type,
        percentage: a.percentage === null || a.percentage === undefined ? '' : String(a.percentage),
        dueDate: a.dueDate || '',
        dueTime: a.dueTime || '',
        focusTopics: a.focusTopics || '',
        note: a.note || '',
        tasks: (a.tasks || []).map((t) => ({ title: t.title || '', dueDate: t.dueDate || '', dueTime: t.dueTime || '', isDone: !!t.isDone })),
        progressPercentage: a.isDone ? 100 : Number(a.progressPercentage) || 0,
        isDone: !!a.isDone
      })),
      classes: classesOf(subject._id).map((e) => ({
        _key: newKey(),
        _id: e._id,
        title: e.title || '',
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        venue: e.venue || '',
        kind: e.kind || 'lecture'
      }))
    });
    setOpenKeys(new Set());
    setEditingId(subject._id);
    setError('');
    setSheetOpen(true);
  }

  function closeSheet() {
    if (!saving) setSheetOpen(false);
  }

  function addAssessment(type) {
    const _key = newKey();
    setOpenKeys((keys) => new Set(keys).add(_key));
    setForm((f) => ({
      ...f,
      assessments: [...f.assessments, { _key, type, percentage: '', dueDate: '', dueTime: '', focusTopics: '', note: '', tasks: [], progressPercentage: 0, isDone: false }]
    }));
  }

  function updateAssessment(i, patch) {
    setForm((f) => ({ ...f, assessments: f.assessments.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));
  }

  // The small steps towards an assessment. Once it has any, its progress
  // follows them: the share that is ticked.
  function setTasks(i, change) {
    setForm((f) => ({
      ...f,
      assessments: f.assessments.map((a, idx) => {
        if (idx !== i) return a;
        const tasks = change(a.tasks || []);
        const named = tasks.filter((t) => t.title.trim());
        const progress = named.length ? Math.round((named.filter((t) => t.isDone).length / named.length) * 100) : a.progressPercentage;
        return { ...a, tasks, progressPercentage: a.isDone ? a.progressPercentage : progress };
      })
    }));
  }

  const addTask = (i) => setTasks(i, (tasks) => [...tasks, { title: '', dueDate: '', dueTime: '', isDone: false }]);
  const updateTask = (i, j, patch) => setTasks(i, (tasks) => tasks.map((t, idx) => (idx === j ? { ...t, ...patch } : t)));
  const removeTask = (i, j) => setTasks(i, (tasks) => tasks.filter((_, idx) => idx !== j));

  function removeAssessment(i) {
    setForm((f) => ({ ...f, assessments: f.assessments.filter((_, idx) => idx !== i) }));
  }

  // Class times: a new slot starts from the last one's times, on the next day.
  function addClass() {
    const _key = newKey();
    setOpenKeys((keys) => new Set(keys).add(_key));
    setForm((f) => {
      const last = f.classes[f.classes.length - 1];
      const next = last ? { ...emptyClass, ...last, _key, _id: undefined, title: '', dayOfWeek: (last.dayOfWeek + 1) % 7 } : { ...emptyClass, _key };
      return { ...f, classes: [...f.classes, next] };
    });
  }

  function updateClass(i, patch) {
    setForm((f) => ({ ...f, classes: f.classes.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }

  function removeClass(i) {
    setForm((f) => ({ ...f, classes: f.classes.filter((_, idx) => idx !== i) }));
  }

  // Bring the timetable in line with the form: new slots are added, changed
  // ones updated, and ones taken out of the form removed.
  async function saveClasses(subjectId) {
    const kept = new Set(form.classes.map((c) => c._id).filter(Boolean));
    const removed = classesOf(subjectId).filter((e) => !kept.has(e._id));
    const body = (c) => ({
      subjectId,
      title: c.title || '',
      kind: c.kind,
      dayOfWeek: Number(c.dayOfWeek),
      startTime: c.startTime,
      endTime: c.endTime,
      venue: (c.venue || '').trim()
    });
    const results = await Promise.all([
      ...removed.map((e) => client.delete(`/timetable/${e._id}`)),
      ...form.classes.map((c) => (c._id ? client.put(`/timetable/${c._id}`, body(c)) : client.post('/timetable', body(c))))
    ]);
    // The saved id of each class time, in the form's order (new ones get theirs here).
    return results.slice(removed.length).map((res) => res.data?._id);
  }

  // `keepOpen` saves from inside a card: the sheet stays up and the cards close.
  async function save(addAnother, keepOpen = false) {
    if (!form.name.trim()) return setError('Enter the subject name.');
    const missingWeight = form.assessments.findIndex((a) => a.percentage === '');
    if (missingWeight !== -1) {
      return setError(`Enter the weight % for ${TYPE_LABEL[form.assessments[missingWeight].type] || 'each assessment'}.`);
    }
    const badClass = form.classes.findIndex((c) => !c.startTime || !c.endTime || c.endTime <= c.startTime);
    if (badClass !== -1) {
      setOpenKeys((keys) => new Set(keys).add(form.classes[badClass]._key));
      return setError(`Class time ${badClass + 1}: the end time must be after the start time.`);
    }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      lecturerName: form.lecturerName.trim(),
      creditHour: form.creditHour === '' ? 0 : Number(form.creditHour),
      assessments: form.assessments.map((a) => ({
        type: a.type,
        percentage: Math.max(0, Math.min(100, Number(a.percentage))),
        dueDate: a.dueDate || null,
        dueTime: (a.dueDate && a.dueTime) || null,
        focusTopics: isExam(a.type) ? (a.focusTopics || '').trim() : '',
        note: (a.note || '').trim(),
        tasks: (a.tasks || [])
          .filter((t) => t.title.trim())
          .map((t) => ({ title: t.title.trim(), dueDate: t.dueDate || null, dueTime: (t.dueDate && t.dueTime) || null, isDone: !!t.isDone })),
        progressPercentage: a.isDone ? 100 : Number(a.progressPercentage) || 0,
        isDone: a.isDone
      }))
    };
    try {
      let subjectId = editingId;
      if (editingId) await client.put(`/academic/subjects/${editingId}`, payload);
      else subjectId = (await client.post('/academic/subjects', payload)).data?._id;
      load();
      // The subject is saved by now; a failure below only concerns its class times.
      if (subjectId && (form.classes.length || classesOf(subjectId).length)) {
        try {
          const ids = await saveClasses(subjectId);
          // Staying in the editor: new class times now have ids, so saving again updates them.
          if (keepOpen) setForm((f) => ({ ...f, classes: f.classes.map((c, i) => ({ ...c, _id: c._id || ids[i] })) }));
        } catch {
          loadTimetable();
          setEditingId(subjectId);
          setError("The subject was saved, but its class times couldn't be. Check them and save again.");
          return;
        }
        loadTimetable();
      }
      showToast(keepOpen ? 'Saved' : editingId ? 'Subject updated' : 'Subject added');
      if (keepOpen) {
        setEditingId(subjectId);
        setOpenKeys(new Set());
      } else if (addAnother) {
        setForm(emptyForm);
        setEditingId(null);
      } else {
        setSheetOpen(false);
      }
    } catch {
      setError("Couldn't save the subject. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisible(subject) {
    setMenuFor(null);
    setSubjects((prev) => prev.map((s) => (s._id === subject._id ? { ...s, isVisible: !s.isVisible } : s)));
    try {
      await client.put(`/academic/subjects/${subject._id}`, { isVisible: !subject.isVisible });
      showToast(subject.isVisible ? 'Hidden from journal' : 'Shown in journal');
    } catch {
      load();
      showToast("Couldn't update. Try again.");
    }
  }

  async function remove(subject) {
    setMenuFor(null);
    if (!window.confirm(`Delete "${subject.name}" and its assessments? This can't be undone.`)) return;
    setSubjects((prev) => prev.filter((s) => s._id !== subject._id));
    setSheetOpen(false);
    try {
      await client.delete(`/academic/subjects/${subject._id}`);
      showToast('Subject deleted');
    } catch {
      load();
      showToast("Couldn't delete. Try again.");
    }
  }

  const totalCredits = subjects.reduce((sum, s) => sum + (Number(s.creditHour) || 0), 0);
  const formWeight = form.assessments.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
  const editingSubject = subjects.find((s) => s._id === editingId);

  return (
    <div className="page subjects">
      <Link to="/academic-journal" className="quran-back">
        <ChevronLeft size={16} /> Academic Journal
      </Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">
            {subjects.length
              ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'} · ${totalCredits} credit hour${totalCredits === 1 ? '' : 's'} this semester`
              : 'The subjects you are taking this semester'}
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={15} /> Add subject
        </button>
      </div>

      {loading && !subjects.length ? (
        <div className="spinner" style={{ margin: '24px auto' }} />
      ) : loadError ? (
        <div className="card empty-state">
          <h3>Couldn't load your subjects</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : subjects.length === 0 ? (
        <div className="card empty-state">
          <BookOpen size={26} style={{ marginBottom: 8, color: 'var(--ink-soft)' }} />
          <h3>No subjects yet</h3>
          <p>Add the subjects you're taking to track assessments and log study hours against them.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={openNew}>
            <Plus size={15} /> Add your first subject
          </button>
        </div>
      ) : (
        <div className="subject-cards">
          {subjects.map((s) => {
            const progress = subjectProgress(s.assessments);
            const upcoming = nextDue(s.assessments);
            const due = upcoming && dueLabel(upcoming.dueDate);
            const weight = s.assessments.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0);
            return (
              <div key={s._id} className={`card subject-card${s.isVisible === false ? ' hidden-subject' : ''}`} style={{ '--hue': hueFor(s.name) }}>
                <div className="subject-card-head">
                  <button type="button" className="subject-card-main" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                    <span className="subject-badge" aria-hidden="true">
                      {(s.name || '?').trim()[0]?.toUpperCase()}
                    </span>
                    <span className="subject-heading">
                      <span className="subject-name">{s.name}</span>
                      <span className="subject-meta">
                        {s.code && <span className="subject-code">{s.code}</span>}
                        {s.creditHour || 0} credit{Number(s.creditHour) === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                  <div className="subject-menu" onPointerDown={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setMenuFor(menuFor === s._id ? null : s._id)}
                      aria-label={`More actions for ${s.name}`}
                      aria-expanded={menuFor === s._id}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {menuFor === s._id && (
                      <div className="export-pop" role="menu">
                        <button role="menuitem" onClick={() => toggleVisible(s)}>
                          {s.isVisible === false ? (
                            <>
                              <Eye size={14} /> Show in journal
                            </>
                          ) : (
                            <>
                              <EyeOff size={14} /> Hide from journal
                            </>
                          )}
                        </button>
                        <button role="menuitem" className="danger" onClick={() => remove(s)}>
                          <Trash2 size={14} /> Delete subject
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {s.isVisible === false && <span className="badge badge-muted subject-hidden-badge">Hidden from journal</span>}

                <div className="subject-facts">
                  <span className="subject-fact">
                    <User size={12} /> {s.lecturerName || 'No lecturer set'}
                  </span>
                  {[...classesOf(s._id)]
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                    .map((c) => (
                      <span className="subject-fact slot" key={c._id}>
                        <strong>{SHORT_DAYS[c.dayOfWeek]}</strong> {clock(c.startTime)}
                      </span>
                    ))}
                </div>

                {s.assessments.length ? (
                  <>
                    <div className="subject-progress-block">
                      <div className="subject-progress-label">
                        <span>Overall progress</span>
                        <strong className={`tone-${progressTone(progress ?? 0)}`}>{progress ?? 0}%</strong>
                      </div>
                      <span className="hours-bar">
                        <span className={`hours-bar-fill tone-${progressTone(progress ?? 0)}`} style={{ width: `${progress ?? 0}%` }} />
                      </span>
                    </div>
                    {due ? (
                      <div className={`subject-next${due.overdue ? ' overdue' : due.soon ? ' soon' : ''}`}>
                        <span className="subject-next-icon">
                          <CalendarClock size={15} />
                        </span>
                        <span className="subject-next-text">
                          <small>Next up</small>
                          <strong>
                            {TYPE_LABEL[upcoming.type] || upcoming.type} · {formatDueDate(upcoming.dueDate)}
                            {upcoming.dueTime ? `, ${clock(upcoming.dueTime)}` : ''}
                          </strong>
                        </span>
                        <span className="subject-next-when">{due.text.replace(/^due /, '')}</span>
                      </div>
                    ) : (
                      progress === 100 && (
                        <div className="subject-next done">
                          <span className="subject-next-icon">
                            <Check size={15} />
                          </span>
                          <span className="subject-next-text">
                            <strong>All assessments done</strong>
                          </span>
                        </div>
                      )
                    )}
                    <div className="assessment-chips">
                      {s.assessments.map((a) => (
                        <span key={a._id} className={`assessment-chip${a.isDone ? ' done' : ''}`}>
                          {a.isDone && <Check size={11} />}
                          {TYPE_LABEL[a.type] || a.type} <strong>{a.percentage}%</strong>
                        </span>
                      ))}
                    </div>
                    {weight !== 100 && (
                      <div className="subject-warn">
                        <AlertTriangle size={12} /> Weights add up to {weight}%, not 100%
                      </div>
                    )}
                  </>
                ) : (
                  <button type="button" className="subject-add-assess" onClick={() => openEdit(s)}>
                    <Plus size={13} /> Add assessments
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onClose={closeSheet} title={editingId ? 'Edit subject' : 'New subject'} stickyHead>
        <div className="entry-form">
          <div className="field">
            <label>Subject name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Operating System"
              autoFocus={!editingId}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>Code</label>
              <input
                className="input"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. CSV6742"
              />
            </div>
            <div className="field">
              <label>Lecturer</label>
              <input className="input" value={form.lecturerName} onChange={(e) => setForm((f) => ({ ...f, lecturerName: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Credit hours</label>
            <div className="chip-row credit-row">
              {CREDIT_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip${Number(form.creditHour) === c ? ' on' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, creditHour: String(c) }))}
                >
                  {c}
                </button>
              ))}
              <input
                className="input chip-input"
                type="number"
                inputMode="numeric"
                min="0"
                max="20"
                placeholder="Other"
                value={CREDIT_PRESETS.includes(Number(form.creditHour)) ? '' : form.creditHour}
                onChange={(e) => setForm((f) => ({ ...f, creditHour: e.target.value }))}
                aria-label="Other credit hours"
              />
            </div>
          </div>

          <div className="field">
            <div className="assess-head">
              <label>Class times</label>
              {form.classes.length > 0 && <span className="assess-total">Shown in your Timetable</span>}
            </div>

            {form.classes.map((c, i) => {
              const open = openKeys.has(c._key);
              return (
                <div key={c._key} className={`edit-card${open ? ' open' : ''}`}>
                  <button type="button" className="edit-card-head" onClick={() => toggleOpen(c._key)} aria-expanded={open}>
                    <span className="edit-card-icon">
                      <Clock size={15} />
                    </span>
                    <span className="edit-card-text">
                      <strong>
                        {SHORT_DAYS[c.dayOfWeek]} · {c.startTime ? clock(c.startTime) : '–'} to {c.endTime ? clock(c.endTime) : '–'}
                      </strong>
                      <span>{[KIND_LABEL[c.kind] || c.kind, c.venue].filter(Boolean).join(' · ')}</span>
                    </span>
                    <ChevronDown size={16} className="edit-card-chevron" />
                  </button>
                  {open && (
                    <div className="edit-card-body">
                      <div className="edit-grid-2">
                        <label className="edit-field">
                          <span>Day</span>
                          <select className="input" value={c.dayOfWeek} onChange={(e) => updateClass(i, { dayOfWeek: Number(e.target.value) })}>
                            {DAYS.map((label, d) => (
                              <option key={label} value={d}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="edit-field">
                          <span>Type</span>
                          <select className="input" value={c.kind} onChange={(e) => updateClass(i, { kind: e.target.value })}>
                            {/* Class kinds only; a slot saved earlier as something else keeps its own. */}
                            {[...CLASS_KINDS, ...KINDS.filter(([value]) => value === c.kind && !CLASS_KINDS.some(([k]) => k === value))].map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="edit-grid-2">
                        <label className="edit-field">
                          <span>Starts</span>
                          <input className="input" type="time" value={c.startTime} onChange={(e) => updateClass(i, { startTime: e.target.value })} />
                        </label>
                        <label className="edit-field">
                          <span>Ends</span>
                          <input className="input" type="time" value={c.endTime} onChange={(e) => updateClass(i, { endTime: e.target.value })} />
                        </label>
                      </div>
                      <label className="edit-field">
                        <span>Venue</span>
                        <input className="input" value={c.venue} onChange={(e) => updateClass(i, { venue: e.target.value })} placeholder="e.g. Dewan Kuliah 3" maxLength={80} />
                      </label>
                      <div className="edit-card-actions">
                        <button type="button" className="edit-remove" onClick={() => removeClass(i)}>
                          <Trash2 size={13} /> Remove
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => save(false, true)} disabled={saving}>
                          <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button type="button" className="chip class-slot-add" onClick={addClass}>
              <Plus size={12} /> Add class time
            </button>
          </div>

          <div className="field">
            <div className="assess-head">
              <label>Assessments</label>
              {form.assessments.length > 0 && (
                <span className={`assess-total${formWeight === 100 ? ' ok' : formWeight > 100 ? ' over' : ''}`}>
                  Total weight {formWeight}% / 100%
                </span>
              )}
            </div>

            {form.assessments.map((a, i) => {
              const open = openKeys.has(a._key);
              const exam = isExam(a.type);
              const named = tasksOf(a);
              const progressLabel = exam ? 'Study progress' : 'Work progress';
              return (
                <div key={a._key} className={`edit-card${open ? ' open' : ''}${a.isDone ? ' done' : ''}`}>
                  <button type="button" className="edit-card-head" onClick={() => toggleOpen(a._key)} aria-expanded={open}>
                    <span className={`edit-card-icon${exam ? ' exam' : ''}`}>{a.isDone ? <Check size={15} strokeWidth={3} /> : <CalendarClock size={15} />}</span>
                    <span className="edit-card-text">
                      <strong>
                        {TYPE_LABEL[a.type] || a.type}
                        <span className={`md-kind${exam ? ' exam' : ''}`}>{exam ? 'Exam' : 'Due'}</span>
                        {a.percentage !== '' && <em>{a.percentage}%</em>}
                      </strong>
                      <span>
                        {[
                          a.dueDate ? `${formatDueDate(a.dueDate)}${a.dueTime ? `, ${clock(a.dueTime)}` : ''}` : 'No date yet',
                          a.isDone ? 'Done' : `${a.progressPercentage}% ${exam ? 'revised' : 'done'}`,
                          named.length ? `${named.filter((t) => t.isDone).length}/${named.length} tasks` : ''
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <ChevronDown size={16} className="edit-card-chevron" />
                  </button>

                  {open && (
                    <div className="edit-card-body">
                      <div className="edit-grid-2 edit-grid-type">
                        <label className="edit-field">
                          <span>Type</span>
                          <select className="input" value={a.type} onChange={(e) => updateAssessment(i, { type: e.target.value })}>
                            {ASSESSMENT_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="edit-field">
                          <span>Weight</span>
                          <span className="assess-weight">
                            <input
                              className="input"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="100"
                              placeholder="0"
                              value={a.percentage}
                              onChange={(e) => updateAssessment(i, { percentage: e.target.value })}
                              aria-label="Weight percentage"
                            />
                            <span>%</span>
                          </span>
                        </label>
                      </div>

                      <div className="edit-grid-2 edit-grid-when">
                        <label className="edit-field">
                          <span>{exam ? 'Exam date' : 'Due date'}</span>
                          <input className="input" type="date" value={a.dueDate} onChange={(e) => updateAssessment(i, { dueDate: e.target.value })} />
                        </label>
                        <label className="edit-field">
                          <span>Time</span>
                          <input
                            className="input"
                            type="time"
                            value={a.dueTime}
                            onChange={(e) => updateAssessment(i, { dueTime: e.target.value })}
                            disabled={!a.dueDate}
                          />
                        </label>
                      </div>
                      {exam && <p className="edit-note">Exams are shown in your Timetable on their date.</p>}

                      <div className="edit-section">
                        <div className="edit-section-head">
                          <span>
                            {progressLabel}
                            {!a.isDone && (
                              <small>
                                {named.length
                                  ? `${named.filter((t) => t.isDone).length} of ${named.length} tasks done`
                                  : exam
                                    ? 'How much you have revised'
                                    : 'How much is finished'}
                              </small>
                            )}
                          </span>
                          <label className="assess-done">
                            Done
                            <button
                              type="button"
                              role="switch"
                              aria-checked={a.isDone}
                              className={`switch${a.isDone ? ' on' : ''}`}
                              onClick={() => updateAssessment(i, { isDone: !a.isDone, progressPercentage: !a.isDone ? 100 : a.progressPercentage })}
                            >
                              <span className="switch-knob" />
                            </button>
                          </label>
                        </div>
                        {!a.isDone && (
                          <div className={`assess-progress${named.length ? ' locked' : ''}`}>
                            <input
                              disabled={named.length > 0}
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={a.progressPercentage}
                              onChange={(e) => updateAssessment(i, { progressPercentage: Number(e.target.value) })}
                              aria-label={progressLabel}
                            />
                            <span className={`assess-progress-value tone-${progressTone(Number(a.progressPercentage))}`}>{a.progressPercentage}%</span>
                          </div>
                        )}
                      </div>

                      <div className="edit-section">
                        <div className="edit-section-head">
                          <span>
                            Tasks
                            <small>The small steps to finish it. Give one a date and a time to see it in your Timetable.</small>
                          </span>
                        </div>
                        {(a.tasks || []).map((t, j) => (
                          <div className={`assess-task${t.isDone ? ' done' : ''}`} key={j}>
                            <button
                              type="button"
                              className="assess-task-check"
                              role="checkbox"
                              aria-checked={t.isDone}
                              aria-label={`${t.title || 'Task'} done`}
                              onClick={() => updateTask(i, j, { isDone: !t.isDone })}
                            >
                              {t.isDone && <Check size={12} strokeWidth={3} />}
                            </button>
                            <input
                              className="input assess-task-title"
                              value={t.title}
                              onChange={(e) => updateTask(i, j, { title: e.target.value })}
                              placeholder={exam ? 'e.g. Revise chapter 3' : 'e.g. Write the introduction'}
                              maxLength={120}
                              aria-label="Task"
                            />
                            <input
                              className="input assess-task-date"
                              type="date"
                              value={t.dueDate}
                              max={a.dueDate || undefined}
                              onChange={(e) => updateTask(i, j, { dueDate: e.target.value })}
                              aria-label="Task due date"
                            />
                            <input
                              className="input assess-task-time"
                              type="time"
                              value={t.dueTime}
                              onChange={(e) => updateTask(i, j, { dueTime: e.target.value })}
                              disabled={!t.dueDate}
                              aria-label="Task time (optional)"
                            />
                            <button type="button" className="icon-btn" onClick={() => removeTask(i, j)} aria-label="Remove task">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                        <button type="button" className="chip class-slot-add assess-task-add" onClick={() => addTask(i)}>
                          <Plus size={12} /> Add task
                        </button>
                      </div>

                      {exam && (
                        <label className="edit-field">
                          <span>Topics to focus on</span>
                          <input
                            className="input"
                            value={a.focusTopics}
                            onChange={(e) => updateAssessment(i, { focusTopics: e.target.value })}
                            placeholder="e.g. Chapter 3 graphs, dynamic programming"
                            maxLength={300}
                          />
                        </label>
                      )}
                      <label className="edit-field">
                        <span>Note</span>
                        <textarea
                          className="textarea assess-note"
                          rows={2}
                          value={a.note}
                          onChange={(e) => updateAssessment(i, { note: e.target.value })}
                          placeholder={exam ? 'e.g. Open book, bring a calculator' : 'e.g. Submit on the portal, group of 3'}
                          maxLength={300}
                        />
                      </label>
                      <div className="edit-card-actions">
                        <button type="button" className="edit-remove" onClick={() => removeAssessment(i)}>
                          <Trash2 size={13} /> Remove
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => save(false, true)} disabled={saving}>
                          <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="chip-row assess-add">
              {ASSESSMENT_TYPES.map((t) => (
                <button key={t.value} type="button" className="chip" onClick={() => addAssessment(t.value)}>
                  <Plus size={12} /> {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="entry-actions">
          {editingId ? (
            <button className="btn btn-ghost danger-text" onClick={() => remove(editingSubject)} disabled={saving}>
              <Trash2 size={14} /> Delete
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={() => save(true)} disabled={saving}>
              Save & add another
            </button>
          )}
          <button className="btn btn-primary" onClick={() => save(false)} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Sheet>

      {toast}
    </div>
  );
}
