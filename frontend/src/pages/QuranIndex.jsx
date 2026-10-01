import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Search } from 'lucide-react';
import { fetchChapters, readLastRead } from '../services/quranApi';

// Loose match so "al baqarah", "baqara" and "2" all find Al-Baqarah.
function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export default function QuranIndex() {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const lastRead = useMemo(readLastRead, []);

  function load() {
    setLoading(true);
    setError(false);
    fetchChapters()
      .then(setChapters)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Al-Quran</h1>
          <p className="page-subtitle">Read with Malay translation and audio</p>
        </div>
      </div>

      {lastRead && (
        <Link to={`/quran/${lastRead.surah}#${lastRead.ayah}`} className="card hours-card quran-continue">
          <span className="hours-icon">
            <BookOpen size={18} />
          </span>
          <span className="hours-body">
            <span className="hours-title">Continue reading</span>
            <span className="setup-text">
              {lastRead.name}, ayat {lastRead.ayah}
            </span>
          </span>
          <ChevronRight size={18} className="hours-chevron" />
        </Link>
      )}

      <label className="quran-search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Search surah, e.g. Yasin or 36"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {loading ? (
        <div className="spinner" style={{ margin: '24px auto' }} />
      ) : error ? (
        <div className="card empty-state">
          <h3>Couldn't load the surah list</h3>
          <p>Check your connection and try again.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={load}>
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
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

      <p className="mathurat-source">Quran text, translation and audio from the Quran.com API (Quran Foundation).</p>
    </div>
  );
}
