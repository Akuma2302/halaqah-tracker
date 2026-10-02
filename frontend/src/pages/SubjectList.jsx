import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Eye, EyeOff, X, ChevronLeft, MoreVertical, User, CalendarClock, Check, BookOpen } from 'lucide-react';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useToast } from '../hooks/useToast';
import { ASSESSMENT_TYPES } from '../features/academic/constants';

const TYPE_LABEL = Object.fromEntries(ASSESSMENT_TYPES.map((t) => [t.value, t.label]));
const CREDIT_PRESETS = [2, 3, 4];
const emptyForm = { name: '', code: '', lecturerName: '', creditHour: '', assessments: [] };

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "today", "tomorrow", "in 4 days", "2 days overdue" for a YYYY-MM-DD date.
function dueLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const today = new Date();
  const days = Math.round((new Date(y, m - 1, d) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (days === 0) return { text: 'due today', overdue: false, soon: true };
  if (days === 1) return { text: 'due tomorrow', overdue: false, soon: true };
  if (days > 1) return { text: `in ${days} days`, overdue: false, soon: days <= 7 };
  return { text: `${-days} day${days === -1 ? '' : 's'} overdue`, overdue: true, soon: false };
}

function formatDate(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

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
  const [toast, showToast] = useToast();

  function load() {
    setLoading(true);
    setLoadError(false);
    client
      .get('/academic/subjects')
      .then((res) => setSubjects(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Close the ⋯ menu on any outside tap.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuFor]);

  function openNew() {
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
        type: a.type,
        percentage: a.percentage === null || a.percentage === undefined ? '' : String(a.percentage),
        dueDate: a.dueDate || '',
        progressPercentage: a.isDone ? 100 : Number(a.progressPercentage) || 0,
        isDone: !!a.isDone
      }))
    });
    setEditingId(subject._id);
    setError('');
    setSheetOpen(true);
  }

  function closeSheet() {
    if (!saving) setSheetOpen(false);
  }

  function addAssessment(type) {
    setForm((f) => ({
      ...f,
      assessments: [...f.assessments, { type, percentage: '', dueDate: '', progressPercentage: 0, isDone: false }]
    }));
  }

  function updateAssessment(i, patch) {
    setForm((f) => ({ ...f, assessments: f.assessments.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) }));
  }

  function removeAssessment(i) {
    setForm((f) => ({ ...f, assessments: f.assessments.filter((_, idx) => idx !== i) }));
  }

  async function save(addAnother) {
    if (!form.name.trim()) return setError('Enter the subject name.');
    const missingWeight = form.assessments.findIndex((a) => a.percentage === '');
    if (missingWeight !== -1) {
      return setError(`Enter the weight % for ${TYPE_LABEL[form.assessments[missingWeight].type] || 'each assessment'}.`);
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
        progressPercentage: a.isDone ? 100 : Number(a.progressPercentage) || 0,
        isDone: a.isDone
      }))
    };
    try {
      if (editingId) await client.put(`/academic/subjects/${editingId}`, payload);
      else await client.post('/academic/subjects', payload);
      load();
      showToast(editingId ? 'Subject updated' : 'Subject added');
      if (addAnother) {
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
              <div key={s._id} className={`card subject-card${s.isVisible === false ? ' hidden-subject' : ''}`}>
                <div className="subject-card-head">
                  <button type="button" className="subject-card-main" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                    {s.code && <span className="subject-code">{s.code}</span>}
                    <span className="subject-name">{s.name}</span>
                    <span className="subject-meta">
                      <User size={12} /> {s.lecturerName || 'No lecturer set'}
                      <span className="subject-dot">·</span>
                      {s.creditHour || 0} credit{Number(s.creditHour) === 1 ? '' : 's'}
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

                {s.assessments.length ? (
                  <>
                    <div className="subject-progress">
                      <span className="hours-bar">
                        <span className={`hours-bar-fill tone-${progressTone(progress ?? 0)}`} style={{ width: `${progress ?? 0}%` }} />
                      </span>
                      <span className="subject-progress-value">{progress ?? 0}%</span>
                    </div>
                    {due ? (
                      <div className={`subject-due${due.overdue ? ' overdue' : due.soon ? ' soon' : ''}`}>
                        <CalendarClock size={13} /> Next: {TYPE_LABEL[upcoming.type] || upcoming.type} · {formatDate(upcoming.dueDate)} ({due.text})
                      </div>
                    ) : (
                      progress === 100 && (
                        <div className="subject-due done">
                          <Check size={13} /> All assessments done
                        </div>
                      )
                    )}
                    <div className="assessment-chips">
                      {s.assessments.map((a) => (
                        <span key={a._id} className={`assessment-chip${a.isDone ? ' done' : ''}`}>
                          {a.isDone && <Check size={11} />}
                          {TYPE_LABEL[a.type] || a.type} {a.percentage}%
                        </span>
                      ))}
                    </div>
                    {weight !== 100 && (
                      <div className="subject-warn">Weights add up to {weight}%, not 100%.</div>
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

      <Sheet open={sheetOpen} onClose={closeSheet} title={editingId ? 'Edit subject' : 'New subject'}>
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
            <div className="chip-row">
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
              <label>Assessments</label>
              {form.assessments.length > 0 && (
                <span className={`assess-total${formWeight === 100 ? ' ok' : formWeight > 100 ? ' over' : ''}`}>
                  Total weight {formWeight}% / 100%
                </span>
              )}
            </div>

            {form.assessments.map((a, i) => (
              <div key={i} className={`assess-card${a.isDone ? ' done' : ''}`}>
                <div className="assess-row">
                  <select className="input assess-type" value={a.type} onChange={(e) => updateAssessment(i, { type: e.target.value })}>
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="assess-weight">
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      placeholder="Weight"
                      value={a.percentage}
                      onChange={(e) => updateAssessment(i, { percentage: e.target.value })}
                      aria-label="Weight percentage"
                    />
                    <span>%</span>
                  </div>
                  <button type="button" className="icon-btn" onClick={() => removeAssessment(i)} aria-label="Remove assessment">
                    <X size={14} />
                  </button>
                </div>
                <div className="assess-row">
                  <input
                    className="input assess-date"
                    type="date"
                    value={a.dueDate}
                    onChange={(e) => updateAssessment(i, { dueDate: e.target.value })}
                    aria-label="Due date"
                  />
                  <label className="assess-done">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={a.isDone}
                      className={`switch${a.isDone ? ' on' : ''}`}
                      onClick={() => updateAssessment(i, { isDone: !a.isDone, progressPercentage: !a.isDone ? 100 : a.progressPercentage })}
                    >
                      <span className="switch-knob" />
                    </button>
                    Done
                  </label>
                </div>
                {!a.isDone && (
                  <div className="assess-progress">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={a.progressPercentage}
                      onChange={(e) => updateAssessment(i, { progressPercentage: Number(e.target.value) })}
                      aria-label="Progress"
                    />
                    <span className={`assess-progress-value tone-${progressTone(Number(a.progressPercentage))}`}>
                      {a.progressPercentage}%
                    </span>
                  </div>
                )}
              </div>
            ))}

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
