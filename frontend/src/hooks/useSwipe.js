import { useRef } from 'react';

// A sideways swipe: `onNext` for one to the left, `onPrev` for one to the
// right. It works with a finger (touch), with a mouse dragged across, and
// with a two-finger swipe on a laptop trackpad. Only a clear, quick sideways
// move counts, so scrolling up and down (or across a wide grid) is left alone.
const EDGE = 24; // px from either side of the screen

export function useSwipe(onNext, onPrev) {
  const start = useRef(null);
  // When a swipe just happened, so the click that ends a mouse drag doesn't
  // also open the card it ended on.
  const swipedAt = useRef(0);
  // A trackpad swipe arrives as many small sideways scrolls.
  const wheel = useRef({ dx: 0, timer: null, done: false });

  // A swipe that begins inside something that scrolls sideways belongs to it.
  const scrollsSideways = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true;
    }
    return false;
  };

  const begin = (x, y, target, mouse = false) => {
    // A swipe from the very edge is the phone's own Back gesture (iPhone,
    // and Android with gesture navigation): leave it to the phone.
    const atEdge = x < EDGE || x > window.innerWidth - EDGE;
    start.current = !atEdge && !scrollsSideways(target) ? { x, y, at: Date.now(), mouse } : null;
  };

  const finish = (x, y) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = x - s.x;
    const dy = y - s.y;
    // A finger: a quick flick of 60px. A mouse or pen: a deliberate drag of
    // 100px, however long it takes.
    if (s.mouse ? Math.abs(dx) < 100 : Date.now() - s.at > 700 || Math.abs(dx) < 60) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.6) return;
    swipedAt.current = Date.now();
    if (dx < 0) onNext();
    else onPrev();
  };

  return {
    // A finger.
    onTouchStart(e) {
      if (e.touches.length !== 1) {
        start.current = null;
        return;
      }
      begin(e.touches[0].clientX, e.touches[0].clientY, e.target);
    },
    onTouchEnd(e) {
      finish(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    },
    // A swipe interrupted by the system (a call, a notification pulled down) is no swipe.
    onTouchCancel() {
      start.current = null;
    },
    // A mouse or a pen (a finger is handled above).
    onPointerDown(e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      begin(e.clientX, e.clientY, e.target, true);
    },
    onPointerUp(e) {
      if (e.pointerType === 'touch') return;
      finish(e.clientX, e.clientY);
    },
    onPointerCancel(e) {
      if (e.pointerType !== 'touch') start.current = null;
    },
    onClickCapture(e) {
      if (Date.now() - swipedAt.current < 400) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    // A two-finger sideways swipe on a trackpad: one step per gesture.
    onWheel(e) {
      const w = wheel.current;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.5 || scrollsSideways(e.target)) return;
      clearTimeout(w.timer);
      w.timer = setTimeout(() => {
        w.dx = 0;
        w.done = false;
      }, 220);
      if (w.done) return;
      w.dx += e.deltaX;
      if (Math.abs(w.dx) > 90) {
        w.done = true;
        if (w.dx > 0) onNext();
        else onPrev();
      }
    }
  };
}
