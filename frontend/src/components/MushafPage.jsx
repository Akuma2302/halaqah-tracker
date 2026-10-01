import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchPageWords, loadMushafFont, mushafFontFamily, TOTAL_PAGES } from '../services/quranApi';
import { BISMILLAH } from './QuranVerses';

const LINES_PER_PAGE = 15;
const BASE_FONT = 30; // px, before fitting to the screen width
const MAX_FONT = 42;
const SHORT_LINE = 0.75; // fraction of the widest line below which a line is centred

// Lines with no words are surah openings: two empty lines before a surah's
// first ayah = title + Bismillah; one = title only (al-Fatihah, at-Tawbah).
// Trailing empty lines (pages 1-2 are short) are dropped.
function buildLines(words, verses) {
  const byLine = new Map();
  for (const w of words) {
    if (!byLine.has(w.line)) byLine.set(w.line, []);
    byLine.get(w.line).push(w);
  }
  const lastWordLine = Math.max(...byLine.keys());
  const starts = verses.filter((v) => v.n === 1);

  const lines = [];
  for (let line = 1; line <= LINES_PER_PAGE; line++) {
    if (byLine.has(line)) {
      lines.push({ type: 'words', line, words: byLine.get(line) });
      continue;
    }
    if (line > lastWordLine) break;
    const next = starts.find((s) => s.firstLine > line);
    if (!next) continue;
    const gap = next.firstLine - line; // empty lines left before that surah begins
    const hasBismillahLine = next.firstLine - 2 >= 1 && !byLine.has(next.firstLine - 2) && !byLine.has(next.firstLine - 1);
    if (gap === 2 || !hasBismillahLine) lines.push({ type: 'title', line, surah: next.surah });
    else lines.push({ type: 'bismillah', line });
  }
  return lines;
}

export default function MushafPage({ page, chaptersById = {}, onLoaded }) {
  const [data, setData] = useState(null);
  const [fontReady, setFontReady] = useState(false);
  const [error, setError] = useState(false);
  const [fontSize, setFontSize] = useState(BASE_FONT);
  // Lines much shorter than the page width (e.g. a surah's last line) are
  // centred rather than stretched, as in the printed mushaf.
  const [shortLines, setShortLines] = useState(new Set());
  const containerRef = useRef(null);
  const measureRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFontReady(false);
    setError(false);
    Promise.all([fetchPageWords(page), loadMushafFont(page)])
      .then(([pageData]) => {
        if (cancelled) return;
        setData(pageData);
        setFontReady(true);
        onLoaded?.(pageData);
      })
      .catch(() => !cancelled && setError(true));
    // Warm up the next page's font so turning the page is instant.
    if (page < TOTAL_PAGES) loadMushafFont(page + 1).catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Fit the widest line to the container: measure the natural line widths at
  // BASE_FONT, then scale. Re-fit when the container is resized.
  useLayoutEffect(() => {
    if (!fontReady || !containerRef.current || !measureRef.current) return;
    function fit() {
      // clientWidth includes the card's padding; lines only get the content box.
      const style = getComputedStyle(containerRef.current);
      const available =
        containerRef.current.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const measured = [...measureRef.current.children].map((el) => ({ line: Number(el.dataset.line), width: el.scrollWidth }));
      const widest = Math.max(...measured.map((m) => m.width));
      if (!available || !widest) return;
      setFontSize(Math.min(MAX_FONT, Math.floor(BASE_FONT * (available / widest) * 0.98)));
      setShortLines(new Set(measured.filter((m) => m.width < widest * SHORT_LINE).map((m) => m.line)));
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fontReady, data]);

  if (error) {
    return (
      <div className="card empty-state">
        <h3>Couldn't load this page</h3>
        <p>Check your connection and try again.</p>
      </div>
    );
  }

  if (!data || !fontReady) {
    return (
      <div className="mushaf mushaf-loading">
        <div className="spinner" />
      </div>
    );
  }

  const family = mushafFontFamily(page);
  const lines = buildLines(data.words, data.verses);
  const opening = page <= 2; // al-Fatihah and the start of al-Baqarah are centred

  return (
    <div className={`mushaf${opening ? ' opening' : ''}`} ref={containerRef}>
      {/* Hidden copy at the base size, used only to measure natural line widths */}
      <div className="mushaf-measure" ref={measureRef} aria-hidden="true" style={{ fontFamily: family, fontSize: BASE_FONT }}>
        {lines
          .filter((l) => l.type === 'words')
          .map((l) => (
            <span key={l.line} data-line={l.line}>
              {l.words.map((w) => (
                <span key={w.id}>{w.glyph}</span>
              ))}
            </span>
          ))}
      </div>

      {lines.map((l) =>
        l.type === 'words' ? (
          <div
            key={l.line}
            className={`mushaf-line${shortLines.has(l.line) ? ' short' : ''}`}
            dir="rtl"
            lang="ar"
            style={{ fontFamily: family, fontSize }}
          >
            {l.words.map((w) => (
              <span key={w.id} className={w.end ? 'mushaf-end' : 'mushaf-word'} data-key={w.key}>
                {w.glyph}
              </span>
            ))}
          </div>
        ) : l.type === 'title' ? (
          <div key={l.line} className="mushaf-title" style={{ fontSize: fontSize * 0.8 }}>
            <span lang="ar" dir="rtl">
              سُورَةُ {chaptersById[l.surah]?.name_arabic || ''}
            </span>
          </div>
        ) : (
          <div key={l.line} className="mushaf-bismillah" lang="ar" dir="rtl" style={{ fontSize: fontSize * 0.85 }}>
            {BISMILLAH}
          </div>
        )
      )}
    </div>
  );
}
