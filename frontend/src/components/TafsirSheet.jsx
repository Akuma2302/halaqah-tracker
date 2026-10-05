import { ExternalLink } from 'lucide-react';
import Sheet from './Sheet';
import { fiZilalLink, ibnKathirUrl } from '../features/quran/tafsirLinks';

// Where to read the tafsir of one ayat ("2:255"). Links out to the source
// sites: Ibn Kathir opens at that ayat, Fi Zilal at that surah's PDF.
export default function TafsirSheet({ verseKey, chaptersById = {}, onClose }) {
  const [surah, ayat] = (verseKey || '').split(':').map(Number);
  const zilal = verseKey ? fiZilalLink(surah) : null;
  const name = chaptersById[surah]?.name_simple || `Surah ${surah}`;

  return (
    <Sheet open={!!verseKey} onClose={onClose} title={verseKey ? `Tafsir · ${name} ${surah}:${ayat}` : 'Tafsir'}>
      {verseKey && (
        <div className="tafsir-links">
          <a className="tafsir-link" href={ibnKathirUrl(surah, ayat)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            <div>
              <div className="tafsir-link-title">Tafsir Ibn Kathir</div>
              <div className="tafsir-link-meta">English · opens at ayat {ayat} · alim.org</div>
            </div>
            <ExternalLink size={16} />
          </a>
          {zilal && (
            <a className="tafsir-link" href={zilal.url} target="_blank" rel="noopener noreferrer" onClick={onClose}>
              <div>
                <div className="tafsir-link-title">Tafsir Fi Zilalil Quran</div>
                <div className="tafsir-link-meta">
                  Bahasa Melayu · whole surah {name} · PDF {zilal.sizeMb} MB
                </div>
                {zilal.sizeMb >= 5 && <div className="tafsir-link-warn">Large file. Best opened on Wi-Fi.</div>}
              </div>
              <ExternalLink size={16} />
            </a>
          )}
          <p className="tafsir-note">
            These open the source websites in a new tab. Fi Zilal is a scanned book, so it opens at the start of the surah.
          </p>
        </div>
      )}
    </Sheet>
  );
}
