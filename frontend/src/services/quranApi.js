// Quran text, translation and audio from the public Quran.com API (Quran
// Foundation). Called straight from the browser: it allows any origin and
// responses are HTTP-cached for about a week, so no backend involvement.
const BASE = 'https://api.quran.com/api/v4';

export const TRANSLATION_ID = 39; // Abdullah Muhammad Basmeih (Malay)
export const RECITATION_ID = 7; // Mishary Rashid al-Afasy
export const VERSES_PER_PAGE = 50;

const cache = new Map();

async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(`${BASE}${path}`).then((res) => {
    if (!res.ok) throw new Error(`Quran API ${res.status}`);
    return res.json();
  });
  cache.set(path, promise);
  promise.catch(() => cache.delete(path)); // let a failed request be retried
  return promise;
}

export async function fetchChapters() {
  return (await get('/chapters?language=ms')).chapters;
}

export async function fetchChapter(id) {
  return (await get(`/chapters/${id}?language=ms`)).chapter;
}

// One page of verses (1-based) with Uthmani text and the Malay translation.
export async function fetchVerses(chapterId, page = 1) {
  const data = await get(
    `/verses/by_chapter/${chapterId}?language=ms&translations=${TRANSLATION_ID}&fields=text_uthmani` +
      `&per_page=${VERSES_PER_PAGE}&page=${page}`
  );
  return {
    verses: data.verses.map((v) => ({
      n: v.verse_number,
      key: v.verse_key,
      ar: v.text_uthmani,
      // Strip any footnote markup so translations render as plain text.
      ms: (v.translations?.[0]?.text || '').replace(/<[^>]+>/g, ''),
      page: v.page_number,
      juz: v.juz_number
    })),
    nextPage: data.pagination.next_page
  };
}

export async function fetchChapterAudio(chapterId) {
  return (await get(`/chapter_recitations/${RECITATION_ID}/${chapterId}`)).audio_file?.audio_url || null;
}

// Last-read position, saved on this device only.
const LAST_READ_KEY = 'quran_last_read';

export function readLastRead() {
  try {
    return JSON.parse(localStorage.getItem(LAST_READ_KEY));
  } catch {
    return null;
  }
}

export function saveLastRead(position) {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify({ ...position, at: Date.now() }));
  } catch {
    // Ignore: storage unavailable.
  }
}
