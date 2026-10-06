import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { addBookmark } from '../features/quran/bookmarks';
import { readLastRead } from '../services/quranApi';

// Reader header button: bookmarks where the reader is now. The readers already
// track that as the "continue reading" position (the ayat at the top of the
// screen, or the mushaf page in view); `fallback` is used until they have one.
export default function BookmarkButton({ kind, number, fallback }) {
  const [saved, setSaved] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function save() {
    const last = readLastRead();
    const here = last && last.kind === kind && Number(last.number) === Number(number) && last.key ? last : fallback;
    if (!here) return;
    addBookmark({ kind, number, key: here.key || null, label: here.label });
    setSaved(here.label);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(''), 2500);
  }

  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm quran-bookmark-btn${saved ? ' on' : ''}`}
      onClick={save}
      title="Bookmark where you are now"
    >
      {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />} {saved ? 'Bookmarked' : 'Bookmark'}
    </button>
  );
}
