import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Sheet from './Sheet';
import { removeTadabbur, saveTadabbur } from '../features/quran/tadabbur';

const NOTE_MAX = 1000;

// Save one ayat for tadabbur, with a short note of what you understand from it.
// `ayat` is { key, label, arabic, translation }; `saved` is its entry if it is
// already saved (then the note can be changed, or the ayat removed).
export default function TadabburSheet({ ayat, saved, onClose }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNote(saved?.note || '');
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayat?.key]);

  if (!ayat) return <Sheet open={false} onClose={onClose} title="" />;

  async function run(action, message) {
    setBusy(true);
    setError('');
    try {
      await action();
      onClose();
    } catch {
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={saved ? 'Tadabbur note' : 'Save for tadabbur'}>
      <div className="entry-form tadabbur-form">
        <div className="tadabbur-ayat">
          <span className="tadabbur-ref">{ayat.label}</span>
          <p className="mathurat-arabic tadabbur-arabic" dir="rtl" lang="ar">
            {ayat.arabic}
          </p>
          {ayat.translation && <p className="quran-translation">{ayat.translation}</p>}
        </div>
        <div className="field">
          <label htmlFor="tadabbur-note">What do you understand from this ayat? (optional)</label>
          <textarea
            id="tadabbur-note"
            className="input"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            placeholder="A lesson, a reminder, something to act on…"
          />
          <span className="tadabbur-count">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
        {error && <p className="reminder-warn">{error}</p>}
        <div className="entry-actions">
          {saved && (
            <button
              type="button"
              className="btn btn-ghost tadabbur-remove"
              disabled={busy}
              onClick={() => run(() => removeTadabbur(ayat.key), "Couldn't remove it. Check your connection.")}
            >
              <Trash2 size={14} /> Remove
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => run(() => saveTadabbur({ ...ayat, note }), "Couldn't save it. Check your connection.")}
          >
            {busy ? 'Saving…' : saved ? 'Save note' : 'Save ayat'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
