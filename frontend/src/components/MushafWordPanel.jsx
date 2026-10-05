import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpenText, Volume2, X } from 'lucide-react';
import TafsirSheet from './TafsirSheet';
import { fetchPageWordMeanings, fetchVerseTranslation } from '../services/quranApi';

// Panel for a tapped word (meaning, transliteration, pronunciation) or a
// tapped ayah marker (that verse's Malay translation) in Membaca view.
// `selection` is { id: "2:255:3", key: "2:255", page, end } or null.
export default function MushafWordPanel({ selection, chaptersById = {}, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);
  const [tafsirKey, setTafsirKey] = useState(null);

  useEffect(() => {
    if (!selection) return;
    let cancelled = false;
    setDetail(null);
    setError(false);
    const request = selection.end
      ? fetchVerseTranslation(selection.key).then((text) => ({ verse: text }))
      : fetchPageWordMeanings(selection.page).then((words) => words.get(selection.id) || null);
    request
      .then((d) => {
        if (cancelled) return;
        if (d) setDetail(d);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, onClose]);

  if (!selection) return <TafsirSheet verseKey={tafsirKey} chaptersById={chaptersById} onClose={() => setTafsirKey(null)} />;

  const [surah, ayah] = selection.key.split(':');
  const ref = `${chaptersById[surah]?.name_simple || `Surah ${surah}`} ${surah}:${ayah}`;

  function play() {
    if (!detail?.audio) return;
    audioRef.current?.pause();
    audioRef.current = new Audio(detail.audio);
    audioRef.current.play().catch(() => {});
  }

  return createPortal(
    <div className="word-panel" role="dialog" aria-label={selection.end ? `Ayat ${ref}` : 'Word meaning'}>
      <div className="word-panel-head">
        <span className="word-panel-ref">{selection.end ? `Ayat ${ref}` : ref}</span>
        <button
          type="button"
          className="quran-tafsir-btn"
          onClick={() => {
            setTafsirKey(selection.key);
            onClose();
          }}
        >
          <BookOpenText size={13} /> Tafsir
        </button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={15} />
        </button>
      </div>

      {error ? (
        <p className="word-panel-muted">Couldn't load this. Check your connection and tap again.</p>
      ) : !detail ? (
        <div className="spinner" style={{ margin: '10px auto' }} />
      ) : selection.end ? (
        <p className="word-panel-verse">{detail.verse}</p>
      ) : (
        <div className="word-panel-body">
          <div className="word-panel-arabic" lang="ar" dir="rtl">
            {detail.arabic}
          </div>
          <div className="word-panel-info">
            {detail.transliteration && <div className="word-panel-translit">{detail.transliteration}</div>}
            <div className="word-panel-meaning">{detail.meaning}</div>
            {detail.english && detail.english !== detail.meaning && (
              <div className="word-panel-muted">EN: {detail.english}</div>
            )}
          </div>
          {detail.audio && (
            <button type="button" className="icon-btn word-panel-play" onClick={play} aria-label="Play pronunciation">
              <Volume2 size={16} />
            </button>
          )}
        </div>
      )}
      {!selection.end && detail && <p className="word-panel-note">Maksud perkataan: Bahasa Indonesia (Quran.com)</p>}
    </div>,
    document.body
  );
}
