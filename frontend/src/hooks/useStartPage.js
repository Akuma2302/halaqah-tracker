import { useEffect, useState } from 'react';
import { fetchVersePage } from '../services/quranApi';

// For mushaf view: the page to open at when the URL points at a verse (e.g.
// "Continue reading" → #2:255). `ready` is false while that page is looked up.
export function useStartPage(targetKey, enabled) {
  const [state, setState] = useState({ key: null, page: null });

  useEffect(() => {
    if (!enabled || !targetKey || state.key === targetKey) return;
    let cancelled = false;
    fetchVersePage(targetKey)
      .then((page) => !cancelled && setState({ key: targetKey, page }))
      .catch(() => !cancelled && setState({ key: targetKey, page: null }));
    return () => {
      cancelled = true;
    };
  }, [targetKey, enabled, state.key]);

  if (!enabled || !targetKey) return { ready: true, page: null };
  return { ready: state.key === targetKey, page: state.page };
}
