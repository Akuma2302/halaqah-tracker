import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Minus, Pause, Play, Plus } from 'lucide-react';
import { fetchChapter, fetchChapterAudio, fetchVerses, saveLastRead } from '../services/quranApi';

const PREFS_KEY = 'quran_prefs';
const DEFAULT_PREFS = { translation: true, size: 28 };
const MIN_SIZE = 20;
const MAX_SIZE = 44;
const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

function readPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY)) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function arabicNumber(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

export default function QuranSurah() {
  const { surah } = useParams();
  const id = Number(surah);
  const valid = Number.isInteger(id) && id >= 1 && id <= 114;
  const { hash } = useLocation();
  const targetAyah = Number(hash.slice(1)) || null;

  const [chapter, setChapter] = useState(null);
  const [verses, setVerses] = useState([]);
  const [nextPage, setNextPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);

  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  const verseRefs = useRef({});
  const sentinelRef = useRef(null);
  const scrolledToTarget = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore: storage unavailable.
    }
  }, [prefs]);

  // Reset everything when moving to another surah.
  useEffect(() => {
    setChapter(null);
    setVerses([]);
    setNextPage(1);
    setError(false);
    setAudioUrl(null);
    setPlaying(false);
    setAudioError(false);
    scrolledToTarget.current = false;
    if (valid) fetchChapter(id).then(setChapter).catch(() => setError(true));
    window.scrollTo(0, 0);
  }, [id, valid]);

  // Guards against a slow response for the previous surah landing after a switch.
  const currentId = useRef(id);
  currentId.current = id;

  async function loadMore() {
    if (!valid || loading || !nextPage) return;
    const requestedId = id;
    setLoading(true);
    setError(false);
    try {
      const { verses: more, nextPage: next } = await fetchVerses(requestedId, nextPage);
      if (currentId.current !== requestedId) return;
      setVerses((v) => (more[0] && v.some((x) => x.n === more[0].n) ? v : [...v, ...more]));
      setNextPage(next);
    } catch {
      if (currentId.current === requestedId) setError(true);
    } finally {
      setLoading(false);
    }
  }

  // First page, and keep loading until a linked ayah (#n) is on the page.
  useEffect(() => {
    if (!valid || loading || error || !nextPage) return;
    const lastLoaded = verses.length ? verses[verses.length - 1].n : 0;
    if (verses.length === 0 || (targetAyah && lastLoaded < targetAyah)) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, verses.length, nextPage, loading, error, targetAyah]);

  useEffect(() => {
    if (!targetAyah || scrolledToTarget.current) return;
    const el = verseRefs.current[targetAyah];
    if (el) {
      scrolledToTarget.current = true;
      setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
    }
  }, [targetAyah, verses]);

  // Infinite scroll: load the next 50 ayat when the end comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextPage) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: '600px'
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPage, loading, verses.length]);

  // Remember the ayah at the top of the screen as the last-read position.
  useEffect(() => {
    if (!chapter || !verses.length) return;
    let timer;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => Number(e.target.dataset.ayah));
        if (!visible.length) return;
        clearTimeout(timer);
        timer = setTimeout(
          () => saveLastRead({ surah: id, ayah: Math.min(...visible), name: chapter.name_simple }),
          800
        );
      },
      { rootMargin: '-120px 0px -60% 0px' }
    );
    Object.values(verseRefs.current).forEach((el) => el && observer.observe(el));
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [chapter, verses, id]);

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    setAudioError(false);
    try {
      if (!audioUrl) {
        const url = await fetchChapterAudio(id);
        if (!url) throw new Error('No audio');
        setAudioUrl(url);
        audio.src = url;
      }
      await audio.play();
    } catch {
      setAudioError(true);
    }
  }

  const arabicStyle = useMemo(() => ({ fontSize: prefs.size }), [prefs.size]);

  if (!valid) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h3>Surah not found</h3>
          <Link to="/quran" className="btn btn-primary" style={{ marginTop: 12 }}>
            Back to surah list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page quran-surah">
      <Link to="/quran" className="quran-back">
        <ChevronLeft size={16} /> All surah
      </Link>

      <div className="card quran-head">
        {chapter ? (
          <>
            <div className="quran-head-arabic" lang="ar" dir="rtl">
              {chapter.name_arabic}
            </div>
            <h1 className="page-title">
              {chapter.id}. {chapter.name_simple}
            </h1>
            <p className="page-subtitle">
              {chapter.translated_name.name} · {chapter.verses_count} ayat ·{' '}
              {chapter.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah'}
            </p>
          </>
        ) : (
          <div className="spinner" style={{ margin: '12px auto' }} />
        )}

        <div className="quran-tools">
          <button type="button" className="btn btn-primary btn-sm" onClick={togglePlay}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Listen'}
          </button>
          <button
            type="button"
            className={`chip${prefs.translation ? ' on' : ''}`}
            aria-pressed={prefs.translation}
            onClick={() => setPrefs((p) => ({ ...p, translation: !p.translation }))}
          >
            Terjemahan
          </button>
          <span className="mathurat-size" aria-label="Arabic text size">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPrefs((p) => ({ ...p, size: Math.max(MIN_SIZE, p.size - 2) }))}
              disabled={prefs.size <= MIN_SIZE}
              aria-label="Smaller Arabic text"
            >
              <Minus size={14} />
            </button>
            <span className="mathurat-size-label">أ</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPrefs((p) => ({ ...p, size: Math.min(MAX_SIZE, p.size + 2) }))}
              disabled={prefs.size >= MAX_SIZE}
              aria-label="Larger Arabic text"
            >
              <Plus size={14} />
            </button>
          </span>
        </div>
        <audio
          ref={audioRef}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => audioUrl && setAudioError(true)}
        />
        {audioError && <p className="reminder-warn">Couldn't play the recitation. Check your connection.</p>}
        {playing && <p className="quran-reciter">Recitation: Mishary Rashid al-Afasy</p>}
      </div>

      {chapter?.bismillah_pre && (
        <p className="quran-bismillah" lang="ar" dir="rtl">
          {BISMILLAH}
        </p>
      )}

      <div className="quran-verses">
        {verses.map((v) => (
          <article
            key={v.n}
            id={String(v.n)}
            data-ayah={v.n}
            ref={(el) => (verseRefs.current[v.n] = el)}
            className={`quran-verse${targetAyah === v.n ? ' target' : ''}`}
          >
            <div className="quran-verse-key">{v.key}</div>
            <p className="mathurat-arabic quran-arabic" dir="rtl" lang="ar" style={arabicStyle}>
              {v.ar} <span className="ayah-mark">﴿{arabicNumber(v.n)}﴾</span>
            </p>
            {prefs.translation && <p className="quran-translation">{v.ms}</p>}
          </article>
        ))}
      </div>

      {error ? (
        <div className="card empty-state" style={{ marginTop: 12 }}>
          <h3>Couldn't load the ayat</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={loadMore}>
            Try again
          </button>
        </div>
      ) : nextPage ? (
        <div ref={sentinelRef} className="quran-more">
          <div className="spinner" />
        </div>
      ) : (
        verses.length > 0 && (
          <nav className="quran-pager">
            {id > 1 ? (
              <Link to={`/quran/${id - 1}`} className="btn btn-ghost">
                <ChevronLeft size={15} /> Previous surah
              </Link>
            ) : (
              <span />
            )}
            {id < 114 && (
              <Link to={`/quran/${id + 1}`} className="btn btn-primary">
                Next surah <ChevronRight size={15} />
              </Link>
            )}
          </nav>
        )
      )}

      <p className="mathurat-source">
        Text, Malay translation (Abdullah Muhammad Basmeih) and audio from the Quran.com API (Quran Foundation).
      </p>
    </div>
  );
}
