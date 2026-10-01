import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchChapters, fetchJuzs, juzPages, keyFromHash, saveLastRead, TOTAL_JUZ, TOTAL_PAGES } from '../services/quranApi';
import { useQuranVerses } from '../hooks/useQuranVerses';
import QuranVerses from '../components/QuranVerses';
import MushafPage from '../components/MushafPage';
import MushafPages from '../components/MushafPages';
import MushafWordPanel from '../components/MushafWordPanel';
import { DEFAULT_MODE, QuranDisplayControls, QuranModeSwitch, useQuranPrefs } from '../components/QuranControls';
import { useStartPage } from '../hooks/useStartPage';

// Reader for a whole juzuk (/quran/juz/:number) or a single mushaf page
// (/quran/page/:number). Both can cross surah boundaries, so verses are shown
// with surah headings.
function QuranRangeReader({ kind }) {
  const { number: raw } = useParams();
  const number = Number(raw);
  const max = kind === 'juz' ? TOTAL_JUZ : TOTAL_PAGES;
  const valid = Number.isInteger(number) && number >= 1 && number <= max;
  const { hash } = useLocation();
  const targetKey = keyFromHash(hash);

  const [prefs, setPrefs] = useQuranPrefs();
  // Opens in Membaca (mushaf); "Ayat demi Ayat" applies to this visit only.
  const [mode, setMode] = useState(DEFAULT_MODE);
  const reading = mode === 'reading';
  const juzStart = useStartPage(targetKey, reading && kind === 'juz');
  const [chapters, setChapters] = useState([]);
  const [juzs, setJuzs] = useState([]);
  const [mushafVerses, setMushafVerses] = useState([]);
  const [selection, setSelection] = useState(null);
  const closePanel = useCallback(() => setSelection(null), []);
  const selectWord = useCallback((w) => setSelection((cur) => (cur?.id === w.id ? null : w)), []);
  const { verses, error, hasMore, loadMore, sentinelRef } = useQuranVerses(kind, valid && !reading ? number : null, {
    untilKey: targetKey,
    loadAll: kind === 'page'
  });

  useEffect(() => {
    fetchChapters().then(setChapters).catch(() => {});
    if (kind === 'juz') fetchJuzs().then(setJuzs).catch(() => {});
  }, [kind]);

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, number]);

  const chaptersById = useMemo(() => Object.fromEntries(chapters.map((c) => [c.id, c])), [chapters]);
  const unit = kind === 'juz' ? 'Juzuk' : 'Muka surat';
  const path = (n) => `/quran/${kind}/${n}`;

  const onTopVerse = useCallback(
    (v) =>
      saveLastRead({
        kind,
        number,
        key: v.key,
        label: `${chaptersById[v.surah]?.name_simple || `Surah ${v.surah}`}, ayat ${v.n} (${unit} ${number})`
      }),
    [kind, number, chaptersById, unit]
  );

  // Subtitle: where this juzuk starts, or which surah(s) and juzuk a page covers.
  let subtitle = '';
  if (kind === 'juz') {
    const juz = juzs.find((j) => j.n === number);
    if (juz) subtitle = `Bermula ${chaptersById[juz.start.surah]?.name_simple || `Surah ${juz.start.surah}`} ayat ${juz.start.ayah}`;
  } else {
    const shown = reading ? mushafVerses : verses;
    if (shown.length) {
      const surahs = [...new Set(shown.map((v) => v.surah))].map((s) => chaptersById[s]?.name_simple || `Surah ${s}`);
      subtitle = `${surahs.join(', ')} · Juzuk ${shown[0].juz}`;
    }
  }

  // Single page in mushaf view: opening the page counts as reading it. Saved
  // once surah names are loaded, so the label reads well.
  const onMushafLoaded = useCallback(({ verses: pageVerses }) => setMushafVerses(pageVerses), []);
  useEffect(() => {
    const first = mushafVerses[0];
    const name = first && chaptersById[first.surah]?.name_simple;
    if (kind !== 'page' || !reading || !name) return;
    saveLastRead({ kind, number, key: first.key, label: `${name}, ayat ${first.n} (${unit} ${number})` });
  }, [reading, mushafVerses, chaptersById, kind, number, unit]);

  // Juzuk in mushaf view: the page on screen is the reading position.
  const onPageInView = useCallback(
    (page, pageVerses) => {
      const first = pageVerses[0];
      if (!first) return;
      const name = chaptersById[first.surah]?.name_simple || `Surah ${first.surah}`;
      saveLastRead({ kind, number, key: first.key, label: `${name}, ayat ${first.n} (Juzuk ${number}, muka surat ${page})` });
    },
    [kind, number, chaptersById]
  );

  const pager = (where) => (
    <nav className={`quran-pager${where === 'top' ? ' top' : ''}`}>
      {number > 1 ? (
        <Link to={path(number - 1)} className="btn btn-ghost btn-sm">
          <ChevronLeft size={15} /> {unit} {number - 1}
        </Link>
      ) : (
        <span />
      )}
      {number < max && (
        <Link to={path(number + 1)} className={`btn btn-sm ${where === 'top' ? 'btn-ghost' : 'btn-primary'}`}>
          {unit} {number + 1} <ChevronRight size={15} />
        </Link>
      )}
    </nav>
  );

  if (!valid) {
    return (
      <div className="page">
        <div className="card empty-state">
          <h3>
            {unit} {raw} not found
          </h3>
          <p>Choose a number from 1 to {max}.</p>
          <Link to={`/quran?view=${kind}`} className="btn btn-primary" style={{ marginTop: 12 }}>
            Back to Al-Quran
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page quran-surah">
      <Link to={`/quran?view=${kind}`} className="quran-back">
        <ChevronLeft size={16} /> Al-Quran
      </Link>

      <div className="card quran-head">
        <h1 className="page-title">
          {unit} {number}
        </h1>
        <p className="page-subtitle">{subtitle || ' '}</p>
        <QuranModeSwitch reading={reading} onChange={setMode} />
        {!reading && (
          <div className="quran-tools">
            <QuranDisplayControls prefs={prefs} setPrefs={setPrefs} />
          </div>
        )}
      </div>

      {kind === 'page' && pager('top')}

      {reading && kind === 'page' ? (
        <>
          <MushafPage
            page={number}
            chaptersById={chaptersById}
            onLoaded={onMushafLoaded}
            onSelectWord={selectWord}
            selectedId={selection?.id}
          />
          <MushafWordPanel selection={selection} chaptersById={chaptersById} onClose={closePanel} />
        </>
      ) : reading ? (
        juzStart.ready ? (
          <MushafPages
            from={juzPages(number)[0]}
            to={juzPages(number)[1]}
            startPage={juzStart.page}
            chaptersById={chaptersById}
            onPageInView={onPageInView}
          />
        ) : (
          <div className="mushaf mushaf-loading">
            <div className="spinner" />
          </div>
        )
      ) : (
      <QuranVerses
        verses={verses}
        chaptersById={chaptersById}
        translation={prefs.translation}
        size={prefs.size}
        surahHeaders
        pageMarkers={kind === 'juz'}
        targetKey={targetKey}
        onTopVerse={onTopVerse}
      />
      )}

      {reading ? (
        pager('bottom')
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
        verses.length > 0 && pager('bottom')
      )}

      <p className="mathurat-source">
        {reading
          ? 'Mushaf text: King Fahd Complex QCF fonts, via the Quran.com API (Quran Foundation).'
          : 'Text and Malay translation (Abdullah Muhammad Basmeih) from the Quran.com API (Quran Foundation).'}
      </p>
    </div>
  );
}

// Remount per juzuk/page so loading state never carries over between them.
export default function QuranRange({ kind }) {
  const { number } = useParams();
  return <QuranRangeReader key={`${kind}/${number}`} kind={kind} />;
}
