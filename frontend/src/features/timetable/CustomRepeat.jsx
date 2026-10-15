import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DateMenu, SelectMenu } from '../../components/pickers';
import { REPEAT_UNITS } from './repeat';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDate = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const plusMonths = (key, n) => {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(y, m - 1 + n, d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// A number with up and down arrows, kept between `min` and `max`.
function Stepper({ value, onChange, min = 1, max = 99, label }) {
  const set = (n) => onChange(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));
  return (
    <span className="cr-stepper">
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Math.min(max, Number(e.target.value)))}
        onBlur={(e) => set(parseInt(e.target.value, 10))}
        aria-label={label}
      />
      <span className="cr-arrows">
        <button type="button" onClick={() => set((Number(value) || min) + 1)} aria-label={`More ${label}`}>
          <ChevronUp size={13} />
        </button>
        <button type="button" onClick={() => set((Number(value) || min) - 1)} aria-label={`Fewer ${label}`}>
          <ChevronDown size={13} />
        </button>
      </span>
    </span>
  );
}

// "Custom recurrence", as a calendar has it: repeat every N days, weeks,
// months or years; on which days of the week; and when it ends (never, on a
// date, or after N times). `single` allows only one day (editing one entry).
export default function CustomRepeat({ open, initial, startDate, single, onCancel, onDone }) {
  const [r, setR] = useState(initial);
  useEffect(() => {
    if (open) setR({ ...initial, until: initial.until || plusMonths(startDate, 3) });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes the window, not the sheet under it.
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCancel();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onCancel]);

  if (!open || !r) return null;
  const n = Number(r.every) || 1;
  const toggle = (d) =>
    setR((x) => {
      if (single) return { ...x, days: [d] };
      const days = x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d];
      return { ...x, days: days.length ? days : x.days };
    });
  const done = () =>
    onDone({
      ...r,
      every: Math.max(1, Number(r.every) || 1),
      count: Math.max(1, Number(r.count) || 1),
      until: r.until < startDate ? startDate : r.until
    });

  return (
    <div className="ev-dialog-backdrop" onClick={onCancel}>
      <div className="ev-dialog cr-dialog" role="dialog" aria-modal="true" aria-labelledby="cr-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="cr-title">Custom recurrence</h3>

        <div className="cr-line">
          <span className="cr-label">Repeat every</span>
          <Stepper value={r.every} onChange={(every) => setR((x) => ({ ...x, every }))} label="how often" />
          <SelectMenu
            look="box"
            ariaLabel="Days, weeks, months or years"
            value={r.unit}
            onChange={(unit) => setR((x) => ({ ...x, unit }))}
            options={REPEAT_UNITS.map(([value, one, many]) => ({ value, label: n === 1 ? one : many }))}
          />
        </div>

        {r.unit === 'week' && (
          <div className="cr-block">
            <span className="cr-label">Repeat on</span>
            <div className="cr-days" role="group" aria-label="Days of the week">
              {LETTERS.map((l, d) => (
                <button
                  key={d}
                  type="button"
                  className={`cr-day${r.days.includes(d) ? ' on' : ''}`}
                  onClick={() => toggle(d)}
                  aria-pressed={r.days.includes(d)}
                  aria-label={DAY_NAMES[d]}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="cr-block">
          <span className="cr-label">Ends</span>
          <div className="cr-ends" role="radiogroup">
            <label className={`cr-end${r.ends === 'never' ? ' on' : ''}`}>
              <input type="radio" name="cr-ends" checked={r.ends === 'never'} onChange={() => setR((x) => ({ ...x, ends: 'never' }))} />
              <span>Never</span>
            </label>
            <label className={`cr-end${r.ends === 'on' ? ' on' : ''}`}>
              <input type="radio" name="cr-ends" checked={r.ends === 'on'} onChange={() => setR((x) => ({ ...x, ends: 'on' }))} />
              <span>On</span>
              <span className={`cr-end-field${r.ends === 'on' ? '' : ' off'}`} onClick={() => setR((x) => ({ ...x, ends: 'on' }))}>
                <DateMenu value={r.until} min={startDate} onChange={(until) => setR((x) => ({ ...x, until, ends: 'on' }))} ariaLabel="Ends on" className="cr-box">
                  <span>{shortDate(r.until)}</span>
                </DateMenu>
              </span>
            </label>
            <label className={`cr-end${r.ends === 'after' ? ' on' : ''}`}>
              <input type="radio" name="cr-ends" checked={r.ends === 'after'} onChange={() => setR((x) => ({ ...x, ends: 'after' }))} />
              <span>After</span>
              <span className={`cr-end-field${r.ends === 'after' ? '' : ' off'}`} onClick={() => setR((x) => ({ ...x, ends: 'after' }))}>
                <Stepper value={r.count} onChange={(count) => setR((x) => ({ ...x, count, ends: 'after' }))} max={999} label="times" />
                <span className="cr-times">{Number(r.count) === 1 ? 'occurrence' : 'occurrences'}</span>
              </span>
            </label>
          </div>
        </div>

        <div className="ev-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={done}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
