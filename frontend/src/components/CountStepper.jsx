import { Check, Minus, Plus } from 'lucide-react';

// Counter with a progress bar towards a daily goal, used for Tilawah pages
// and Istighfar count: a joined −/number/+ control, quick-add buttons for
// bigger steps, and the bar. Lives inside a clickable checklist row, so every
// interaction stops propagation to avoid toggling the tick.
//   quick: [5, 10, 20]      -> "+5 +10 +20" buttons
//   goalText(value)         -> the line under the bar
export default function CountStepper({ value, onChange, max, goal, unit, label, goalText, quick = [], disabled }) {
  const stop = (e) => e.stopPropagation();
  const set = (n) => onChange(Math.max(0, Math.min(max, n)));
  const percent = Math.min(100, Math.round((value / goal) * 100));
  const reached = value >= goal;

  return (
    <div className={`count-stepper-wrap${reached ? ' reached' : ''}`} onClick={stop} onKeyDown={stop}>
      <div className="count-top">
        <div className="count-stepper">
          <button type="button" className="count-btn" onClick={() => set(value - 1)} disabled={disabled || value <= 0} aria-label={`One ${label} less`}>
            <Minus size={16} />
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
            <Plus size={16} />
          </button>
        </div>
        <span className="count-unit">
          {unit}
          <small>goal {goal}</small>
        </span>
        {quick.length > 0 && (
          <div className="count-quick" role="group" aria-label={`Add ${unit}`}>
            {quick.map((n) => (
              <button key={n} type="button" className="count-quick-btn" onClick={() => set(value + n)} disabled={disabled || value >= max} aria-label={`Add ${n} ${unit}`}>
                +{n}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="count-goal">
        <span className="count-goal-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${unit} towards the goal`}>
          <span className="count-goal-fill" style={{ width: `${percent}%` }} />
        </span>
        <span className="count-goal-text">
          {reached && <Check size={12} strokeWidth={3} />}
          {goalText(value)}
        </span>
      </div>
    </div>
  );
}
