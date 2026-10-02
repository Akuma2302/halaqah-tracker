import { Minus, Plus } from 'lucide-react';

// −/number/+ counter with a progress bar towards a daily goal, used for
// Tilawah pages and Zikir count. Lives inside a clickable checklist row, so
// every interaction stops propagation to avoid toggling the tick.
//   goalText(value) -> the line under the bar
export default function CountStepper({ value, onChange, max, goal, unit, label, goalText, disabled }) {
  const stop = (e) => e.stopPropagation();
  const set = (n) => onChange(Math.max(0, Math.min(max, n)));
  const percent = Math.min(100, Math.round((value / goal) * 100));

  return (
    <div className="count-stepper-wrap" onClick={stop} onKeyDown={stop}>
      <div className="count-stepper">
        <button type="button" className="count-btn" onClick={() => set(value - 1)} disabled={disabled || value <= 0} aria-label={`One ${label} less`}>
          <Minus size={14} />
        </button>
        <input
          className="count-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => set(parseInt(e.target.value, 10) || 0)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`${unit} count`}
        />
        <button type="button" className="count-btn" onClick={() => set(value + 1)} disabled={disabled || value >= max} aria-label={`One ${label} more`}>
          <Plus size={14} />
        </button>
        <span className="count-unit">{unit}</span>
      </div>
      <div className="count-goal">
        <span className="count-goal-bar">
          <span className="count-goal-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="count-goal-text">{goalText(value)}</span>
      </div>
    </div>
  );
}
