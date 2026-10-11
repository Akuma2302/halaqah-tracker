import { useEffect, useState } from 'react';
import client, { getToken } from '../../services/apiClient';

// Ayat saved for tadabbur (reflection), each with an optional note of what
// the reader understands from it. They live in the account
// (/api/quran/tadabbur); one copy is kept here for every screen that shows them.
// { key: '2:255', label, arabic, translation, note, createdAt, updatedAt }
const CHANGED = 'quran-tadabbur-changed';
let list = [];
let loadedFor = null; // token the list was loaded with
let loading = null;

function set(next) {
  list = next;
  window.dispatchEvent(new Event(CHANGED));
}

export function loadTadabbur() {
  const token = getToken();
  if (!token || loadedFor === token) return Promise.resolve();
  if (loading) return loading;
  loading = client
    .get('/quran/tadabbur')
    .then((res) => {
      set(Array.isArray(res.data) ? res.data : []);
      loadedFor = token;
    })
    .catch(() => {}) // offline: tried again the next time a screen asks
    .finally(() => {
      loading = null;
    });
  return loading;
}

// Saves an ayat with its note, or replaces the note of one already saved.
export async function saveTadabbur({ key, label, arabic, translation, note }) {
  const res = await client.post('/quran/tadabbur', { key, label, arabic, translation: translation || '', note: note.trim() });
  set([res.data, ...list.filter((t) => t.key !== key)]);
  return res.data;
}

export async function removeTadabbur(key) {
  await client.delete('/quran/tadabbur', { params: { key } });
  set(list.filter((t) => t.key !== key));
}

// Live list, newest first; re-renders when one is saved or removed anywhere.
export function useTadabbur() {
  const [value, setValue] = useState(list);
  useEffect(() => {
    const refresh = () => setValue(list);
    window.addEventListener(CHANGED, refresh);
    refresh();
    loadTadabbur();
    return () => window.removeEventListener(CHANGED, refresh);
  }, []);
  return value;
}
