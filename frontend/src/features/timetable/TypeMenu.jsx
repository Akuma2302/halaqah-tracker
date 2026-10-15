import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Palette, Plus, X } from 'lucide-react';
import { hueFor } from './timetable';

// Colours to pick for a type, as hues.
export const TYPE_COLORS = [
  [4, 'Tomato'],
  [24, 'Tangerine'],
  [45, 'Banana'],
  [140, 'Sage'],
  [160, 'Basil'],
  [192, 'Peacock'],
  [222, 'Blueberry'],
  [252, 'Lavender'],
  [282, 'Grape'],
  [334, 'Flamingo']
];

// The task type as a dropdown of our own: the built-in types, then mine
// (each can be taken off), then a way to add a new one. Each type can be
// given a colour (`colors`, by value), used for its entries.
// `options` are { value, label, mine }.
export default function TypeMenu({ options, value, onPick, onNew, onRemove, canAdd, colors = {}, onColor }) {
  const [open, setOpen] = useState(false);
  // The type whose colours are showing.
  const [painting, setPainting] = useState(null);
  const hueOf = (o) => colors[o.value] ?? hueFor(o.label);
  const box = useRef(null);
  const current = options.find((o) => o.value === value);
  const builtIn = options.filter((o) => !o.mine);
  const mine = options.filter((o) => o.mine);

  // Close on a tap outside or Escape.
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

  const pick = (v) => {
    setOpen(false);
    onPick(v);
  };

  const row = (o) => (
    <div key={o.value} className="tm-row-wrap">
      <div className={`tm-row${o.value === value ? ' on' : ''}`}>
        <button type="button" role="option" aria-selected={o.value === value} className="tm-pick" onClick={() => pick(o.value)}>
          <i className="tm-dot" style={{ '--hue': hueOf(o) }} />
          <span>{o.label}</span>
          {o.value === value && <Check size={15} className="tm-check" />}
        </button>
        {onColor && (
          <button
            type="button"
            className={`tm-remove tm-paint${painting === o.value ? ' on' : ''}`}
            onClick={() => setPainting((x) => (x === o.value ? null : o.value))}
            aria-label={`Colour for ${o.label}`}
            aria-expanded={painting === o.value}
            title="Colour"
          >
            <Palette size={13} />
          </button>
        )}
        {o.mine && onRemove && (
          <button type="button" className="tm-remove" onClick={() => onRemove(o.label)} aria-label={`Remove ${o.label} from my types`}>
            <X size={13} />
          </button>
        )}
      </div>
      {painting === o.value && (
        <div className="tm-swatches" role="radiogroup" aria-label={`Colour for ${o.label}`}>
          {TYPE_COLORS.map(([hue, name]) => (
            <button
              key={hue}
              type="button"
              role="radio"
              aria-checked={colors[o.value] === hue}
              className={`tm-swatch${colors[o.value] === hue ? ' on' : ''}`}
              style={{ '--hue': hue }}
              onClick={() => onColor(o.value, hue)}
              aria-label={name}
              title={name}
            >
              {colors[o.value] === hue && <Check size={12} strokeWidth={3} />}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={colors[o.value] === undefined}
            className={`tm-swatch auto${colors[o.value] === undefined ? ' on' : ''}`}
            onClick={() => onColor(o.value, null)}
            aria-label="Automatic colour"
            title="Automatic: by subject or name"
          >
            Auto
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="tm" ref={box}>
      <button type="button" className="tm-button" onClick={() => setOpen((x) => !x)} aria-haspopup="listbox" aria-expanded={open} aria-label="Type">
        {current && <i className="tm-dot" style={{ '--hue': hueOf(current) }} />}
        <span>{current ? current.label : 'Choose a type'}</span>
        <ChevronDown size={15} className={`tm-chev${open ? ' up' : ''}`} />
      </button>
      {open && (
        <div className="tm-menu" role="listbox" aria-label="Type">
          {builtIn.map(row)}
          {mine.length > 0 && <div className="tm-head">My types</div>}
          {mine.map(row)}
          {canAdd && (
            <button
              type="button"
              className="tm-new"
              onClick={() => {
                setOpen(false);
                onNew();
              }}
            >
              <Plus size={14} /> New type
            </button>
          )}
        </div>
      )}
    </div>
  );
}
