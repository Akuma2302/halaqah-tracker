import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { clock } from './timetable';

// Pickers drawn in the app's own colours, instead of the browser's: a menu,
// a calendar and a list of times. Each opens a panel under its button, or
// above it when there isn't room below.

function usePop(need) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = () => {
    if (!open && box.current) {
      const r = box.current.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      setUp(below < need && r.top > below);
    }
    setOpen((x) => !x);
  };
  return { open, up, box, toggle, close: () => setOpen(false) };
}

// A menu of choices. `look` is 'field' (a full-width row), 'text' (a line of
// quiet text) or 'box' (a small filled box).
export function SelectMenu({ value, options, onChange, ariaLabel, look = 'field', display }) {
  const pop = usePop(Math.min(300, options.length * 44 + 16));
  const current = options.find((o) => o.value === value);
  return (
    <div className={`pk pk-${look}`} ref={pop.box}>
      <button type="button" className="pk-button" onClick={pop.toggle} aria-haspopup="listbox" aria-expanded={pop.open} aria-label={ariaLabel}>
        <span>{display ?? current?.label ?? 'Choose'}</span>
        <ChevronDown size={look === 'text' ? 14 : 15} className={`tm-chev${pop.open ? ' up' : ''}`} />
      </button>
      {pop.open && (
        <div className={`tm-menu pk-panel${pop.up ? ' up' : ''}`} role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <div key={o.value} className={`tm-row${o.value === value ? ' on' : ''}`}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className="tm-pick"
                onClick={() => {
                  pop.close();
                  onChange(o.value);
                }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={15} className="tm-check" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A month calendar. `value` and `min` are "YYYY-MM-DD".
export function DateMenu({ value, onChange, min, ariaLabel, children }) {
  const pop = usePop(360);
  const [month, setMonth] = useState(() => (value ? dateOf(value) : new Date()));
  const todayKey = keyOf(new Date());

  // Each time it opens, show the month of the date chosen.
  useEffect(() => {
    if (pop.open && value) setMonth(dateOf(value));
  }, [pop.open]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  // Drop a last row that is wholly next month.
  const shown = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const choose = (key) => {
    pop.close();
    onChange(key);
  };

  return (
    <div className="pk pk-date" ref={pop.box}>
      <button type="button" className="pk-button gc-date" onClick={pop.toggle} aria-haspopup="dialog" aria-expanded={pop.open} aria-label={ariaLabel}>
        {children}
      </button>
      {pop.open && (
        <div className={`tm-menu pk-panel pk-cal${pop.up ? ' up' : ''}`} role="dialog" aria-label={ariaLabel}>
          <div className="pk-cal-head">
            <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
            <button type="button" className="pk-nav" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="pk-nav" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="pk-cal-grid">
            {WEEK.map((w, i) => (
              <span key={i} className="pk-cal-wd">
                {w}
              </span>
            ))}
            {shown.map((d) => {
              const key = keyOf(d);
              const off = min && key < min;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={off}
                  className={`pk-day${d.getMonth() !== month.getMonth() ? ' out' : ''}${key === todayKey ? ' today' : ''}${key === value ? ' on' : ''}`}
                  onClick={() => choose(key)}
                  aria-label={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                  aria-pressed={key === value}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="pk-cal-foot">
            <button type="button" className="gc-link" onClick={() => choose(min && todayKey < min ? min : todayKey)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const length = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h} hr ${m} min` : h ? `${h} hr` : `${m} min`;
};

// A time in three scrolling columns: the hour (1 to 12), the minute (00 to
// 59) and am / pm. Each tap sets the time at once; Done closes it. With
// `from` (the start time) it is an end time and says how long that makes it.
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

export function TimeMenu({ value, onChange, from, ariaLabel }) {
  const pop = usePop(300);
  const panel = useRef(null);
  const [h24, m] = (value || '09:00').split(':').map(Number);
  const hour = h24 % 12 || 12;
  const pm = h24 >= 12;
  const set = (h12, min, isPm) => onChange(toTime(((h12 % 12) + (isPm ? 12 : 0)) * 60 + min));

  // Open with each column's choice in the middle.
  useLayoutEffect(() => {
    if (!pop.open) return;
    panel.current?.querySelectorAll('.pk-col').forEach((col) => {
      const on = col.querySelector('.on');
      if (on) col.scrollTop = on.offsetTop - col.clientHeight / 2 + on.offsetHeight / 2;
    });
  }, [pop.open]);

  const diff = from && value ? toMin(value) - toMin(from) : null;

  return (
    <div className="pk pk-time" ref={pop.box}>
      <button type="button" className="pk-button gc-time-button" onClick={pop.toggle} aria-haspopup="dialog" aria-expanded={pop.open} aria-label={ariaLabel}>
        {value ? clock(value) : '--:--'}
      </button>
      {pop.open && (
        <div className={`tm-menu pk-panel pk-clock${pop.up ? ' up' : ''}`} role="dialog" aria-label={ariaLabel} ref={panel}>
          <div className="pk-clock-cols">
            <div className="pk-col" role="listbox" aria-label="Hour">
              {HOURS.map((h) => (
                <button key={h} type="button" role="option" aria-selected={h === hour} className={`pk-c${h === hour ? ' on' : ''}`} onClick={() => set(h, m, pm)}>
                  {h}
                </button>
              ))}
            </div>
            <span className="pk-colon">:</span>
            <div className="pk-col" role="listbox" aria-label="Minute">
              {MINUTES.map((n) => (
                <button key={n} type="button" role="option" aria-selected={n === m} className={`pk-c${n === m ? ' on' : ''}`} onClick={() => set(hour, n, pm)}>
                  {pad(n)}
                </button>
              ))}
            </div>
            <div className="pk-col pk-ampm" role="listbox" aria-label="Morning or afternoon">
              {[
                [false, 'am'],
                [true, 'pm']
              ].map(([isPm, label]) => (
                <button key={label} type="button" role="option" aria-selected={isPm === pm} className={`pk-c${isPm === pm ? ' on' : ''}`} onClick={() => set(hour, m, isPm)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pk-clock-foot">
            <span className={diff !== null && diff <= 0 ? 'bad' : ''}>
              {diff === null ? clock(value) : diff > 0 ? `${clock(value)} · ${length(diff)}` : 'Ends before it starts'}
            </span>
            <button type="button" className="gc-link" onClick={pop.close}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
