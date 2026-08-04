import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';

export default function MutabaahRing({ entry, size = 168 }) {
  const total = MUTABAAH_FIELDS.length;
  const completed = MUTABAAH_FIELDS.filter((f) => entry?.[f.key]).length;
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const segmentLen = circumference / total;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${completed} of ${total} mutabaah items completed today`}
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
      {MUTABAAH_FIELDS.map((f, i) => {
        const isDone = entry?.[f.key];
        const offset = i * segmentLen;
        return (
          <circle
            key={f.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isDone ? 'var(--primary)' : 'transparent'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${segmentLen} ${circumference - segmentLen}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-display)"
        fontSize="30"
        fontWeight="700"
        fill="var(--ink)"
      >
        {completed}/{total}
      </text>
      <text x="50%" y="63%" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="var(--ink-soft)">
        completed today
      </text>
    </svg>
  );
}
