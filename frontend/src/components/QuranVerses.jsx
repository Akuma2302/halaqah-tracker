import { Fragment, useEffect, useRef, useState } from 'react';
import { BookOpenText } from 'lucide-react';
import TafsirSheet from './TafsirSheet';

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
                <button type="button" className="quran-tafsir-btn" onClick={() => setTafsirKey(v.key)}>
                  <BookOpenText size={13} /> Tafsir
                </button>
              </div>
              <p className="mathurat-arabic quran-arabic" dir="rtl" lang="ar" style={{ fontSize: size }}>
                {v.ar} <span className="ayah-mark">﴿{arabicNumber(v.n)}﴾</span>
              </p>
              {translation && <p className="quran-translation">{v.ms}</p>}
            </article>
          </Fragment>
        );
      })}
      <TafsirSheet verseKey={tafsirKey} chaptersById={chaptersById} onClose={() => setTafsirKey(null)} />
    </div>
  );
}
