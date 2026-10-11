import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { INSTITUTIONS } from '../features/pastyear/institutions';

const plain = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// A dropdown of the universities, colleges and matriculation centres in
// Malaysia that narrows as you type. A place that isn't listed (a branch
// campus, say) can still be typed in and kept as it is.
export default function KampusPicker({ id, value, onChange, placeholder = 'Choose or type your kampus' }) {
  const [open, setOpen] = useState(false);
  // Until something is typed the whole list shows, whatever is already chosen.
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  const groups = useMemo(() => {
    const q = typed ? plain(value) : '';
    return INSTITUTIONS.map((g) => ({ group: g.group, names: g.names.filter((name) => name !== 'Other' && (!q || plain(name).includes(q))) })).filter(
      (g) => g.names.length > 0
    );
  }, [value, typed]);
  const options = useMemo(() => groups.flatMap((g) => g.names), [groups]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(name) {
    onChange(name);
    setOpen(false);
    setTyped(false);
    setActive(-1);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : -1));
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  let index = -1;
  return (
    <div className="kampus-picker" ref={boxRef}>
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={160}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
      />
      <button
        type="button"
        className="kampus-picker-toggle"
        onClick={() => {
          setTyped(false);
          setOpen((o) => !o);
        }}
        aria-label={open ? 'Hide the list' : 'Show the list'}
        tabIndex={-1}
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="kampus-picker-list" id={`${id}-list`} role="listbox" ref={listRef}>
          {options.length === 0 ? (
            <p className="kampus-picker-none">Not in the list. Keep what you typed and it will be saved as it is.</p>
          ) : (
            groups.map((g) => (
              <div key={g.group}>
                <div className="kampus-picker-group">{g.group}</div>
                {g.names.map((name) => {
                  index += 1;
                  const i = index;
                  return (
                    <button
                      type="button"
                      key={name}
                      data-index={i}
                      role="option"
                      aria-selected={value === name}
                      className={`kampus-picker-option${i === active ? ' active' : ''}${value === name ? ' chosen' : ''}`}
                      onClick={() => choose(name)}
                    >
                      <span>{name}</span>
                      {value === name && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
