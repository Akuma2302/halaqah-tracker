import { useEffect, useRef, useState } from 'react';
import { fetchVersesBy } from '../services/quranApi';

// Loads the verses of a surah, juzuk or mushaf page in batches. Fetches the
// first batch immediately, keeps going until `untilKey` (e.g. "2:255") is
// loaded, and exposes a sentinel ref for infinite scroll. With `loadAll`, it
// fetches every batch up front (used for single mushaf pages).
export function useQuranVerses(kind, number, { untilKey = null, loadAll = false } = {}) {
  const [verses, setVerses] = useState([]);
  const [nextBatch, setNextBatch] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef(null);

  // Guards against a slow response for the previous selection landing after a switch.
  const current = useRef(`${kind}/${number}`);
  current.current = `${kind}/${number}`;

  useEffect(() => {
    setVerses([]);
    setNextBatch(1);
    setError(false);
  }, [kind, number]);

  async function loadMore() {
    if (loading || !nextBatch || !number) return;
    const requested = `${kind}/${number}`;
    setLoading(true);
    setError(false);
    try {
      const { verses: more, nextPage } = await fetchVersesBy(kind, number, nextBatch);
      if (current.current !== requested) return;
      setVerses((v) => (more[0] && v.some((x) => x.key === more[0].key) ? v : [...v, ...more]));
      setNextBatch(nextPage);
    } catch {
      if (current.current === requested) setError(true);
    } finally {
      setLoading(false);
    }
  }

  // First batch, then more while a target verse isn't loaded yet (or loadAll).
  useEffect(() => {
    if (!number || loading || error || !nextBatch) return;
    const targetLoaded = !untilKey || verses.some((v) => v.key === untilKey);
    if (verses.length === 0 || loadAll || !targetLoaded) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, number, verses.length, nextBatch, loading, error, untilKey, loadAll]);

  // Infinite scroll: load the next batch when the end comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextBatch || loadAll) return;
    const observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: '600px'
    });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextBatch, loading, verses.length, loadAll]);

  return { verses, loading, error, hasMore: !!nextBatch, loadMore, sentinelRef };
}
