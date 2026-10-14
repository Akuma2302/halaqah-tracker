import { Children, isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

// Pickers drawn in the app's own colours, instead of the browser's: a menu,
// a calendar and hour / minute / am-pm columns. Each opens a panel that
// floats over the page under its button (above it when there isn't room
// below), so no card or sheet can cut it off.
//
// `Select`, `DateInput` and `TimeInput` stand in for <select>,
// <input type="date"> and <input type="time">: same props, and onChange
// gets an event-like { target: { value } }.

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const clock = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'am' : 'pm'}`;
};
const length = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h && m ? `${h} hr ${m} min` : h ? `${h} hr` : `${m} min`;
};
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const event = (value) => ({ target: { value }, currentTarget: { value } });

// Open / close, and where the floating panel goes.
function usePop() {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => !box.current?.contains(e.target) && !panel.current?.contains(e.target) && setOpen(false);
    const esc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation(); // close the picker, not the sheet under it
      setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return { open, box, panel, toggle: () => setOpen((x) => !x), close: () => setOpen(false) };
}

// The panel itself: placed by the button, kept on screen, and moved along
// when the page scrolls.
function Float({ pop, align = 'start', minWidth, className = '', role, label, children }) {
  const [style, setStyle] = useState({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const place = () => {
      const b = pop.box.current?.getBoundingClientRect();
      const p = pop.panel.current;
      if (!b || !p) return;
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = align === 'end' ? b.right - w : b.left;
      left = Math.max(8, Math.min(left, vw - w - 8));
      const below = vh - b.bottom;
      const top = h + 10 > below && b.top > below ? Math.max(8, b.top - h - 6) : b.bottom + 6;
      setStyle({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [pop, align]);

  return createPortal(
    <div
      ref={pop.panel}
      className={`tm-menu pk-float ${className}`}
      style={{ ...style, minWidth }}
      role={role}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------- menus

// A menu of choices. `look` is 'field' (a full-width row), 'text' (quiet text),
// 'box' (a small filled box) or 'native' (styled by `className`, like the
// select it replaces).
export function SelectMenu({ value, options, onChange, ariaLabel, look = 'field', display, className = '', id, disabled, title }) {
  const pop = usePop();
  const current = options.find((o) => o.value === value);
  const width = pop.box.current?.offsetWidth || 0;
  const list = useRef(null);

  useLayoutEffect(() => {
    if (pop.open) list.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [pop.open]);

  return (
    <div className={`pk pk-${look === 'native' ? 'select' : look}`}>
      <button
        type="button"
        ref={pop.box}
        id={id}
        title={title}
        disabled={disabled}
        className={`pk-button${look === 'native' ? ` ${className} pk-native` : ''}`}
        onClick={pop.toggle}
        aria-haspopup="listbox"
        aria-expanded={pop.open}
        aria-label={ariaLabel}
      >
        <span>{display ?? current?.label ?? ''}</span>
        <ChevronDown size={look === 'text' ? 14 : 15} className={`tm-chev${pop.open ? ' up' : ''}`} />
      </button>
      {pop.open && (
        <Float pop={pop} role="listbox" label={ariaLabel} minWidth={Math.max(look === 'text' ? 250 : 170, width)} className="pk-list">
          <div ref={list}>
            {options.map((o, i) =>
              o.group ? (
                <div key={`g${i}`} className="tm-head">
                  {o.group}
                </div>
              ) : (
                <div key={`${o.value}-${i}`} className={`tm-row${o.value === value ? ' on' : ''}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    disabled={o.disabled}
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
              )
            )}
          </div>
        </Float>
      )}
    </div>
  );
}

// The words inside an <option>, however they were written.
const textOf = (node) =>
  Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement(c) ? textOf(c.props.children) : ''))
    .join('');

// <option> and <optgroup> children as a flat list.
function optionsOf(children) {
  const out = [];
  Children.toArray(children).forEach((c) => {
    if (!isValidElement(c)) return;
    if (c.type === 'option') {
      const label = textOf(c.props.children);
      out.push({ value: String(c.props.value ?? label), label, disabled: !!c.props.disabled });
    } else if (c.type === 'optgroup') {
      out.push({ group: c.props.label });
      out.push(...optionsOf(c.props.children));
    } else if (c.props?.children) out.push(...optionsOf(c.props.children));
  });
  return out;
}

// A drop-in <select>.
export function Select({ value, onChange, children, className = 'input', id, disabled, title, ...rest }) {
  const options = optionsOf(children);
  const v = value === undefined || value === null ? '' : String(value);
  return (
    <SelectMenu
      look="native"
      className={className}
      id={id}
      disabled={disabled}
      title={title}
      ariaLabel={rest['aria-label']}
      value={v}
      options={options}
      display={options.find((o) => o.value === v)?.label ?? options[0]?.label ?? ''}
      onChange={(x) => onChange?.(event(x))}
    />
  );
}

// ---------------------------------------------------------------- dates

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function Calendar({ value, min, max, onPick, onClear }) {
  const [month, setMonth] = useState(() => (value ? dateOf(value) : new Date()));
  const todayKey = keyOf(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + i));
  // Drop a last row that is wholly next month.
  const shown = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const out = (key) => (min && key < min) || (max && key > max);
  const today = out(todayKey) ? null : todayKey;

  return (
    <>
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
          return (
            <button
              key={key}
              type="button"
              disabled={out(key)}
              className={`pk-day${d.getMonth() !== month.getMonth() ? ' out' : ''}${key === todayKey ? ' today' : ''}${key === value ? ' on' : ''}`}
              onClick={() => onPick(key)}
              aria-label={d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              aria-pressed={key === value}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="pk-cal-foot">
        {onClear ? (
          <button type="button" className="gc-link pk-clear" onClick={onClear}>
            Clear
          </button>
        ) : (
          <span />
        )}
        {today && (
          <button type="button" className="gc-link" onClick={() => onPick(today)}>
            Today
          </button>
        )}
      </div>
    </>
  );
}

// A date button with a month calendar. `value`, `min`, `max` are "YYYY-MM-DD";
// the button shows `children` (or the date in words).
export function DateMenu({ value, onChange, min, max, ariaLabel, children, className = 'gc-date', onClear, id, disabled }) {
  const pop = usePop();
  return (
    <div className="pk pk-date">
      <button
        type="button"
        ref={pop.box}
        id={id}
        disabled={disabled}
        className={`pk-button ${className}`}
        onClick={pop.toggle}
        aria-haspopup="dialog"
        aria-expanded={pop.open}
        aria-label={ariaLabel}
      >
        {children}
      </button>
      {pop.open && (
        <Float pop={pop} role="dialog" label={ariaLabel} className="pk-cal">
          <Calendar
            value={value}
            min={min}
            max={max}
            onPick={(key) => {
              pop.close();
              onChange(key);
            }}
            onClear={
              onClear &&
              (() => {
                pop.close();
                onClear();
              })
            }
          />
        </Float>
      )}
    </div>
  );
}

// A drop-in <input type="date">.
export function DateInput({ value, onChange, min, max, className = 'input', id, disabled, required, placeholder = 'Pick a date', ...rest }) {
  const text = value ? dateOf(value).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : placeholder;
  return (
    <DateMenu
      value={value || ''}
      min={min || undefined}
      max={max || undefined}
      id={id}
      disabled={disabled}
      ariaLabel={rest['aria-label']}
      className={`${className} pk-native pk-native-date${value ? '' : ' empty'}`}
      onChange={(key) => onChange?.(event(key))}
      onClear={required || !value ? undefined : () => onChange?.(event(''))}
    >
      <span>{text}</span>
    </DateMenu>
  );
}

// ---------------------------------------------------------------- times

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// A time in three scrolling columns: the hour (1 to 12), the minute (00 to
// 59) and am / pm. Each tap sets the time at once; Done closes it. With
// `from` (the start time) it is an end time and says how long that makes it.
export function TimeMenu({ value, onChange, from, ariaLabel, className = 'gc-time-button', align = 'start', id, disabled, placeholder = '--:--' }) {
  const pop = usePop();
  const [h24, m] = (value || '09:00').split(':').map(Number);
  const hour = h24 % 12 || 12;
  const pm = h24 >= 12;
  const set = (h12, min, isPm) => onChange(toTime(((h12 % 12) + (isPm ? 12 : 0)) * 60 + min));

  // Open with each column's choice in the middle.
  useLayoutEffect(() => {
    if (!pop.open) return;
    pop.panel.current?.querySelectorAll('.pk-col').forEach((col) => {
      const on = col.querySelector('.on');
      if (on) col.scrollTop = on.offsetTop - col.clientHeight / 2 + on.offsetHeight / 2;
    });
  }, [pop.open, pop.panel]);

  const diff = from && value ? toMin(value) - toMin(from) : null;

  return (
    <div className="pk pk-time">
      <button
        type="button"
        ref={pop.box}
        id={id}
        disabled={disabled}
        className={`pk-button ${className}`}
        onClick={pop.toggle}
        aria-haspopup="dialog"
        aria-expanded={pop.open}
        aria-label={ariaLabel}
      >
        <span>{value ? clock(value) : placeholder}</span>
      </button>
      {pop.open && (
        <Float pop={pop} role="dialog" label={ariaLabel} className="pk-clock" align={align}>
          <div className="pk-clock-cols">
            <div className="pk-col" role="listbox" aria-label="Hour">
              {HOURS.map((h) => (
                <button key={h} type="button" role="option" aria-selected={!!value && h === hour} className={`pk-c${value && h === hour ? ' on' : ''}`} onClick={() => set(h, m, pm)}>
                  {h}
                </button>
              ))}
            </div>
            <span className="pk-colon">:</span>
            <div className="pk-col" role="listbox" aria-label="Minute">
              {MINUTES.map((n) => (
                <button key={n} type="button" role="option" aria-selected={!!value && n === m} className={`pk-c${value && n === m ? ' on' : ''}`} onClick={() => set(hour, n, pm)}>
                  {pad(n)}
                </button>
              ))}
            </div>
            <div className="pk-col pk-ampm" role="listbox" aria-label="Morning or afternoon">
              {[
                [false, 'am'],
                [true, 'pm']
              ].map(([isPm, label]) => (
                <button key={label} type="button" role="option" aria-selected={!!value && isPm === pm} className={`pk-c${value && isPm === pm ? ' on' : ''}`} onClick={() => set(hour, m, isPm)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="pk-clock-foot">
            <span className={diff !== null && diff <= 0 ? 'bad' : ''}>
              {!value ? 'Pick a time' : diff === null ? clock(value) : diff > 0 ? `${clock(value)} · ${length(diff)}` : 'Ends before it starts'}
            </span>
            <button type="button" className="gc-link" onClick={pop.close}>
              Done
            </button>
          </div>
        </Float>
      )}
    </div>
  );
}

// A drop-in <input type="time">.
export function TimeInput({ value, onChange, className = 'input', id, disabled, ...rest }) {
  return (
    <TimeMenu
      value={value || ''}
      id={id}
      disabled={disabled}
      ariaLabel={rest['aria-label']}
      className={`${className} pk-native pk-native-time${value ? '' : ' empty'}`}
      onChange={(t) => onChange?.(event(t))}
    />
  );
}
