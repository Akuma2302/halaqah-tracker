import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Download,
  BookOpen,
  ClipboardList,
  Users as UsersIcon,
  CheckCircle2,
  Paperclip
} from 'lucide-react';
import client from '../services/apiClient';
import ProgressRing from '../components/ProgressRing';
import { ASSESSMENT_TYPES, STUDY_CATEGORIES, WEEKLY_TARGET_HOURS } from '../features/academic/constants';
import { generateWeekOptions, formatWeekLabel, getWeekStart, toDateKey, DAY_LABELS, dateForDayInWeek } from '../features/academic/weekUtils';

const weekOptions = generateWeekOptions(16);
const currentWeekKey = toDateKey(getWeekStart());

const emptyStudyForm = { day: '0', subjectId: '', categories: [], hours: '' };
const emptyQuestionForm = { subjectId: '', questionCount: '', isValidated: false };
const emptyConsultForm = { subjectId: '', lecturerName: '', detail: '', date: '', venue: '', photoUrl: '' };

export default function AcademicJournal() {
  const [overview, setOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);

  const [week, setWeek] = useState(currentWeekKey);
  const [weekData, setWeekData] = useState(null);
  const [weekLoading, setWeekLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const [openSection, setOpenSection] = useState(null);
  const [studyForm, setStudyForm] = useState(emptyStudyForm);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [consultForm, setConsultForm] = useState(emptyConsultForm);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setOverviewLoading(true);
    Promise.all([client.get('/academic/overview'), client.get('/academic/subjects')])
      .then(([ov, subs]) => {
        setOverview(ov.data);
        setSubjects(subs.data);
      })
      .catch(() => {
        setOverview(null);
        setSubjects([]);
      })
      .finally(() => setOverviewLoading(false));
  }, []);

  function loadWeek(weekStart) {
    setWeekLoading(true);
    client
      .get(`/academic/weeks/${weekStart}`)
      .then((res) => setWeekData(res.data))
      .catch(() => setWeekData(null))
      .finally(() => setWeekLoading(false));
  }

  useEffect(() => {
    loadWeek(week);
  }, [week]);

  const visibleSubjects = subjects; // full list, for form dropdowns (including hidden ones - still valid to log against)

  function subjectLabel(s) {
    if (!s) return '';
    return s.code ? `${s.name} (${s.code})` : s.name;
  }

  function openAdd(section) {
    setOpenSection(section);
    setJustSaved(false);
    if (section === 'study') setStudyForm(emptyStudyForm);
    if (section === 'question') setQuestionForm(emptyQuestionForm);
    if (section === 'consult') setConsultForm(emptyConsultForm);
  }

  function closeAdd() {
    setOpenSection(null);
    setJustSaved(false);
  }

  async function saveStudySession() {
    if (!studyForm.hours) return;
    setSaving(true);
    try {
      const date = dateForDayInWeek(week, Number(studyForm.day));
      await client.post('/academic/weeks/study-sessions', {
        subjectId: studyForm.subjectId || null,
        date,
        categories: studyForm.categories,
        hours: Number(studyForm.hours)
      });
      loadWeek(week);
      setJustSaved(true);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestionPractice() {
    if (!questionForm.questionCount) return;
    setSaving(true);
    try {
      await client.post('/academic/weeks/question-practice', {
        subjectId: questionForm.subjectId || null,
        weekStart: week,
        questionCount: Number(questionForm.questionCount),
        isValidated: questionForm.isValidated
      });
      loadWeek(week);
      setJustSaved(true);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }

  async function handleConsultPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await client.post('/academic/weeks/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setConsultForm((f) => ({ ...f, photoUrl: res.data.url }));
    } catch {
      // best-effort
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function saveConsultation() {
    setSaving(true);
    try {
      await client.post('/academic/weeks/consultations', { ...consultForm, weekStart: week });
      loadWeek(week);
      setJustSaved(true);
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }

  async function removeEntry(kind, id) {
    const path = { study: 'study-sessions', question: 'question-practice', consult: 'consultations' }[kind];
    try {
      await client.delete(`/academic/weeks/${path}/${id}`);
      loadWeek(week);
    } catch {
      // best-effort
    }
  }

  async function toggleMentorValidation() {
    const nextValue = !weekData?.mentorValidation?.isValidated;
    setWeekData((prev) => ({ ...prev, mentorValidation: { ...prev.mentorValidation, isValidated: nextValue } }));
    try {
      await client.put(`/academic/weeks/${week}/mentor-validation`, { isValidated: nextValue });
    } catch {
      loadWeek(week);
    }
  }

  async function downloadReport(format) {
    setDownloading(true);
    try {
      const res = await client.get(`/academic/weeks/${week}/report`, {
        params: { format },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `academic-report-${week}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // best-effort
    } finally {
      setDownloading(false);
    }
  }

  const summary = overview?.weeklySummary;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Academic Journal</h1>
          <p className="page-subtitle">Track your study hours, subjects, and progress</p>
        </div>
        <Link to="/subject-list" className="btn btn-ghost">
          <ClipboardList size={15} /> Subject List
        </Link>
      </div>

      {overviewLoading ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="card ring-card">
            <ProgressRing
              percent={summary?.percent || 0}
              primaryText={`${summary?.hours ?? 0}h`}
              secondaryText={`of ${WEEKLY_TARGET_HOURS}h this week`}
            />
          </div>

          <div className="grid-2" style={{ marginTop: 20 }}>
            <div className="card">
              <span className="section-label">Subject Currently Taking</span>
              {overview?.subjects?.length ? (
                overview.subjects.map((s) => (
                  <div className="member-row" key={s._id}>
                    <BookOpen size={16} style={{ color: 'var(--ink-soft)' }} />
                    <div>
                      <div className="name">{s.name}</div>
                      <div className="kampus">{s.code || s.lecturerName || '—'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="page-subtitle">No subjects added yet. Add one from Subject List.</p>
              )}
            </div>

            <div className="card">
              <span className="section-label">Assignment / Project Overview</span>
              {overview?.assignments?.length ? (
                overview.assignments.map((a) => (
                  <div className="member-row" key={a._id}>
                    <ClipboardList size={16} style={{ color: 'var(--ink-soft)' }} />
                    <div>
                      <div className="name">{a.title}</div>
                      <div className="kampus">
                        {subjectLabel(a.subject)} · Due {a.dueDate || 'no date'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="page-subtitle">Nothing due right now.</p>
              )}
            </div>
          </div>
        </>
      )}

      <div className="page-header" style={{ marginTop: 28 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Week</label>
          <select className="input" value={week} onChange={(e) => setWeek(e.target.value)}>
            {weekOptions.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadReport('pdf')} disabled={downloading}>
            <Download size={13} /> PDF
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => downloadReport('excel')} disabled={downloading}>
            <Download size={13} /> Excel
          </button>
        </div>
      </div>

      {weekLoading ? (
        <div className="spinner" />
      ) : (
        <>
          {/* ---------- Study Hour ---------- */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-label">Study Hour</span>
              {openSection !== 'study' && (
                <button className="btn btn-ghost btn-sm" onClick={() => openAdd('study')}>
                  <Plus size={13} /> Add New
                </button>
              )}
            </div>

            {openSection === 'study' &&
              (justSaved ? (
                <AddAnotherPrompt onYes={() => openAdd('study')} onNo={closeAdd} />
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Day</label>
                      <select className="input" value={studyForm.day} onChange={(e) => setStudyForm({ ...studyForm, day: e.target.value })}>
                        {DAY_LABELS.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Subject</label>
                      <select
                        className="input"
                        value={studyForm.subjectId}
                        onChange={(e) => setStudyForm({ ...studyForm, subjectId: e.target.value })}
                      >
                        <option value="">Select subject</option>
                        {visibleSubjects.map((s) => (
                          <option key={s._id} value={s._id}>
                            {subjectLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Type</label>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {STUDY_CATEGORIES.map((c) => (
                        <label key={c.value} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={studyForm.categories.includes(c.value)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setStudyForm((f) => ({
                                ...f,
                                categories: checked ? [...f.categories, c.value] : f.categories.filter((x) => x !== c.value)
                              }));
                            }}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="field" style={{ maxWidth: 140 }}>
                    <label>Study Hour</label>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      max="24"
                      value={studyForm.hours}
                      onChange={(e) => setStudyForm({ ...studyForm, hours: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={saveStudySession} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn btn-ghost" onClick={closeAdd}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}

            {weekData?.studySessions?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {weekData.studySessions.map((s) => (
                  <div className="member-row" key={s._id}>
                    <div style={{ flex: 1 }}>
                      <div className="name">
                        {s.date} · {subjectLabel(s.subject)}
                      </div>
                      <div className="kampus">
                        {s.hours}h · {s.categories.join(', ') || '—'}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => removeEntry('study', s._id)} aria-label="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Question Practice ---------- */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-label">Do Question / Past Year / Tutorial / Exercise</span>
              {openSection !== 'question' && (
                <button className="btn btn-ghost btn-sm" onClick={() => openAdd('question')}>
                  <Plus size={13} /> Add New
                </button>
              )}
            </div>

            {openSection === 'question' &&
              (justSaved ? (
                <AddAnotherPrompt onYes={() => openAdd('question')} onNo={closeAdd} />
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Subject</label>
                      <select
                        className="input"
                        value={questionForm.subjectId}
                        onChange={(e) => setQuestionForm({ ...questionForm, subjectId: e.target.value })}
                      >
                        <option value="">Select subject</option>
                        {visibleSubjects.map((s) => (
                          <option key={s._id} value={s._id}>
                            {subjectLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>How many questions</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        value={questionForm.questionCount}
                        onChange={(e) => setQuestionForm({ ...questionForm, questionCount: e.target.value })}
                      />
                    </div>
                  </div>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={questionForm.isValidated}
                      onChange={(e) => setQuestionForm({ ...questionForm, isValidated: e.target.checked })}
                    />
                    Question validated
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={saveQuestionPractice} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn btn-ghost" onClick={closeAdd}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}

            {weekData?.questionPractice?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {weekData.questionPractice.map((q) => (
                  <div className="member-row" key={q._id}>
                    <div style={{ flex: 1 }}>
                      <div className="name">{subjectLabel(q.subject)}</div>
                      <div className="kampus">
                        {q.questionCount} questions · {q.isValidated ? 'Validated' : 'Not validated'}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={() => removeEntry('question', q._id)} aria-label="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Lecturer Consultation ---------- */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-label">Ask / Consult Lecturer</span>
              {openSection !== 'consult' && (
                <button className="btn btn-ghost btn-sm" onClick={() => openAdd('consult')}>
                  <Plus size={13} /> Add New
                </button>
              )}
            </div>

            {openSection === 'consult' &&
              (justSaved ? (
                <AddAnotherPrompt onYes={() => openAdd('consult')} onNo={closeAdd} />
              ) : (
                <div style={{ marginTop: 10 }}>
                  <div className="grid-2">
                    <div className="field">
                      <label>Subject</label>
                      <select
                        className="input"
                        value={consultForm.subjectId}
                        onChange={(e) => {
                          const subjectId = e.target.value;
                          const subj = visibleSubjects.find((s) => s._id === subjectId);
                          setConsultForm((f) => ({
                            ...f,
                            subjectId,
                            lecturerName: subj?.lecturerName || f.lecturerName
                          }));
                        }}
                      >
                        <option value="">Select subject</option>
                        {visibleSubjects.map((s) => (
                          <option key={s._id} value={s._id}>
                            {subjectLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Lecturer</label>
                      <input
                        className="input"
                        value={consultForm.lecturerName}
                        onChange={(e) => setConsultForm({ ...consultForm, lecturerName: e.target.value })}
                        placeholder="Auto-filled, editable"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Detail</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={consultForm.detail}
                      onChange={(e) => setConsultForm({ ...consultForm, detail: e.target.value })}
                      placeholder="What did you discuss?"
                    />
                  </div>
                  <div className="grid-2">
                    <div className="field">
                      <label>Date</label>
                      <input
                        className="input"
                        type="date"
                        value={consultForm.date}
                        onChange={(e) => setConsultForm({ ...consultForm, date: e.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label>Venue</label>
                      <input
                        className="input"
                        value={consultForm.venue}
                        onChange={(e) => setConsultForm({ ...consultForm, venue: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Photo</label>
                    <input type="file" accept="image/*" onChange={handleConsultPhoto} disabled={uploadingPhoto} />
                    {consultForm.photoUrl && (
                      <img src={consultForm.photoUrl} alt="Upload preview" style={{ maxWidth: 120, borderRadius: 8, marginTop: 8 }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={saveConsultation} disabled={saving || uploadingPhoto}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn btn-ghost" onClick={closeAdd}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}

            {weekData?.consultations?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                {weekData.consultations.map((c) => (
                  <div className="member-row" key={c._id}>
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt="" className="avatar" />
                    ) : (
                      <UsersIcon size={16} style={{ color: 'var(--ink-soft)' }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <div className="name">
                        {subjectLabel(c.subject)} · {c.lecturerName || '—'}
                      </div>
                      <div className="kampus">
                        {c.date || '—'} · {c.venue || '—'}
                        {c.detail ? ` · ${c.detail}` : ''}
                      </div>
                    </div>
                    {c.photoUrl && (
                      <a href={c.photoUrl} target="_blank" rel="noreferrer" className="icon-btn" aria-label="View photo">
                        <Paperclip size={14} />
                      </a>
                    )}
                    <button className="icon-btn" onClick={() => removeEntry('consult', c._id)} aria-label="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---------- Mentor Validation ---------- */}
          <div className="card" style={{ marginTop: 16, marginBottom: 30 }}>
            <span className="section-label">Validated by Mentor</span>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <input type="checkbox" checked={!!weekData?.mentorValidation?.isValidated} onChange={toggleMentorValidation} />
              <span>
                {weekData?.mentorValidation?.isValidated ? (
                  <>
                    <CheckCircle2 size={14} style={{ verticalAlign: -2, marginRight: 4, color: 'var(--primary)' }} />
                    Validated on {weekData.mentorValidation.validatedDate}
                  </>
                ) : (
                  'Not yet validated for this week'
                )}
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function AddAnotherPrompt({ onYes, onNo }) {
  return (
    <div className="empty-state" style={{ marginTop: 10 }}>
      <h3>Done Update ✓</h3>
      <p>Want to add another entry?</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={onYes}>
          Yes
        </button>
        <button className="btn btn-ghost" onClick={onNo}>
          No
        </button>
      </div>
    </div>
  );
}
