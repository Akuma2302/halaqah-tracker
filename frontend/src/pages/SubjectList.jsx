import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Eye, EyeOff, X } from 'lucide-react';
import client from '../services/apiClient';
import { ASSESSMENT_TYPES } from '../features/academic/constants';

const emptyForm = { name: '', code: '', lecturerName: '', creditHour: '', assessments: [] };

function clampPercentage(value) {
  if (value === '') return '';
  const n = Math.max(0, Math.min(100, Number(value)));
  return Number.isNaN(n) ? '' : n;
}

function progressColor(value) {
  const n = Number(value);
  if (value === '' || Number.isNaN(n)) return 'var(--border)';
  if (n >= 100) return '#1f9d55'; // green - complete
  if (n >= 60) return '#e17b1f'; // orange - 60-99%
  if (n >= 30) return '#d4a017'; // yellow - 30-59%
  return '#d64545'; // red - under 30%
}

export default function SubjectList() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  function load() {
    setLoading(true);
    client
      .get('/academic/subjects')
      .then((res) => setSubjects(res.data))
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setJustSaved(false);
    setError('');
    setFormOpen(true);
  }

  function openEdit(subject) {
    setForm({
      name: subject.name,
      code: subject.code,
      lecturerName: subject.lecturerName,
      creditHour: subject.creditHour,
      assessments: subject.assessments.map((a) => ({
        type: a.type,
        percentage: a.percentage,
        dueDate: a.dueDate || '',
        progressPercentage: a.progressPercentage ?? '',
        isDone: a.isDone || false
      }))
    });
    setEditingId(subject._id);
    setJustSaved(false);
    setError('');
    setFormOpen(true);
  }

  function addAssessmentRow() {
    setForm((f) => ({
      ...f,
      assessments: [...f.assessments, { type: 'quiz', percentage: '', dueDate: '', progressPercentage: '', isDone: false }]
    }));
  }

  function updateAssessmentRow(i, field, value) {
    setForm((f) => ({
      ...f,
      assessments: f.assessments.map((a, idx) => (idx === i ? { ...a, [field]: value } : a))
    }));
  }

  function removeAssessmentRow(i) {
    setForm((f) => ({ ...f, assessments: f.assessments.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Subject name is required.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      lecturerName: form.lecturerName.trim(),
      creditHour: form.creditHour === '' ? 0 : Number(form.creditHour),
      assessments: form.assessments
        .filter((a) => a.percentage !== '')
        .map((a) => ({
          type: a.type,
          percentage: Number(a.percentage),
          dueDate: a.dueDate || null,
          progressPercentage: a.progressPercentage === '' ? 0 : Number(a.progressPercentage),
          isDone: a.isDone
        }))
    };
    try {
      if (editingId) {
        await client.put(`/academic/subjects/${editingId}`, payload);
      } else {
        await client.post('/academic/subjects', payload);
      }
      load();
      setJustSaved(true);
    } catch {
      setError('Could not save the subject. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function addAnother() {
    setForm(emptyForm);
    setEditingId(null);
    setJustSaved(false);
  }

  function closeForm() {
    setFormOpen(false);
    setJustSaved(false);
  }

  async function toggleVisible(subject) {
    setSubjects((prev) => prev.map((s) => (s._id === subject._id ? { ...s, isVisible: !s.isVisible } : s)));
    try {
      await client.put(`/academic/subjects/${subject._id}`, { isVisible: !subject.isVisible });
    } catch {
      load();
    }
  }

  async function remove(subject) {
    if (!window.confirm(`Delete "${subject.name}"? This can't be undone.`)) return;
    setSubjects((prev) => prev.filter((s) => s._id !== subject._id));
    try {
      await client.delete(`/academic/subjects/${subject._id}`);
    } catch {
      load();
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subject List</h1>
          <p className="page-subtitle">Manage the subjects you're taking this semester</p>
        </div>
        {!formOpen && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={15} /> Add New
          </button>
        )}
      </div>

      {formOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          {justSaved ? (
            <div className="empty-state">
              <h3>Done Update ✓</h3>
              <p>Want to add another subject?</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                <button className="btn btn-primary" onClick={addAnother}>
                  Yes, add another
                </button>
                <button className="btn btn-ghost" onClick={closeForm}>
                  No, I'm done
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="section-label">{editingId ? 'Edit subject' : 'New subject'}</span>
                <button className="icon-btn" onClick={closeForm} aria-label="Close">
                  <X size={16} />
                </button>
              </div>

              <div className="field">
                <label>Subject Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label>Subject Code</label>
                  <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </div>
                <div className="field">
                  <label>Lecturer Name</label>
                  <input
                    className="input"
                    value={form.lecturerName}
                    onChange={(e) => setForm({ ...form, lecturerName: e.target.value })}
                  />
                </div>
              </div>
              <div className="field" style={{ maxWidth: 160 }}>
                <label>Credit Hour</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="20"
                  value={form.creditHour}
                  onChange={(e) => setForm({ ...form, creditHour: e.target.value })}
                />
              </div>

              <div className="field">
                <label>Assessment</label>
                {form.assessments.map((a, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 8
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <select
                        className="input"
                        style={{ flex: 1 }}
                        value={a.type}
                        onChange={(e) => updateAssessmentRow(i, 'type', e.target.value)}
                      >
                        {ASSESSMENT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        style={{ width: 80 }}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Weight %"
                        title="Weightage toward final grade"
                        value={a.percentage}
                        onChange={(e) => updateAssessmentRow(i, 'percentage', e.target.value)}
                      />
                      <button className="icon-btn" onClick={() => removeAssessmentRow(i)} aria-label="Remove assessment">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ flex: '1 1 140px' }}>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>
                          Due Date
                        </span>
                        <input
                          className="input"
                          style={{ width: '100%' }}
                          type="date"
                          value={a.dueDate}
                          onChange={(e) => updateAssessmentRow(i, 'dueDate', e.target.value)}
                        />
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>
                          Progress %
                        </span>
                        <input
                          className="input"
                          style={{
                            width: 100,
                            borderColor: progressColor(a.progressPercentage),
                            color: progressColor(a.progressPercentage),
                            fontWeight: 700
                          }}
                          type="number"
                          min="0"
                          max="100"
                          value={a.progressPercentage}
                          onChange={(e) => {
                            const clamped = clampPercentage(e.target.value);
                            updateAssessmentRow(i, 'progressPercentage', clamped);
                          }}
                        />
                      </div>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, whiteSpace: 'nowrap', paddingBottom: 9 }}>
                        <input
                          type="checkbox"
                          checked={a.isDone}
                          onChange={(e) => updateAssessmentRow(i, 'isDone', e.target.checked)}
                        />
                        Done
                      </label>
                    </div>
                  </div>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={addAssessmentRow} type="button">
                  <Plus size={13} /> Add assessment
                </button>
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>}

              <button className="btn btn-primary btn-block" onClick={save} disabled={saving} style={{ marginTop: 16 }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : subjects.length === 0 ? (
        <div className="card empty-state">
          <h3>No subjects yet</h3>
          <p>Add your first subject to start tracking your academic journal.</p>
        </div>
      ) : (
        <div className="card">
          {subjects.map((s) => (
            <div className="member-row" key={s._id}>
              <div style={{ flex: 1 }}>
                <div className="name">
                  {s.name} {s.code && <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>({s.code})</span>}
                </div>
                <div className="kampus">
                  {s.lecturerName || 'No lecturer set'} · {s.creditHour || 0} credit hour(s)
                  {s.assessments.length > 0 && ` · ${s.assessments.length} assessment(s)`}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={() => toggleVisible(s)}
                title={s.isVisible ? 'Visible on Academic Journal' : 'Hidden from Academic Journal'}
              >
                {s.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Edit">
                <Pencil size={15} />
              </button>
              <button className="icon-btn" onClick={() => remove(s)} aria-label="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
