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

// A list of times every 15 minutes. With `from` (the start time), it is an end
// time: only later times, each with how long that makes it.
export function TimeMenu({ value, onChange, from, ariaLabel }) {
  const pop = usePop(260);
  const list = useRef(null);
  const startAt = from ? toMin(from) + 15 : 0;
  const times = [];
  for (let m = startAt; m < 24 * 60; m += 15) times.push(toTime(m));
  if (value && !times.includes(value) && (!from || toMin(value) > toMin(from))) {
    times.push(value);
    times.sort();
  }

  // Open with the chosen time in the middle of the list.
  useLayoutEffect(() => {
    if (pop.open) list.current?.querySelector('.on')?.scrollIntoView({ block: 'center' });
  }, [pop.open]);

  return (
    <div className="pk pk-time" ref={pop.box}>
      <button type="button" className="pk-button gc-time-button" onClick={pop.toggle} aria-haspopup="listbox" aria-expanded={pop.open} aria-label={ariaLabel}>
        {value ? clock(value) : '--:--'}
      </button>
      {pop.open && (
        <div className={`tm-menu pk-panel pk-times${pop.up ? ' up' : ''}`} role="listbox" aria-label={ariaLabel} ref={list}>
          {times.map((t) => (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={t === value}
              className={`pk-t${t === value ? ' on' : ''}`}
              onClick={() => {
                pop.close();
                onChange(t);
              }}
            >
              {clock(t)}
              {from && <small>{length(toMin(t) - toMin(from))}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
