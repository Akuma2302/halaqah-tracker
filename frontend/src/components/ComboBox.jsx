import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

const plain = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// A dropdown that narrows as you type.
// - `groups` ([{ group, names }]) or `options` (a plain list) is what to pick from.
// - By default anything typed is kept, so a name that isn't listed can be used.
// - `strict`: only a listed name can be chosen (for a filter); typing only
//   narrows the list, and an empty box means "all". It then gets a clear button.
// - `align="right"`: the list hangs from the right edge (for a box in a right-hand column).
export default function ComboBox({ id, value, onChange, groups, options, placeholder, strict = false, align = 'left', maxLength = 160, noneText }) {
  const [open, setOpen] = useState(false);
  // What is in the box. When not strict it is the value itself.
  const [text, setText] = useState(value || '');
  // Until something is typed the whole list shows, whatever is already chosen.
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => setText(value || ''), [value]);

  const shownGroups = useMemo(() => {
    const q = typed ? plain(text) : '';
    const all = groups || [{ group: '', names: options || [] }];
    return all
      .map((g) => ({ group: g.group, names: g.names.filter((name) => name !== 'Other' && (!q || plain(name).includes(q))) }))
      .filter((g) => g.names.length > 0);
  }, [groups, options, text, typed]);
  const flat = useMemo(() => shownGroups.flatMap((g) => g.names), [shownGroups]);

  function close() {
    setOpen(false);
    setTyped(false);
    setActive(-1);
    // A filter goes back to what was chosen if nothing new was picked.
    if (strict) setText(value || '');
  }

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => !boxRef.current?.contains(e.target) && close();
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, strict]);

  useEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(name) {
    setText(name);
    onChange(name);
    setOpen(false);
    setTyped(false);
    setActive(-1);
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (flat.length ? (i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length : -1));
    } else if (e.key === 'Enter' && open && (active >= 0 || (strict && flat.length === 1))) {
      e.preventDefault();
      choose(flat[Math.max(active, 0)]);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close();
    }
  }

  const clearable = strict && !!value;
  let index = -1;
  return (
    <div className={`kampus-picker${clearable ? ' clearable' : ''}`} ref={boxRef}>
      <input
        id={id}
        className="input"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setTyped(true);
          setOpen(true);
          setActive(-1);
          if (!strict) onChange(e.target.value);
          // Emptying a filter's box means "all" again.
          else if (!e.target.value && value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {clearable && (
        <button
          type="button"
          className="kampus-picker-clear"
          onClick={() => {
            setText('');
            onChange('');
            close();
          }}
          aria-label="Clear"
        >
          <X size={13} />
        </button>
      )}
      <button
        type="button"
        className="kampus-picker-toggle"
        onClick={() => (open ? close() : (setTyped(false), setOpen(true)))}
        aria-label={open ? 'Hide the list' : 'Show the list'}
        tabIndex={-1}
      >
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className={`kampus-picker-list${align === 'right' ? ' right' : ''}`} id={`${id}-list`} role="listbox" ref={listRef}>
          {flat.length === 0 ? (
            <p className="kampus-picker-none">{noneText || (strict ? 'Nothing in the list matches that.' : 'Not in the list. Keep what you typed and it will be saved as it is.')}</p>
          ) : (
            shownGroups.map((g) => (
              <div key={g.group || 'all'}>
                {g.group && <div className="kampus-picker-group">{g.group}</div>}
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
