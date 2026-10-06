import { useEffect, useState } from 'react';

// Quran bookmarks, kept on this device (localStorage), newest first.
// { id, kind: 'chapter' | 'juz' | 'page', number, key: '2:255' | null, label, at }
// `id` is the ayat key, so an ayat is bookmarked at most once.
const KEY = 'quran_bookmarks';
const CHANGED = 'quran-bookmarks-changed';
const MAX = 50;

export function readBookmarks() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage unavailable: bookmarks just aren't kept.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function addBookmark({ kind, number, key = null, label }) {
  const id = key || `${kind}/${number}`;
  write([{ id, kind, number, key, label, at: Date.now() }, ...readBookmarks().filter((b) => b.id !== id)]);
}

export function removeBookmark(id) {
  write(readBookmarks().filter((b) => b.id !== id));
}

// Adds the bookmark, or removes it if that ayat is already bookmarked.
export function toggleBookmark(bookmark) {
  const id = bookmark.key || `${bookmark.kind}/${bookmark.number}`;
  if (readBookmarks().some((b) => b.id === id)) removeBookmark(id);
  else addBookmark(bookmark);
}

// Where a bookmark opens: the reader it was made in, at its ayat.
export function bookmarkPath({ kind, number, key }) {
  const base = kind === 'juz' ? `/quran/juz/${number}` : kind === 'page' ? `/quran/page/${number}` : `/quran/${number}`;
  return key ? `${base}#${key}` : base;
}

// Live list of bookmarks; re-renders when one is added or removed anywhere.
export function useBookmarks() {
  const [list, setList] = useState(readBookmarks);
  useEffect(() => {
    const refresh = () => setList(readBookmarks());
    window.addEventListener(CHANGED, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return list;
}
