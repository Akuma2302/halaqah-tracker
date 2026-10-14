import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, BookOpen, ChevronRight, NotebookPen, Pencil, Search, X } from 'lucide-react';
import { fetchChapters, fetchJuzs, lastReadPath, readLastRead, TOTAL_PAGES } from '../services/quranApi';
import { bookmarkPath, removeBookmark, useBookmarks } from '../features/quran/bookmarks';
import { useTadabbur } from '../features/quran/tadabbur';
import TadabburSheet from '../components/TadabburSheet';
import Skeleton from '../components/Skeleton';

const VIEWS = [
  ['surah', 'Surah'],
  ['juz', 'Juzuk'],
  ['page', 'Muka surat'],
  ['tadabbur', 'Tadabbur']
];

// Loose match so "al baqarah", "baqara" and "2" all find Al-Baqarah.
function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export default function QuranIndex() {
  const [params, setParams] = useSearchParams();
  const view = VIEWS.some(([key]) => key === params.get('view')) ? params.get('view') : 'surah';
  const navigate = useNavigate();

  const [chapters, setChapters] = useState([]);
  const [juzs, setJuzs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const lastRead = useMemo(readLastRead, []);
  const bookmarks = useBookmarks();
  // Ayat saved for tadabbur, and the one whose note is open.
  const tadabbur = useTadabbur();
  const [editing, setEditing] = useState(null);
  const [tadabburQuery, setTadabburQuery] = useState('');
  // Looks in the surah name and ayat number, the translation, the note and the Arabic.
  const tadabburShown = useMemo(() => {
    const raw = tadabburQuery.trim();
    const q = normalize(raw);
    if (!raw) return tadabbur;
    return tadabbur.filter(
      (t) =>
        t.key === raw ||
        (q && [t.label, t.translation, t.note].some((text) => normalize(text || '').includes(q))) ||
        (t.arabic || '').includes(raw)
    );
  }, [tadabbur, tadabburQuery]);

  function load() {
    setLoading(true);
    setError(false);
    Promise.all([fetchChapters(), fetchJuzs()])
      .then(([c, j]) => {
        setChapters(c);
        setJuzs(j);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const chaptersById = useMemo(() => Object.fromEntries(chapters.map((c) => [c.id, c])), [chapters]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return chapters;
    return chapters.filter(
      (c) =>
        String(c.id) === q ||
        normalize(c.name_simple).includes(q) ||
        normalize(c.translated_name.name).includes(q) ||
        c.name_arabic.includes(query.trim())
    );
  }, [chapters, query]);

  // Every mushaf page with the surah it opens on; `starts` marks a page where a surah begins.
  const pageTiles = useMemo(() => {
    const ordered = [...chapters].sort((a, b) => a.pages[0] - b.pages[0] || a.id - b.id);
    return Array.from({ length: TOTAL_PAGES }, (_, i) => {
      const page = i + 1;
      const starting = ordered.filter((c) => c.pages[0] === page);
      const current = starting[0] || [...ordered].reverse().find((c) => c.pages[0] <= page);
      return { page, surah: current?.name_simple || '', starts: starting.length > 0 };
    });
  }, [chapters]);

  const pageNumber = Number(pageInput);
  const pageValid = Number.isInteger(pageNumber) && pageNumber >= 1 && pageNumber <= TOTAL_PAGES;

  function goToPage(e) {
    e.preventDefault();
    if (pageValid) navigate(`/quran/page/${pageNumber}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Al-Quran</h1>
          <p className="page-subtitle">Read by surah, juzuk or mushaf page, and keep ayat for tadabbur</p>
        </div>
      </div>

      {lastRead?.key && (
        <Link to={lastReadPath(lastRead)} className="card hours-card quran-continue">
          <span className="hours-icon">
            <BookOpen size={18} />
          </span>
          <span className="hours-body">
            <span className="hours-title">Continue reading</span>
            <span className="setup-text">{lastRead.label}</span>
          </span>
          <ChevronRight size={18} className="hours-chevron" />
        </Link>
      )}

      {bookmarks.length > 0 && (
        <div className="card quran-bookmarks">
          <div className="quran-bookmarks-title">
            <Bookmark size={15} /> Bookmarks
          </div>
          {bookmarks.map((b) => (
            <div key={b.id} className="quran-bookmark">
              <Link to={bookmarkPath(b)} className="quran-bookmark-link">
                <span>{b.label}</span>
                <ChevronRight size={16} />
              </Link>
              <button className="icon-btn" onClick={() => removeBookmark(b.id)} aria-label={`Remove bookmark ${b.label}`}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="range-toggle segmented quran-views">
        {VIEWS.map(([key, label]) => (
          <button
            key={key}
            className={view === key ? 'active' : ''}
            onClick={() => setParams(key === 'surah' ? {} : { view: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'tadabbur' ? (
        tadabbur.length === 0 ? (
          <div className="card empty-state">
            <NotebookPen size={26} />
            <h3>No ayat saved yet</h3>
            <p>While reading ayat by ayat, tap Tadabbur on an ayat to keep it here with a note of what you understand.</p>
            <Link to={lastRead?.key ? lastReadPath(lastRead) : '/quran/1'} className="btn btn-primary" style={{ marginTop: 12 }}>
              <BookOpen size={14} /> {lastRead?.key ? 'Continue reading' : 'Start reading'}
            </Link>
          </div>
        ) : (
          <>
            <label className="quran-search">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search your ayat and notes"
                value={tadabburQuery}
                onChange={(e) => setTadabburQuery(e.target.value)}
              />
            </label>
            <span className="section-label">
              {tadabburQuery.trim() ? `${tadabburShown.length} of ${tadabbur.length} ayat` : `${tadabbur.length} ayat saved`}
            </span>
            {tadabburShown.length === 0 && (
              <div className="card empty-state">
                <h3>Nothing matches that</h3>
                <p>Try a surah name, an ayat like 2:255, or a word from your note.</p>
              </div>
            )}
            <div className="tadabbur-list">
              {tadabburShown.map((t) => (
                <article key={t.key} className="card tadabbur-card">
                  <div className="tadabbur-card-head">
                    <Link to={`/quran/${t.key.split(':')[0]}#${t.key}`} className="tadabbur-ref">
                      {t.label} <ChevronRight size={13} />
                    </Link>
                    <button type="button" className="icon-btn" onClick={() => setEditing(t)} aria-label={`Change your note for ${t.label}`}>
                      <Pencil size={13} />
                    </button>
                  </div>
                  <p className="mathurat-arabic tadabbur-arabic" dir="rtl" lang="ar">
                    {t.arabic}
                  </p>
                  {t.translation && <p className="quran-translation">{t.translation}</p>}
                  {t.note ? (
                    <div className="tadabbur-note">
                      <span>My note</span>
                      {t.note}
                    </div>
                  ) : (
                    <button type="button" className="tadabbur-add-note" onClick={() => setEditing(t)}>
                      <NotebookPen size={13} /> Add a note
                    </button>
                  )}
                </article>
              ))}
            </div>
          </>
        )
      ) : loading ? (
        <Skeleton variant="cards" count={6} />
      ) : error ? (
        <div className="card empty-state">
          <h3>Couldn't load Al-Quran</h3>
          <p>Check your connection and try again.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : view === 'surah' ? (
        <>
          <label className="quran-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search surah, e.g. Yasin or 36"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {filtered.length === 0 ? (
            <div className="card empty-state">
              <h3>No surah found</h3>
              <p>Try a name like "Al-Kahf" or a number from 1 to 114.</p>
            </div>
          ) : (
            <div className="quran-list">
              {filtered.map((c) => (
                <Link key={c.id} to={`/quran/${c.id}`} className="quran-row">
                  <span className="quran-row-num">{c.id}</span>
                  <span className="quran-row-body">
                    <span className="quran-row-name">{c.name_simple}</span>
                    <span className="quran-row-meta">
                      {c.translated_name.name} · {c.verses_count} ayat ·{' '}
                      {c.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah'}
                    </span>
                  </span>
                  <span className="quran-row-arabic" lang="ar" dir="rtl">
                    {c.name_arabic}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : view === 'juz' ? (
        <div className="quran-juz-grid">
          {juzs.map((j) => (
            <Link key={j.n} to={`/quran/juz/${j.n}`} className="quran-juz">
              <span className="quran-juz-num">{j.n}</span>
              <span className="quran-juz-label">Juzuk {j.n}</span>
              <span className="quran-row-meta">
                {chaptersById[j.start.surah]?.name_simple || `Surah ${j.start.surah}`} {j.start.ayah}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <>
          <form className="card quran-page-jump" onSubmit={goToPage}>
            <label htmlFor="quran-page-input" className="field-label">
              Go to mushaf page (1–{TOTAL_PAGES})
            </label>
            <div className="quran-page-jump-row">
              <input
                id="quran-page-input"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={TOTAL_PAGES}
                placeholder="e.g. 50"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
              />
              <button className="btn btn-primary" type="submit" disabled={!pageValid}>
                Open
              </button>
            </div>
          </form>
          <span className="section-label">All {TOTAL_PAGES} pages</span>
          <div className="quran-page-grid">
            {pageTiles.map((t) => (
              <Link key={t.page} to={`/quran/page/${t.page}`} className={`quran-page-tile${t.starts ? ' starts' : ''}`} aria-label={`Page ${t.page}, ${t.surah}`}>
                <strong>{t.page}</strong>
                <span>{t.surah}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <TadabburSheet ayat={editing} saved={editing} onClose={() => setEditing(null)} />

      <p className="mathurat-source">Quran text, translation and audio from the Quran.com API (Quran Foundation).</p>
    </div>
  );
}
