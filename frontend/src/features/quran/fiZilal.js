// In-app Tafsir Fi Zilalil Quran (Malay): the scanned book, cut into column
// strips by scripts/fizilal and published as static files. index.json lists,
// per surah, each strip's size and where each "(Pentafsiran ayat ...)" section
// starts. Surahs missing from it fall back to the PDF link (tafsirLinks.js).
const BASE = (import.meta.env.VITE_FIZILAL_BASE || '/tafsir/fizilal').replace(/\/$/, '');

let indexPromise = null;

// { [surah]: { strips: [[w, h], ...], sections: [[from, to, strip, yFraction], ...] } }
export function loadFiZilalIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`Fi Zilal index ${res.status}`);
        return res.json();
      })
      .catch((err) => {
        indexPromise = null; // let a failed load be retried
        throw err;
      });
  }
  return indexPromise;
}

export function fiZilalStripUrl(surah, strip) {
  return `${BASE}/${surah}/${strip}.webp`;
}

// The section explaining an ayat: the one whose range holds it, else the last
// one starting before it. Null when the surah has no section headings.
export function fiZilalSection(entry, ayat) {
  const sections = (entry?.sections || []).map(([from, to, strip, y]) => ({ from, to, strip, y }));
  return (
    sections.find((s) => ayat >= s.from && ayat <= s.to) ||
    [...sections].reverse().find((s) => s.from <= ayat) ||
    null
  );
}
