import { useEffect, useRef, useState } from 'react';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';

export default function MutabaahRing({ entry, size = 168 }) {
  const total = MUTABAAH_FIELDS.length;
  const completed = MUTABAAH_FIELDS.filter((f) => entry?.[f.key]).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - completed / total);

  // Starts fully "empty" (offset = circumference) and animates to the real
  // value on mount/whenever the underlying data changes, via a CSS transition
  // on stroke-dashoffset — a smooth fill instead of popping in instantly.
  const [offset, setOffset] = useState(circumference);
  const frame = useRef(null);

  useEffect(() => {
    setOffset(circumference);
    // Double rAF so the browser actually paints the "empty" state first —
    // otherwise React can batch straight to the target and the transition
    // never has a starting point to animate from.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => setOffset(targetOffset));
    });
    return () => frame.current && cancelAnimationFrame(frame.current);
  }, [circumference, targetOffset]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${completed} of ${total} mutabaah items completed today, ${percent} percent`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.65, 0, 0.35, 1)' }}
      />
      <text
        x="50%"
        y="45%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-display)"
        fontSize="32"
        fontWeight="700"
        fill="var(--ink)"
      >
        {percent}%
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--ink-soft)">
        {completed}/{total} completed today
      </text>
    </svg>
  );
}
