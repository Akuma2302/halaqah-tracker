import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { fetchChapter, fetchChapterAudio, fetchChapters, keyFromHash, saveLastRead } from '../services/quranApi';
import { useQuranVerses } from '../hooks/useQuranVerses';
import QuranVerses, { BISMILLAH } from '../components/QuranVerses';
import MushafPages from '../components/MushafPages';
import AyatSearch from '../components/AyatSearch';
import { QuranDisplayControls, QuranModeSwitch, useQuranPrefs, useReaderMode } from '../components/QuranControls';
import { useStartPage } from '../hooks/useStartPage';

function QuranSurahReader() {
  const { surah } = useParams();
  const id = Number(surah);
  const valid = Number.isInteger(id) && id >= 1 && id <= 114;
  const { hash } = useLocation();
  const targetKey = valid ? keyFromHash(hash, id) : null;

  const [chapter, setChapter] = useState(null);
  // All surah names, for headings of neighbouring surahs sharing a mushaf page.
  const [chapters, setChapters] = useState([]);
  const chaptersById = useMemo(() => Object.fromEntries(chapters.map((c) => [c.id, c])), [chapters]);
  const [prefs, setPrefs] = useQuranPrefs();
  const { reading, switchMode } = useReaderMode();
  const start = useStartPage(targetKey, reading);
  const { verses, error, hasMore, loadMore, sentinelRef } = useQuranVerses('chapter', valid && !reading ? id : null, {
    untilKey: targetKey
  });

  const ayatRanges = useMemo(() => (chapter ? [{ surah: id, from: 1, to: chapter.verses_count }] : []), [chapter, id]);

  const [audioUrl, setAudioUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    setChapter(null);
    setAudioUrl(null);
    setPlaying(false);
    setAudioError(false);
    if (valid) fetchChapter(id).then(setChapter).catch(() => {});
    fetchChapters().then(setChapters).catch(() => {});
    if (!hash) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, valid]);

  // Mushaf view: the page on screen is the reading position (first ayah of
  // this surah on that page).
  const onPageInView = useCallback(
    (page, pageVerses) => {
      const first = pageVerses.find((v) => v.surah === id);
      if (!chapter || !first) return;
      saveLastRead({
        kind: 'chapter',
        number: id,
        key: first.key,
        label: `${chapter.name_simple}, ayat ${first.n} (muka surat ${page})`
      });
    },
    [chapter, id]
  );

  const onTopVerse = useCallback(
    (v) => {
      if (chapter) saveLastRead({ kind: 'chapter', number: id, key: v.key, label: `${chapter.name_simple}, ayat ${v.n}` });
    },
    [chapter, id]
  );

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

  const surahPager = (
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
  );

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
        <ChevronLeft size={16} /> Al-Quran
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
              {chapter.revelation_place === 'makkah' ? 'Makkiyah' : 'Madaniyah'} · Muka surat {chapter.pages[0]}
              {chapter.pages[1] !== chapter.pages[0] ? `–${chapter.pages[1]}` : ''}
            </p>
          </>
        ) : (
          <div className="spinner" style={{ margin: '12px auto' }} />
        )}

        <QuranModeSwitch reading={reading} onChange={switchMode} />
        <AyatSearch ranges={ayatRanges} />
        <div className="quran-tools">
          <button type="button" className="btn btn-primary btn-sm" onClick={togglePlay}>
            {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? 'Pause' : 'Listen'}
          </button>
          {!reading && <QuranDisplayControls prefs={prefs} setPrefs={setPrefs} />}
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

      {reading ? (
        chapter && start.ready ? (
          <MushafPages
            from={chapter.pages[0]}
            to={chapter.pages[1]}
            startPage={start.page}
            chaptersById={chaptersById}
            focusSurah={chapter.id}
            onPageInView={onPageInView}
          />
        ) : (
          <div className="mushaf mushaf-loading">
            <div className="spinner" />
          </div>
        )
      ) : (
        <>
          {chapter?.bismillah_pre && (
            <p className="quran-bismillah" lang="ar" dir="rtl">
              {BISMILLAH}
            </p>
          )}
          <QuranVerses
            verses={verses}
            chaptersById={chaptersById}
            translation={prefs.translation}
            size={prefs.size}
            targetKey={targetKey}
            onTopVerse={onTopVerse}
          />
        </>
      )}

      {reading ? (
        chapter && surahPager
      ) : error ? (
        <div className="card empty-state" style={{ marginTop: 12 }}>
          <h3>Couldn't load the ayat</h3>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={loadMore}>
            Try again
          </button>
        </div>
      ) : hasMore ? (
        <div ref={sentinelRef} className="quran-more">
          <div className="spinner" />
        </div>
      ) : (
        verses.length > 0 && surahPager
      )}

      <p className="mathurat-source">
        {reading
          ? 'Mushaf text: King Fahd Complex QCF fonts; audio via the Quran.com API (Quran Foundation).'
          : 'Text, Malay translation (Abdullah Muhammad Basmeih) and audio from the Quran.com API (Quran Foundation).'}
      </p>
    </div>
  );
}

// Remount per surah so loading state never carries over between surahs.
export default function QuranSurah() {
  const { surah } = useParams();
  return <QuranSurahReader key={surah} />;
}
