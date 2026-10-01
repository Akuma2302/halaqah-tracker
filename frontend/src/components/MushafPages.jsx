import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import MushafPage from './MushafPage';

const BATCH = 2; // pages added each time the end of the list comes into view

// A run of mushaf pages (a surah or juzuk in "Membaca" view). Pages are added
// as the reader scrolls, starting at `startPage` (e.g. the last-read page),
// with a button to show earlier ones. `onPageInView` gets the page at the top
// of the screen and the verses on it, for saving the reading position.
export default function MushafPages({ from, to, startPage, chaptersById, focusSurah = null, onPageInView }) {
  const first = Math.min(Math.max(startPage || from, from), to);
  const [range, setRange] = useState([first, Math.min(first + BATCH - 1, to)]);
  const pageVerses = useRef({});
  const pageRefs = useRef({});
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || range[1] >= to) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setRange(([a, b]) => [a, Math.min(b + BATCH, to)]),
      { rootMargin: '900px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [range, to]);

  // Report the page whose top area is on screen.
  useEffect(() => {
    if (!onPageInView) return;
    let timer;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).map((e) => Number(e.target.dataset.page));
        if (!visible.length) return;
        const page = Math.min(...visible);
        clearTimeout(timer);
        timer = setTimeout(() => pageVerses.current[page] && onPageInView(page, pageVerses.current[page]), 800);
      },
      { rootMargin: '-120px 0px -55% 0px' }
    );
    Object.values(pageRefs.current).forEach((el) => el && observer.observe(el));
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [range, onPageInView]);

  const onLoaded = useCallback(
    (page) =>
      ({ verses }) => {
        pageVerses.current[page] = verses;
        // The opening page counts as read as soon as it has loaded.
        if (page === first && onPageInView) onPageInView(page, verses);
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [first]
  );

  function showEarlier() {
    const before = document.documentElement.scrollHeight;
    setRange(([a, b]) => [Math.max(from, a - BATCH), b]);
    // Keep the current page where it is on screen after earlier pages are inserted above.
    requestAnimationFrame(() => window.scrollBy(0, document.documentElement.scrollHeight - before));
  }

  const pages = [];
  for (let p = range[0]; p <= range[1]; p++) pages.push(p);

  return (
    <div className="mushaf-pages">
      {range[0] > from && (
        <button type="button" className="btn btn-ghost btn-block mushaf-earlier" onClick={showEarlier}>
          <ChevronUp size={15} /> Show earlier pages ({from}–{range[0] - 1})
        </button>
      )}
      {pages.map((p) => (
        <section key={p} data-page={p} ref={(el) => (pageRefs.current[p] = el)} className="mushaf-page-slot">
          <div className="quran-page-marker">
            <span>Muka surat {p}</span>
          </div>
          <MushafPage page={p} chaptersById={chaptersById} focusSurah={focusSurah} onLoaded={onLoaded(p)} />
        </section>
      ))}
      {range[1] < to && (
        <div ref={sentinelRef} className="quran-more">
          <div className="spinner" />
        </div>
      )}
    </div>
  );
}
