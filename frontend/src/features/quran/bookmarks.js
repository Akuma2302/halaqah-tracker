import { useEffect, useState } from 'react';
import client, { getToken } from '../../services/apiClient';

// Quran bookmarks, newest first. They live in the user's account
// (/api/quran/bookmarks) and are mirrored on the device (localStorage) so the
// list is instant and still works offline.
// { id, kind: 'chapter' | 'juz' | 'page', number, key: '2:255' | null, label, at, synced }
// `id` is the ayat key, so an ayat is bookmarked at most once. `synced` marks
// a copy the account already has; one without it still needs uploading.
const KEY = 'quran_bookmarks';
const DELETED_KEY = 'quran_bookmarks_deleted'; // removals the server hasn't confirmed yet
const OWNER_KEY = 'quran_bookmarks_owner'; // account the device copy belongs to
const CHANGED = 'quran-bookmarks-changed';
const MAX = 50;

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: nothing is kept on the device.
  }
}

export function readBookmarks() {
  const list = readJson(KEY, []);
  return Array.isArray(list) ? list : [];
}

function write(list) {
  writeJson(KEY, [...list].sort((a, b) => b.at - a.at).slice(0, MAX));
  window.dispatchEvent(new Event(CHANGED));
}

function markSynced(id) {
  write(readBookmarks().map((b) => (b.id === id ? { ...b, synced: true } : b)));
}

const toServer = ({ id, kind, number, key, label, at }) => ({ id, kind, number: Number(number), key: key || null, label, at });

function upload(bookmark) {
  if (!getToken()) return Promise.resolve();
  return client
    .post('/quran/bookmarks', toServer(bookmark))
    .then(() => markSynced(bookmark.id))
    .catch(() => {}); // stays unsynced; the next sync retries it
}

function deleteOnServer(id) {
  if (!getToken()) return Promise.resolve();
  return client
    .delete('/quran/bookmarks', { params: { id } })
    .then(() => writeJson(DELETED_KEY, readJson(DELETED_KEY, []).filter((x) => x !== id)))
    .catch(() => {}); // stays queued; the next sync retries it
}

export function addBookmark({ kind, number, key = null, label }) {
  const id = key || `${kind}/${number}`;
  const bookmark = { id, kind, number, key, label, at: Date.now(), synced: false };
  write([bookmark, ...readBookmarks().filter((b) => b.id !== id)]);
  writeJson(DELETED_KEY, readJson(DELETED_KEY, []).filter((x) => x !== id));
  upload(bookmark);
}

export function removeBookmark(id) {
  write(readBookmarks().filter((b) => b.id !== id));
  writeJson(DELETED_KEY, [...new Set([...readJson(DELETED_KEY, []), id])]);
  deleteOnServer(id);
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

function currentUserId() {
  return readJson('mutabaah_user', null)?._id || null;
}

// Reconcile the device copy with the account:
//  - removals made here are sent first, so they aren't brought back;
//  - the account's list is then the truth for everything already synced
//    (a synced bookmark missing from it was removed on another device);
//  - bookmarks made here but not uploaded yet are uploaded and kept.
let syncedFor = null; // token the last successful sync ran with
let syncing = null;

export function syncBookmarks() {
  const token = getToken();
  if (!token || syncedFor === token) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      // A different account signed in on this device: its copy starts clean.
      const owner = readJson(OWNER_KEY, null);
      const user = currentUserId();
      if (owner && user && owner !== user) {
        write([]);
        writeJson(DELETED_KEY, []);
      }

      await Promise.all(readJson(DELETED_KEY, []).map(deleteOnServer));
      const { data: remote } = await client.get('/quran/bookmarks');

      const stillDeleted = new Set(readJson(DELETED_KEY, []));
      const remoteIds = new Set(remote.map((b) => b.id));
      const unsynced = readBookmarks().filter((b) => !b.synced && !remoteIds.has(b.id));
      write([...remote.filter((b) => !stillDeleted.has(b.id)).map((b) => ({ ...b, synced: true })), ...unsynced]);
      if (user) writeJson(OWNER_KEY, user);
      await Promise.all(unsynced.map(upload));
      syncedFor = token;
    } catch {
      // Offline or server unreachable: keep the device copy and try next time.
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

// Live list of bookmarks; re-renders when one is added or removed anywhere,
// and brings the list up to date with the account when first used.
export function useBookmarks() {
  const [list, setList] = useState(readBookmarks);
  useEffect(() => {
    const refresh = () => setList(readBookmarks());
    window.addEventListener(CHANGED, refresh);
    window.addEventListener('storage', refresh);
    syncBookmarks();
    return () => {
      window.removeEventListener(CHANGED, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return list;
}
