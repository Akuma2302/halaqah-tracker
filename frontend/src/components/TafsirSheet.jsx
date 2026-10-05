import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Sheet from './Sheet';
import { fetchTafsir } from '../services/quranApi';
import { fiZilalLink } from '../features/quran/tafsirLinks';

// The tafsir HTML is headings, paragraphs and Arabic snippets. Rebuild it as
// React elements from a short whitelist instead of injecting the HTML.
const TAGS = { h1: 'h3', h2: 'h4', h3: 'h4', p: 'p', strong: 'strong', b: 'strong', em: 'em', i: 'em' };

function toElements(node, keyPrefix = 'n') {
  return [...node.childNodes].map((child, i) => {
    const key = `${keyPrefix}-${i}`;
    if (child.nodeType === Node.TEXT_NODE) return child.textContent;
    if (child.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = child.tagName.toLowerCase();
    const kids = toElements(child, key);
    if (tag === 'br') return <br key={key} />;
    // Quoted Arabic comes as <div class="arabic"> or as a plain all-Arabic paragraph.
    const text = child.textContent.trim();
    const arabicLetters = (text.match(/[؀-ۿﭐ-﷿ﹰ-﻿]/g) || []).length;
    const isArabic = (tag === 'div' || tag === 'p') && text && arabicLetters / text.replace(/\s/g, '').length > 0.6;
    if (isArabic || (tag === 'div' && child.classList.contains('arabic'))) {
      return (
        <p key={key} className="tafsir-arabic" lang="ar" dir="rtl">
          {kids}
        </p>
      );
    }
    const Tag = TAGS[tag];
    return Tag ? <Tag key={key}>{kids}</Tag> : <span key={key}>{kids}</span>;
  });
}

function coversLabel(keys) {
  if (keys.length < 2) return '';
  const [surah, first] = keys[0].split(':');
  return `This passage explains ayat ${surah}:${first}–${keys[keys.length - 1].split(':')[1]} together.`;
}

// Tafsir of one ayat ("2:255"): Ibn Kathir (abridged, English) read in the
// app via the Quran.com API, plus a link to that surah's Fi Zilal PDF (Malay).
export default function TafsirSheet({ verseKey, chaptersById = {}, onClose }) {
  const [state, setState] = useState({ key: null, tafsir: null, error: false });

  useEffect(() => {
    if (!verseKey) return;
    let cancelled = false;
    setState({ key: verseKey, tafsir: null, error: false });
    fetchTafsir(verseKey)
      .then((tafsir) => !cancelled && setState({ key: verseKey, tafsir, error: false }))
      .catch(() => !cancelled && setState({ key: verseKey, tafsir: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  const [surah, ayat] = (verseKey || '').split(':').map(Number);
  const zilal = verseKey ? fiZilalLink(surah) : null;
  const name = chaptersById[surah]?.name_simple || `Surah ${surah}`;
  const tafsir = state.key === verseKey ? state.tafsir : null;
  const body = tafsir ? new DOMParser().parseFromString(tafsir.html, 'text/html').body : null;
  const empty = body && !body.textContent.trim();

  return (
    <Sheet open={!!verseKey} onClose={onClose} title={verseKey ? `Tafsir · ${name} ${surah}:${ayat}` : 'Tafsir'}>
      {verseKey && (
        <>
          {state.error ? (
            <p className="log-empty">Couldn't load the tafsir. Check your connection and try again.</p>
          ) : !tafsir ? (
            <div className="spinner" style={{ margin: '18px auto', display: 'block' }} />
          ) : empty ? (
            <p className="log-empty">Ibn Kathir has no separate commentary for this ayat.</p>
          ) : (
            <>
              {coversLabel(tafsir.keys) && <p className="tafsir-covers">{coversLabel(tafsir.keys)}</p>}
              <div className="tafsir-text">{toElements(body)}</div>
            </>
          )}

          <div className="tafsir-foot">
            <p className="tafsir-note">Tafsir Ibn Kathir (Abridged), English, from the Quran.com API (Quran Foundation).</p>
            {zilal && (
              <a className="tafsir-link" href={zilal.url} target="_blank" rel="noopener noreferrer">
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
          </div>
        </>
      )}
    </Sheet>
  );
}
