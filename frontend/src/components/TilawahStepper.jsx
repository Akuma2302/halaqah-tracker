import { Minus, Plus } from 'lucide-react';
import { MAX_TILAWAH_PAGES, PAGES_PER_JUZ } from '../features/mutabaah/mutabaahFields';

// Pages-read counter for the Tilawah row. Lives inside a clickable checklist
// row, so every interaction stops propagation to avoid toggling the tick.
export default function TilawahStepper({ pages, onChange, disabled }) {
  const stop = (e) => e.stopPropagation();
  const set = (n) => onChange(Math.max(0, Math.min(MAX_TILAWAH_PAGES, n)));
  const juzPercent = Math.min(100, Math.round((pages / PAGES_PER_JUZ) * 100));

  return (
    <div className="tilawah" onClick={stop} onKeyDown={stop}>
      <div className="tilawah-stepper">
        <button
          type="button"
          className="tilawah-btn"
          onClick={() => set(pages - 1)}
          disabled={disabled || pages <= 0}
          aria-label="One page less"
        >
          <Minus size={14} />
        </button>
        <input
          className="tilawah-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_TILAWAH_PAGES}
          value={pages}
          onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label="Pages read"
        />
        <button
          type="button"
          className="tilawah-btn"
          onClick={() => set(pages + 1)}
          disabled={disabled || pages >= MAX_TILAWAH_PAGES}
          aria-label="One page more"
        >
          <Plus size={14} />
        </button>
        <span className="tilawah-unit">pages</span>
      </div>
      <div className="tilawah-goal">
        <span className="tilawah-goal-bar">
          <span className="tilawah-goal-fill" style={{ width: `${juzPercent}%` }} />
        </span>
        <span className="tilawah-goal-text">
          {pages >= PAGES_PER_JUZ
            ? `${(pages / PAGES_PER_JUZ).toFixed(1).replace(/\.0$/, '')} juz ✓`
            : `${PAGES_PER_JUZ - pages} more page${PAGES_PER_JUZ - pages === 1 ? '' : 's'} to complete 1 juz`}
        </span>
      </div>
    </div>
  );
}
