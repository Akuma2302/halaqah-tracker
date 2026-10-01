import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';

const PREFS_KEY = 'quran_prefs';
const DEFAULT_PREFS = { translation: true, size: 28 };
const MIN_SIZE = 20;
const MAX_SIZE = 44;

// Display preferences shared by all Quran readers, remembered on the device.
export function useQuranPrefs() {
  const [prefs, setPrefs] = useState(() => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY)) };
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore: storage unavailable.
    }
  }, [prefs]);

  return [prefs, setPrefs];
}

export function QuranDisplayControls({ prefs, setPrefs }) {
  return (
    <>
      <button
        type="button"
        className={`chip${prefs.translation ? ' on' : ''}`}
        aria-pressed={prefs.translation}
        onClick={() => setPrefs((p) => ({ ...p, translation: !p.translation }))}
      >
        Terjemahan
      </button>
      <span className="mathurat-size" aria-label="Arabic text size">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setPrefs((p) => ({ ...p, size: Math.max(MIN_SIZE, p.size - 2) }))}
          disabled={prefs.size <= MIN_SIZE}
          aria-label="Smaller Arabic text"
        >
          <Minus size={14} />
        </button>
        <span className="mathurat-size-label">أ</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setPrefs((p) => ({ ...p, size: Math.min(MAX_SIZE, p.size + 2) }))}
          disabled={prefs.size >= MAX_SIZE}
          aria-label="Larger Arabic text"
        >
          <Plus size={14} />
        </button>
      </span>
    </>
  );
}
