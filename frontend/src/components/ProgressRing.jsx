import { useEffect, useRef, useState } from 'react';

export default function ProgressRing({ percent = 0, size = 168, primaryText, secondaryText }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = size / 2 - 16;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - clamped / 100);

  const [offset, setOffset] = useState(circumference);
  const frame = useRef(null);

  useEffect(() => {
    setOffset(circumference);
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => setOffset(targetOffset));
    });
    return () => frame.current && cancelAnimationFrame(frame.current);
  }, [circumference, targetOffset]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% complete`}>
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
        fontSize="30"
        fontWeight="700"
        fill="var(--ink)"
      >
        {primaryText}
      </text>
      <text x="50%" y="64%" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--ink-soft)">
        {secondaryText}
      </text>
    </svg>
  );
}
