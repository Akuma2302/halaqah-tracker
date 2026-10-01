import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import { fetchChapters, fetchJuzs, lastReadPath, readLastRead, TOTAL_PAGES } from '../services/quranApi';

const VIEWS = [
  ['surah', 'Surah'],
  ['juz', 'Juzuk'],
  ['page', 'Muka surat']
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
          <p className="page-subtitle">Read by surah, juzuk or mushaf page</p>
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

      <div className="range-toggle segmented">
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

      {loading ? (
        <div className="spinner" style={{ margin: '24px auto' }} />
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
          <span className="section-label">Surah by page</span>
          <div className="quran-list">
            {chapters.map((c) => (
              <Link key={c.id} to={`/quran/page/${c.pages[0]}`} className="quran-row">
                <span className="quran-row-num">{c.id}</span>
                <span className="quran-row-body">
                  <span className="quran-row-name">{c.name_simple}</span>
                  <span className="quran-row-meta">
                    Muka surat {c.pages[0]}
                    {c.pages[1] !== c.pages[0] ? `–${c.pages[1]}` : ''}
                  </span>
                </span>
                <span className="quran-row-page">{c.pages[0]}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mathurat-source">Quran text, translation and audio from the Quran.com API (Quran Foundation).</p>
    </div>
  );
}
