import { useEffect, useRef, useState } from 'react';
import { Bold, FolderInput, Heading2, List, ListChecks, Pin, PinOff, Trash2 } from 'lucide-react';
import Sheet from '../../components/Sheet';

// A note in a subject: a title and text. The text is written with a few
// marks — "## " a heading, "- " a bullet, "- [ ] " / "- [x] " a checklist
// item, **bold** — and shown formatted, with the checklist tickable.

// **bold** within a line, as React pieces.
function inline(text, key) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong> : part
  );
}

// The note shown formatted; tapping a checkbox ticks it in the text.
export function NoteView({ body, onToggle }) {
  const lines = body.split('\n');
  return (
    <div className="nt-view">
      {lines.map((line, i) => {
        const check = line.match(/^(\s*)- \[( |x|X)\] (.*)$/);
        if (check)
          return (
            <label key={i} className={`nt-check${check[2] !== ' ' ? ' done' : ''}`} onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={check[2] !== ' '} onChange={() => onToggle?.(i)} />
              <span>{inline(check[3], i)}</span>
            </label>
          );
        if (line.startsWith('## ')) return <h4 key={i}>{inline(line.slice(3), i)}</h4>;
        if (/^\s*- /.test(line))
          return (
            <p key={i} className="nt-bullet">
              {inline(line.replace(/^\s*- /, ''), i)}
            </p>
          );
        if (!line.trim()) return <div key={i} className="nt-gap" />;
        return <p key={i}>{inline(line, i)}</p>;
      })}
    </div>
  );
}

// The first words of a note, without its marks, for the list.
export function notePreview(body) {
  return body
    .split('\n')
    .map((l) => l.replace(/^##\s+/, '').replace(/^\s*- \[( |x|X)\]\s+/, '').replace(/^\s*-\s+/, '• ').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .join('  ')
    .slice(0, 140);
}

export default function NoteSheet({ note, where, saveState, startEditing, onChange, onClose, onDelete, onMove }) {
  const [editing, setEditing] = useState(startEditing);
  const [askDelete, setAskDelete] = useState(false);
  const area = useRef(null);
  useEffect(() => {
    setEditing(startEditing);
    setAskDelete(false);
  }, [note?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (editing) area.current?.focus();
  }, [editing]);

  if (!note) return <Sheet open={false} onClose={onClose} title="" />;

  // Put marks at the start of each chosen line, or around the chosen words.
  const mark = (kind) => {
    const el = area.current;
    const text = note.body;
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    let next;
    let cursor;
    if (kind === 'bold') {
      const chosen = text.slice(start, end) || 'bold';
      next = `${text.slice(0, start)}**${chosen}**${text.slice(end)}`;
      cursor = [start + 2, start + 2 + chosen.length];
    } else {
      const prefix = { list: '- ', check: '- [ ] ', heading: '## ' }[kind];
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const block = text.slice(lineStart, end);
      const marked = block
        .split('\n')
        .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l.replace(/^(##\s+|-\s\[( |x|X)\]\s+|-\s+)/, '')))
        .join('\n');
      next = text.slice(0, lineStart) + marked + text.slice(end);
      cursor = [lineStart + marked.length, lineStart + marked.length];
    }
    onChange({ body: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor[0], cursor[1]);
    });
  };

  // Enter on a list line carries the list on (and an empty one ends it).
  const keyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = e.currentTarget;
    const text = note.body;
    const pos = el.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const line = text.slice(lineStart, pos);
    const m = line.match(/^(\s*- \[( |x|X)\] |\s*- )/);
    if (!m) return;
    e.preventDefault();
    if (line.trim() === m[1].trim()) {
      const next = text.slice(0, lineStart) + text.slice(pos);
      onChange({ body: next });
      requestAnimationFrame(() => el.setSelectionRange(lineStart, lineStart));
      return;
    }
    const carry = m[1].includes('[') ? '- [ ] ' : '- ';
    const next = `${text.slice(0, pos)}\n${carry}${text.slice(el.selectionEnd)}`;
    onChange({ body: next });
    requestAnimationFrame(() => el.setSelectionRange(pos + 1 + carry.length, pos + 1 + carry.length));
  };

  const toggleLine = (i) => {
    const lines = note.body.split('\n');
    lines[i] = lines[i].replace(/- \[( |x|X)\]/, (m, c) => (c === ' ' ? '- [x]' : '- [ ]'));
    onChange({ body: lines.join('\n') });
  };

  return (
    <Sheet open onClose={onClose} title="Note">
      <div className="nt">
        <div className="nt-tools">
          <input className="nt-title" value={note.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Title" maxLength={120} aria-label="Title" />
          <button type="button" className={`icon-btn${note.pinned ? ' on' : ''}`} onClick={() => onChange({ pinned: !note.pinned })} aria-label={note.pinned ? 'Unpin' : 'Pin to the top'} title={note.pinned ? 'Unpin' : 'Pin to the top'}>
            {note.pinned ? <PinOff size={15} /> : <Pin size={15} />}
          </button>
          {onMove && (
            <button type="button" className="icon-btn" onClick={onMove} aria-label="Move to folder" title="Move to folder">
              <FolderInput size={15} />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={() => setAskDelete(true)} aria-label="Delete note" title="Delete note">
            <Trash2 size={15} />
          </button>
        </div>

        {editing ? (
          <>
            <div className="nt-bar" role="toolbar" aria-label="Formatting">
              <button type="button" onClick={() => mark('bold')} aria-label="Bold" title="Bold">
                <Bold size={15} />
              </button>
              <button type="button" onClick={() => mark('list')} aria-label="Bullet list" title="Bullet list">
                <List size={15} />
              </button>
              <button type="button" onClick={() => mark('check')} aria-label="Checklist" title="Checklist">
                <ListChecks size={15} />
              </button>
              <button type="button" onClick={() => mark('heading')} aria-label="Heading" title="Heading">
                <Heading2 size={15} />
              </button>
              <span className="nt-status">{saveState}</span>
              <button type="button" className="gc-link" onClick={() => setEditing(false)}>
                Done
              </button>
            </div>
            <textarea
              ref={area}
              className="nt-area"
              value={note.body}
              onChange={(e) => onChange({ body: e.target.value })}
              onKeyDown={keyDown}
              placeholder={'Write your note…\n\n- a bullet point\n- [ ] something to do\n## A heading'}
              aria-label="Note"
            />
          </>
        ) : (
          <div className="nt-read" onClick={() => setEditing(true)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setEditing(true)} title="Tap to edit">
            {note.body.trim() ? <NoteView body={note.body} onToggle={toggleLine} /> : <p className="nt-empty">Tap to write…</p>}
          </div>
        )}

        <p className="nt-where">
          {where}
          {!editing && saveState ? ` · ${saveState}` : ''}
        </p>

        {askDelete && (
          <div className="nt-confirm">
            <span>Delete this note? This can't be undone.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAskDelete(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
              Delete
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
