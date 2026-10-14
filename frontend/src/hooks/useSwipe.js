import { useRef } from 'react';

// A sideways swipe on a touch screen: `onNext` for a swipe to the left,
// `onPrev` for one to the right. Only a clear, quick sideways move counts,
// so scrolling up and down (or across a wide grid) is left alone.
export function useSwipe(onNext, onPrev) {
  const start = useRef(null);

  // A swipe that begins inside something that scrolls sideways belongs to it.
  const scrollsSideways = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
    }
    return false;
  };

  return {
    onTouchStart(e) {
      const t = e.touches[0];
      start.current = e.touches.length === 1 && !scrollsSideways(e.target) ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
    },
    onTouchEnd(e) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.at > 700 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      if (dx < 0) onNext();
      else onPrev();
    }
  };
}
