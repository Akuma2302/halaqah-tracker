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

export const TOTAL_PAGES = 604; // standard Madani mushaf
export const TOTAL_JUZ = 30;

const BY = { chapter: 'by_chapter', juz: 'by_juz', page: 'by_page' };

// One batch of verses (1-based `batch`) for a surah, juzuk or mushaf page,
// with Uthmani text and the Malay translation.
export async function fetchVersesBy(kind, number, batch = 1) {
  const data = await get(
    `/verses/${BY[kind]}/${number}?language=ms&translations=${TRANSLATION_ID}&fields=text_uthmani` +
      `&per_page=${VERSES_PER_PAGE}&page=${batch}`
  );
  return {
    verses: data.verses.map((v) => ({
      n: v.verse_number,
      key: v.verse_key,
      surah: Number(v.verse_key.split(':')[0]),
      ar: v.text_uthmani,
      // Strip any footnote markup so translations render as plain text.
      ms: (v.translations?.[0]?.text || '').replace(/<[^>]+>/g, ''),
      page: v.page_number,
      juz: v.juz_number
    })),
    nextPage: data.pagination.next_page
  };
}

// Mushaf ("Membaca") view: every word on a page with its QCF v2 glyph code and
// line number (1-15), for rendering with that page's font (see mushafFont).
export async function fetchPageWords(page) {
  const data = await get(`/verses/by_page/${page}?words=true&word_fields=code_v2,line_number&per_page=50`);
  const verses = data.verses.map((v) => ({
    key: v.verse_key,
    surah: Number(v.verse_key.split(':')[0]),
    n: v.verse_number,
    firstLine: Math.min(...v.words.map((w) => w.line_number)),
    juz: v.juz_number
  }));
  const words = data.verses.flatMap((v) =>
    v.words.map((w) => ({
      id: `${v.verse_key}:${w.position}`,
      key: v.verse_key,
      surah: Number(v.verse_key.split(':')[0]),
      line: w.line_number,
      glyph: w.code_v2,
      end: w.char_type_name === 'end'
    }))
  );
  return { verses, words };
}

// King Fahd Complex QCF v2 fonts: one font per mushaf page, served (CORS-enabled)
// by the Quran Foundation CDN. Loaded once per page and cached by the browser.
const fontLoads = new Map();

export function mushafFontFamily(page) {
  return `qcf-p${page}-v2`;
}

export function loadMushafFont(page) {
  if (!fontLoads.has(page)) {
    const face = new FontFace(
      mushafFontFamily(page),
      `url(https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p${page}.woff2) format('woff2')`,
      { display: 'block' }
    );
    const load = face.load().then((loaded) => {
      document.fonts.add(loaded);
      return loaded;
    });
    load.catch(() => fontLoads.delete(page)); // allow a retry after a failure
    fontLoads.set(page, load);
  }
  return fontLoads.get(page);
}

// Mushaf pages of a juzuk in the Madani 604-page mushaf: juzuk 1 is pages
// 1-21, then every juzuk is 20 pages (juzuk 2 = 22-41 ... juzuk 30 = 582-604).
export function juzPages(n) {
  if (n === 1) return [1, 21];
  const start = 20 * (n - 1) + 2;
  return [start, n === TOTAL_JUZ ? TOTAL_PAGES : start + 19];
}

// Which mushaf page a verse ("2:255") is on.
export async function fetchVersePage(key) {
  return (await get(`/verses/by_key/${key}`)).verse.page_number;
}

export function fetchVerses(chapterId, batch = 1) {
  return fetchVersesBy('chapter', chapterId, batch);
}

// The API lists every juzuk twice; keep one of each, with where it starts.
export async function fetchJuzs() {
  const { juzs } = await get('/juzs');
  const byNumber = new Map();
  for (const j of juzs) {
    if (byNumber.has(j.juz_number)) continue;
    const [firstSurah, range] = Object.entries(j.verse_mapping)[0];
    byNumber.set(j.juz_number, {
      n: j.juz_number,
      start: { surah: Number(firstSurah), ayah: Number(range.split('-')[0]) },
      versesCount: j.verses_count
    });
  }
  return [...byNumber.values()].sort((a, b) => a.n - b.n);
}

export async function fetchChapterAudio(chapterId) {
  return (await get(`/chapter_recitations/${RECITATION_ID}/${chapterId}`)).audio_file?.audio_url || null;
}

// Last-read position, saved on this device only, remembering which view it
// was read in: { kind: 'chapter' | 'juz' | 'page', number, key: '2:255', label }.
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

export function lastReadPath({ kind, number, key }) {
  const base = kind === 'juz' ? `/quran/juz/${number}` : kind === 'page' ? `/quran/page/${number}` : `/quran/${number}`;
  return `${base}#${key}`;
}

// Where a verse key points in the URL hash: "#2:255", or "#255" within a surah.
export function keyFromHash(hash, surah) {
  const raw = decodeURIComponent(hash.replace(/^#/, ''));
  if (/^\d+:\d+$/.test(raw)) return raw;
  if (surah && /^\d+$/.test(raw)) return `${surah}:${raw}`;
  return null;
}
