import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, BookOpenText } from 'lucide-react';
import TafsirSheet from './TafsirSheet';
import MushafWordPanel from './MushafWordPanel';
import { toggleBookmark, useBookmarks } from '../features/quran/bookmarks';

// An ayat's text as its words, in the word-by-word numbering used for
// meanings ("2:255:3" is the third). Pause and stop marks stand alone in the
// text but aren't words, so each is kept with the word before it.
const ARABIC_LETTER = /[ء-يٱ-ۓۺ-ۿ]/;
function ayatWords(text) {
  const words = [];
  text.split(' ').forEach((token) => {
    if (!token) return;
    if (ARABIC_LETTER.test(token) || !words.length) words.push(token);
    else words[words.length - 1] += ` ${token}`;
  });
  return words;
}

export const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

function arabicNumber(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// Renders a run of verses, shared by the surah, juzuk and page readers.
// - surahHeaders: show a surah heading (and Bismillah) where a surah starts,
//   for readers that cross surah boundaries (juzuk, page).
// - pageMarkers: show "Muka surat N" where a new mushaf page begins.
// - targetKey: verse key ("2:255") to scroll to once it's rendered.
// - onTopVerse: called (debounced) with the verse at the top of the screen.
export default function QuranVerses({
  verses,
  chaptersById = {},
  translation = true,
  size = 28,
  surahHeaders = false,
  pageMarkers = true,
  targetKey = null,
  onTopVerse
}) {
  const refs = useRef({});
  const scrolledTo = useRef(null);
  const [tafsirKey, setTafsirKey] = useState(null);
  const bookmarked = new Set(useBookmarks().map((b) => b.id));
  // Tapped word, shown in the meaning panel; tapping it again closes the panel.
  const [selection, setSelection] = useState(null);
  const closePanel = useCallback(() => setSelection(null), []);
  const selectWord = useCallback((w) => setSelection((cur) => (cur?.id === w.id ? null : w)), []);

  useEffect(() => {
    if (!targetKey || scrolledTo.current === targetKey) return;
    const el = refs.current[targetKey];
    if (el) {
      scrolledTo.current = targetKey;
      setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
    }
  }, [targetKey, verses]);

  useEffect(() => {
    if (!onTopVerse || !verses.length) return;
    const byKey = Object.fromEntries(verses.map((v) => [v.key, v]));
    let timer;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => byKey[e.target.dataset.key]);
        if (!visible.length) return;
        const top = visible.reduce((a, b) => (verses.indexOf(a) <= verses.indexOf(b) ? a : b));
        clearTimeout(timer);
        timer = setTimeout(() => onTopVerse(top), 800);
      },
      { rootMargin: '-120px 0px -60% 0px' }
    );
    Object.values(refs.current).forEach((el) => el && observer.observe(el));
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [verses, onTopVerse]);

  return (
    <div className="quran-verses">
      {verses.map((v, i) => {
        const prev = verses[i - 1];
        const chapter = chaptersById[v.surah];
        const startsSurah = surahHeaders && v.n === 1;
        return (
          <Fragment key={v.key}>
            {pageMarkers && (!prev || prev.page !== v.page) && (
              <div className="quran-page-marker">
                <span>
                  Muka surat {v.page} · Juzuk {v.juz}
                </span>
              </div>
            )}
            {startsSurah && (
              <div className="quran-surah-divider">
                <div className="quran-surah-divider-name">
                  <span>
                    {v.surah}. {chapter?.name_simple || `Surah ${v.surah}`}
                  </span>
                  {chapter && (
                    <span className="quran-surah-divider-ar" lang="ar" dir="rtl">
                      {chapter.name_arabic}
                    </span>
                  )}
                </div>
                {chapter?.bismillah_pre && (
                  <p className="quran-bismillah" lang="ar" dir="rtl">
                    {BISMILLAH}
                  </p>
                )}
              </div>
            )}
            <article
              data-key={v.key}
              ref={(el) => (refs.current[v.key] = el)}
              className={`quran-verse${targetKey === v.key ? ' target' : ''}`}
            >
              <div className="quran-verse-head">
                <span className="quran-verse-key">{v.key}</span>
                <span className="quran-verse-actions">
                  <button
                    type="button"
                    className={`quran-tafsir-btn quran-mark-btn${bookmarked.has(v.key) ? ' on' : ''}`}
                    onClick={() =>
                      toggleBookmark({
                        kind: 'chapter',
                        number: v.surah,
                        key: v.key,
                        label: `${chapter?.name_simple || `Surah ${v.surah}`} ${v.key} · muka surat ${v.page}`
                      })
                    }
                    aria-pressed={bookmarked.has(v.key)}
                    aria-label={bookmarked.has(v.key) ? `Remove bookmark from ayat ${v.key}` : `Bookmark ayat ${v.key}`}
                    title={bookmarked.has(v.key) ? 'Remove bookmark' : 'Bookmark this ayat'}
                  >
                    {bookmarked.has(v.key) ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                  </button>
                  <button type="button" className="quran-tafsir-btn" onClick={() => setTafsirKey(v.key)}>
                    <BookOpenText size={13} /> Tafsir
                  </button>
                </span>
              </div>
              <p className="mathurat-arabic quran-arabic" dir="rtl" lang="ar" style={{ fontSize: size }}>
                {ayatWords(v.ar).map((text, i) => {
                  const id = `${v.key}:${i + 1}`;
                  return (
                    <Fragment key={id}>
                      <span
                        className={`quran-word${selection?.id === id ? ' selected' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectWord({ id, key: v.key, page: v.page, end: false })}
                        onKeyDown={(e) =>
                          (e.key === 'Enter' || e.key === ' ') && selectWord({ id, key: v.key, page: v.page, end: false })
                        }
                      >
                        {text}
                      </span>{' '}
                    </Fragment>
                  );
                })}
                <span className="ayah-mark">﴿{arabicNumber(v.n)}﴾</span>
              </p>
              {translation && <p className="quran-translation">{v.ms}</p>}
            </article>
          </Fragment>
        );
      })}
      <TafsirSheet verseKey={tafsirKey} chaptersById={chaptersById} onClose={() => setTafsirKey(null)} />
      <MushafWordPanel selection={selection} chaptersById={chaptersById} onClose={closePanel} />
    </div>
  );
}
