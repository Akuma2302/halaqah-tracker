import { useEffect, useMemo, useState } from 'react';
import { FileText, GraduationCap, Image as ImageIcon, Search, Trash2, Upload, X } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ALL_INSTITUTIONS, COURSES, INSTITUTIONS, PAPER_TYPES } from '../features/pastyear/institutions';
import { hueFor } from '../features/timetable/timetable';

dayjs.extend(relativeTime);

const MAX_FILE_MB = 10;
const emptyForm = { university: '', course: '', subject: '', subjectCode: '', year: '', paperType: '', file: null };

function fileSizeText(bytes) {
  if (!bytes) return '';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// The short name in brackets, if the place has one: "Universiti Putra Malaysia (UPM)" -> "UPM".
function shortName(university) {
  const match = /\(([^)]+)\)\s*$/.exec(university || '');
  return match ? match[1] : university;
}

// Past year papers shared by users for everyone: find one by subject, course
// or university, or share your own with where it is from.
export default function PastYear() {
  const { user } = useAuth();
  const [papers, setPapers] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [university, setUniversity] = useState('');
  const [course, setCourse] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, showToast] = useToast();

  // Search as you type, a moment after the last change.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setError(false);
      client
        .get('/past-papers', { params: { q: query.trim() || undefined, university: university || undefined, course: course.trim() || undefined } })
        .then((res) => !cancelled && setPapers(Array.isArray(res.data) ? res.data : []))
        .catch(() => !cancelled && setError(true));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, university, course]);

  const filtered = !!(query.trim() || university || course.trim());
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 16 }, (_, i) => thisYear - i), [thisYear]);

  function openUpload() {
    // Start from your own kampus when it matches one of the places listed.
    const mine = ALL_INSTITUTIONS.find((name) => user?.kampus && shortName(name).toLowerCase() === user.kampus.trim().toLowerCase());
    setForm({ ...emptyForm, university: mine || '' });
    setFormError('');
    setSheetOpen(true);
  }

  function pickFile(e) {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (file && file.size > MAX_FILE_MB * 1024 * 1024) return setFormError(`That file is over ${MAX_FILE_MB} MB. Choose a smaller one.`);
    setFormError('');
    setForm((f) => ({ ...f, file }));
  }

  async function submit() {
    if (!form.file) return setFormError('Choose the file to upload.');
    if (!form.university.trim() || !form.course.trim() || !form.subject.trim()) return setFormError('Fill in the university, the course and the subject.');
    setSaving(true);
    setFormError('');
    const data = new FormData();
    data.append('file', form.file);
    ['university', 'course', 'subject', 'subjectCode', 'year', 'paperType'].forEach((key) => data.append(key, String(form[key] || '').trim()));
    try {
      const res = await client.post('/past-papers', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPapers((list) => [res.data, ...(list || [])]);
      setSheetOpen(false);
      showToast('Shared. Thank you!');
    } catch (err) {
      setFormError(err.response?.data?.error || "Couldn't upload. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(paper) {
    if (!window.confirm(`Remove "${paper.subject}" from Past Year? Nobody will be able to open it any more.`)) return;
    const before = papers;
    setPapers((list) => list.filter((p) => p._id !== paper._id));
    try {
      await client.delete(`/past-papers/${paper._id}`);
      showToast('Removed');
    } catch {
      setPapers(before);
      showToast("Couldn't remove it.");
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Past Year</h1>
          <p className="page-subtitle">Past year papers shared by students</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openUpload}>
          <Upload size={14} /> Share a paper
        </button>
      </div>

      <label className="perf-search py-search">
        <Search size={15} />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a subject, code or course" aria-label="Search past year papers" />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </label>

      <div className="dl-selects py-filters">
        <label className="field">
          <span>University or college</span>
          <select className="input" value={university} onChange={(e) => setUniversity(e.target.value)}>
            <option value="">All</option>
            {INSTITUTIONS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.names.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Course</span>
          <input className="input" list="py-courses" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="All courses" />
        </label>
      </div>
      <datalist id="py-courses">
        {COURSES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="py-institutions">
        {ALL_INSTITUTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {error ? (
        <div className="card empty-state">
          <h3>Couldn't load the papers</h3>
          <p>Check your connection and try again.</p>
        </div>
      ) : !papers ? (
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      ) : (
        <>
          <div className="dl-result">
            <span>
              {papers.length} paper{papers.length === 1 ? '' : 's'}
              {papers.length === 100 ? ' (showing the newest 100)' : ''}
            </span>
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setUniversity('');
                  setCourse('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          {papers.length === 0 ? (
            <div className="card empty-state notif-empty">
              <GraduationCap size={26} />
              <h3>{filtered ? 'No paper matches that yet' : 'No papers shared yet'}</h3>
              <p>Have one? Share it so the next student can find it.</p>
              <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openUpload}>
                <Upload size={14} /> Share a paper
              </button>
            </div>
          ) : (
            <div className="py-list">
              {papers.map((p) => {
                const isImage = (p.mimeType || '').startsWith('image/');
                const Icon = isImage ? ImageIcon : FileText;
                return (
                  <div className="py-card" key={p._id} style={{ '--hue': hueFor(p.subject) }}>
                    <span className="py-icon">
                      <Icon size={18} />
                    </span>
                    <div className="py-body">
                      <div className="py-title">
                        {p.subject}
                        {p.subjectCode && <span className="subject-code">{p.subjectCode}</span>}
                      </div>
                      <div className="py-meta">{p.course}</div>
                      <div className="py-meta">{p.university}</div>
                      <div className="py-tags">
                        {p.year && <span>{p.year}</span>}
                        {p.paperType && <span>{p.paperType}</span>}
                        {p.fileSize ? <span>{fileSizeText(p.fileSize)}</span> : null}
                        <span className="plain">
                          {p.uploader?._id === user?._id ? 'Shared by you' : `Shared by ${p.uploader?.name || 'a student'}`} · {dayjs(p.createdAt).fromNow()}
                        </span>
                      </div>
                    </div>
                    <div className="py-actions">
                      <a className="btn btn-primary btn-sm" href={p.fileUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                      {p.uploader?._id === user?._id && (
                        <button type="button" className="icon-btn" onClick={() => remove(p)} aria-label={`Remove ${p.subject}`}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Sheet open={sheetOpen} onClose={() => !saving && setSheetOpen(false)} title="Share a past year paper" stickyHead>
        <div className="entry-form">
          <div className="field">
            <label>File</label>
            <label className={`py-file${form.file ? ' has' : ''}`}>
              <Upload size={18} />
              <span>
                <strong>{form.file ? form.file.name : 'Choose a PDF, Word document or photo'}</strong>
                <small>{form.file ? fileSizeText(form.file.size) : `Up to ${MAX_FILE_MB} MB`}</small>
              </span>
              <input type="file" hidden accept="application/pdf,image/*,.doc,.docx" onChange={pickFile} />
            </label>
          </div>
          <div className="field">
            <label htmlFor="py-university">University or college</label>
            <input
              id="py-university"
              className="input"
              list="py-institutions"
              value={form.university}
              onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))}
              placeholder="Type to search, e.g. UPM or Kolej Matrikulasi"
              maxLength={160}
            />
          </div>
          <div className="field">
            <label htmlFor="py-course">Course</label>
            <input
              id="py-course"
              className="input"
              list="py-courses"
              value={form.course}
              onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}
              placeholder="Type to search, e.g. Computer Science"
              maxLength={120}
            />
          </div>
          <div className="edit-grid-2 py-subject-row">
            <div className="field">
              <label htmlFor="py-subject">Subject</label>
              <input
                id="py-subject"
                className="input"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Database Systems"
                maxLength={120}
              />
            </div>
            <div className="field">
              <label htmlFor="py-code">Code (optional)</label>
              <input
                id="py-code"
                className="input"
                value={form.subjectCode}
                onChange={(e) => setForm((f) => ({ ...f, subjectCode: e.target.value }))}
                placeholder="CSC3402"
                maxLength={30}
                autoCapitalize="characters"
              />
            </div>
          </div>
          <div className="edit-grid-2">
            <div className="field">
              <label htmlFor="py-year">Year (optional)</label>
              <select id="py-year" className="input" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}>
                <option value="">Not sure</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="py-type">Paper (optional)</label>
              <select id="py-type" className="input" value={form.paperType} onChange={(e) => setForm((f) => ({ ...f, paperType: e.target.value }))}>
                <option value="">Not sure</option>
                {PAPER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="field-hint">
            Everyone using the app will be able to open this file, and your first name is shown beside it. Only share papers you are allowed to pass
            on. You can remove it at any time.
          </p>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <div className="entry-actions">
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Uploading…' : 'Share paper'}
          </button>
        </div>
      </Sheet>
      {toast}
    </div>
  );
}
