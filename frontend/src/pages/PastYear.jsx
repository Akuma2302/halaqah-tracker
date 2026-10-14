import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, FolderUp, GraduationCap, Image as ImageIcon, Library, Search, Star, Trash2, Upload, X } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import client from '../services/apiClient';
import Sheet from '../components/Sheet';
import ComboBox from '../components/ComboBox';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { ALL_INSTITUTIONS, COURSES, INSTITUTIONS, PAPER_TYPES } from '../features/pastyear/institutions';
import { hueFor } from '../features/timetable/timetable';
import { Select } from '../components/pickers';
import Skeleton from '../components/Skeleton';

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
  // Which papers to show: everyone's ('all'), my favourites, or the ones I shared ('mine').
  // ?view=favourites (from the Academic page) opens on the favourites.
  const [searchParams] = useSearchParams();
  const [scope, setScope] = useState(() => (['favourites', 'mine'].includes(searchParams.get('view')) ? searchParams.get('view') : 'all'));
  const mine = scope === 'mine';
  const favouritesOnly = scope === 'favourites';
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
        .get('/past-papers', {
          params: {
            q: query.trim() || undefined,
            university: university || undefined,
            course: course.trim() || undefined,
            mine: mine ? 1 : undefined,
            favourites: favouritesOnly ? 1 : undefined
          }
        })
        .then((res) => !cancelled && setPapers(Array.isArray(res.data) ? res.data : []))
        .catch(() => !cancelled && setError(true));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, university, course, scope]);

  const filtered = !!(query.trim() || university || course.trim());
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => Array.from({ length: 16 }, (_, i) => thisYear - i), [thisYear]);

  function openUpload() {
    // Start from your own kampus when it matches one of the places listed.
    const mine = (user?.kampus || '').trim().toLowerCase();
    const myPlace = ALL_INSTITUTIONS.find((name) => mine && (name.toLowerCase() === mine || shortName(name).toLowerCase() === mine));
    setForm({ ...emptyForm, university: myPlace || '' });
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

  // The star: changes at once, and goes back if the server says no.
  async function toggleFavourite(paper) {
    const next = !paper.isFavourite;
    const apply = (value) =>
      setPapers((list) =>
        // In the Favourites view an unstarred paper leaves the list.
        favouritesOnly && !value ? list.filter((x) => x._id !== paper._id) : list.map((x) => (x._id === paper._id ? { ...x, isFavourite: value } : x))
      );
    const before = papers;
    apply(next);
    try {
      if (next) await client.put(`/past-papers/${paper._id}/favourite`);
      else await client.delete(`/past-papers/${paper._id}/favourite`);
      showToast(next ? 'Added to favourites' : 'Removed from favourites');
    } catch {
      setPapers(before);
      showToast("Couldn't update your favourites.");
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

      <div className="range-toggle segmented py-scope">
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
          <Library size={14} /> All
        </button>
        <button className={favouritesOnly ? 'active' : ''} onClick={() => setScope('favourites')}>
          <Star size={14} /> Favourites
        </button>
        <button className={mine ? 'active' : ''} onClick={() => setScope('mine')}>
          <FolderUp size={14} /> My uploads
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
        <div className="field">
          <span>University or college</span>
          <ComboBox id="py-filter-university" groups={INSTITUTIONS} value={university} onChange={setUniversity} placeholder="All" strict />
        </div>
        <div className="field">
          <span>Course</span>
          <ComboBox id="py-filter-course" options={COURSES} value={course} onChange={setCourse} placeholder="All courses" maxLength={120} align="right" />
        </div>
      </div>

      {error ? (
        <div className="card empty-state">
          <h3>Couldn't load the papers</h3>
          <p>Check your connection and try again.</p>
        </div>
      ) : !papers ? (
        <Skeleton variant="cards" count={4} />
      ) : (
        <>
          <div className="dl-result">
            <span>
              {papers.length} paper{papers.length === 1 ? '' : 's'}
              {mine ? ' shared by you' : favouritesOnly ? ' in your favourites' : ''}
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
              <h3>
                {filtered
                  ? 'No paper matches that yet'
                  : mine
                    ? "You haven't shared a paper yet"
                    : favouritesOnly
                      ? 'No favourites yet'
                      : 'No papers shared yet'}
              </h3>
              <p>
                {mine
                  ? 'Papers you share appear here, where you can remove them.'
                  : favouritesOnly
                    ? 'Tap the star on a paper to keep it here.'
                    : 'Have one? Share it so the next student can find it.'}
              </p>
              {favouritesOnly ? (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setScope('all')}>
                  <Library size={14} /> Browse all papers
                </button>
              ) : (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={openUpload}>
                  <Upload size={14} /> Share a paper
                </button>
              )}
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
                      <button
                        type="button"
                        className={`icon-btn py-star${p.isFavourite ? ' on' : ''}`}
                        onClick={() => toggleFavourite(p)}
                        aria-pressed={!!p.isFavourite}
                        aria-label={p.isFavourite ? `Remove ${p.subject} from favourites` : `Add ${p.subject} to favourites`}
                      >
                        <Star size={15} fill={p.isFavourite ? 'currentColor' : 'none'} />
                      </button>
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
            <ComboBox
              id="py-university"
              groups={INSTITUTIONS}
              value={form.university}
              onChange={(university) => setForm((f) => ({ ...f, university }))}
              placeholder="Choose, or type one that isn't listed"
            />
          </div>
          <div className="field">
            <label htmlFor="py-course">Course</label>
            <ComboBox
              id="py-course"
              options={COURSES}
              value={form.course}
              onChange={(course) => setForm((f) => ({ ...f, course }))}
              placeholder="Choose, or type your own course"
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
              <Select id="py-year" className="input" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}>
                <option value="">Not sure</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="py-type">Paper (optional)</label>
              <Select id="py-type" className="input" value={form.paperType} onChange={(e) => setForm((f) => ({ ...f, paperType: e.target.value }))}>
                <option value="">Not sure</option>
                {PAPER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
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
