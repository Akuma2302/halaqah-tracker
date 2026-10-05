import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fiZilalSection, fiZilalStripUrl, loadFiZilalIndex } from '../features/quran/fiZilal';
import { fiZilalLink } from '../features/quran/tafsirLinks';

// Tafsir Fi Zilalil Quran for one ayat: the book's own pages (as column
// strips), opened at the section that explains the ayat. Surahs that haven't
// been prepared yet show a link to the surah's PDF instead.
export default function FiZilalReader({ surah, ayat, surahName }) {
  const [index, setIndex] = useState(undefined); // undefined = loading, null = failed
  const target = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadFiZilalIndex()
      .then((data) => !cancelled && setIndex(data))
      .catch(() => !cancelled && setIndex(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const entry = index?.[surah];
  const section = entry ? fiZilalSection(entry, ayat) : null;

  // Open at the section heading. Strip heights are reserved up front (aspect
  // ratio), so the position is right before the images have loaded.
  useEffect(() => {
    const el = target.current;
    const scroller = el?.closest('.sheet');
    if (!el || !scroller) return;
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    scroller.scrollTo({ top: Math.max(0, top - 56) });
  }, [entry, section?.strip, section?.y]);

  if (index === undefined) return <div className="spinner" style={{ margin: '18px auto', display: 'block' }} />;

  if (!entry) {
    const pdf = fiZilalLink(surah);
    return (
      <>
        <p className="log-empty">
          {index === null
            ? "Couldn't load Fi Zilal. Check your connection and try again."
            : `Fi Zilal for ${surahName} isn't in the app yet. You can read the scanned book for this surah:`}
        </p>
        {pdf && (
          <a className="tafsir-link" href={pdf.url} target="_blank" rel="noopener noreferrer">
            <div>
              <div className="tafsir-link-title">Tafsir Fi Zilalil Quran</div>
              <div className="tafsir-link-meta">
                Bahasa Melayu · whole surah {surahName} · PDF {pdf.sizeMb} MB
              </div>
              {pdf.sizeMb >= 5 && <div className="tafsir-link-warn">Large file. Best opened on Wi-Fi.</div>}
            </div>
            <ExternalLink size={16} />
          </a>
        )}
      </>
    );
  }

  return (
    <>
      <p className="tafsir-covers">
        {section
          ? section.from === section.to
            ? `Opened at the commentary on ayat ${section.from}.`
            : `Opened at the commentary on ayat ${section.from}–${section.to}.`
          : 'This surah is explained as a whole. Opened at the start.'}
      </p>
      <div className="fizilal-pages">
        {entry.strips.map(([w, h], i) => (
          <div key={i} className="fizilal-strip" style={{ aspectRatio: `${w} / ${h}` }}>
            {section?.strip === i && <span ref={target} className="fizilal-mark" style={{ top: `${section.y * 100}%` }} />}
            <img src={fiZilalStripUrl(surah, i)} alt="" width={w} height={h} loading="lazy" decoding="async" />
          </div>
        ))}
      </div>
      <p className="tafsir-note">
        Tafsir Fi Zilalil Quran, Sayyid Qutb, terjemahan Yusuf Zaky. Scanned pages of the printed book.
      </p>
    </>
  );
}
