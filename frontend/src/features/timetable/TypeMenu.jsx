import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { hueFor } from './timetable';

// The task type as a dropdown of our own: the built-in types, then mine
// (each can be taken off), then a way to add a new one.
// `options` are { value, label, mine }.
export default function TypeMenu({ options, value, onPick, onNew, onRemove, canAdd }) {
  const [open, setOpen] = useState(false);
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
    <div key={o.value} className={`tm-row${o.value === value ? ' on' : ''}`}>
      <button type="button" role="option" aria-selected={o.value === value} className="tm-pick" onClick={() => pick(o.value)}>
        <i className="tm-dot" style={{ '--hue': hueFor(o.label) }} />
        <span>{o.label}</span>
        {o.value === value && <Check size={15} className="tm-check" />}
      </button>
      {o.mine && onRemove && (
        <button type="button" className="tm-remove" onClick={() => onRemove(o.label)} aria-label={`Remove ${o.label} from my types`}>
          <X size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="tm" ref={box}>
      <button type="button" className="tm-button" onClick={() => setOpen((x) => !x)} aria-haspopup="listbox" aria-expanded={open} aria-label="Type">
        {current && <i className="tm-dot" style={{ '--hue': hueFor(current.label) }} />}
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
