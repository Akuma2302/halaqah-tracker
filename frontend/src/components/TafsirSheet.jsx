import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { fetchTafsir } from '../services/quranApi';
import FiZilalReader from './FiZilalReader';

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

const TAB_KEY = 'tafsir_tab';

function savedTab() {
  try {
    return localStorage.getItem(TAB_KEY) === 'kathir' ? 'kathir' : 'zilal';
  } catch {
    return 'zilal';
  }
}

// Tafsir of one ayat ("2:255"), read in the app: Fi Zilalil Quran (Malay,
// scanned pages) or Ibn Kathir (abridged, English, via the Quran.com API).
export default function TafsirSheet({ verseKey, chaptersById = {}, onClose }) {
  const [tab, setTab] = useState(savedTab);
  const [state, setState] = useState({ key: null, tafsir: null, error: false });

  function chooseTab(next) {
    setTab(next);
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  useEffect(() => {
    if (!verseKey || tab !== 'kathir') return;
    let cancelled = false;
    setState({ key: verseKey, tafsir: null, error: false });
    fetchTafsir(verseKey)
      .then((tafsir) => !cancelled && setState({ key: verseKey, tafsir, error: false }))
      .catch(() => !cancelled && setState({ key: verseKey, tafsir: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [verseKey, tab]);

  const [surah, ayat] = (verseKey || '').split(':').map(Number);
  const name = chaptersById[surah]?.name_simple || `Surah ${surah}`;
  const tafsir = state.key === verseKey ? state.tafsir : null;
  const body = tafsir ? new DOMParser().parseFromString(tafsir.html, 'text/html').body : null;
  const empty = body && !body.textContent.trim();

  return (
    <Sheet open={!!verseKey} onClose={onClose} title={verseKey ? `Tafsir · ${name} ${surah}:${ayat}` : 'Tafsir'}>
      {verseKey && (
        <>
          <div className="range-toggle segmented tafsir-tabs">
            <button className={tab === 'zilal' ? 'active' : ''} onClick={() => chooseTab('zilal')}>
              Fi Zilal (BM)
            </button>
            <button className={tab === 'kathir' ? 'active' : ''} onClick={() => chooseTab('kathir')}>
              Ibn Kathir (EN)
            </button>
          </div>

          {tab === 'zilal' ? (
            <FiZilalReader key={verseKey} surah={surah} ayat={ayat} surahName={name} />
          ) : state.error ? (
            <p className="log-empty">Couldn't load the tafsir. Check your connection and try again.</p>
          ) : !tafsir ? (
            <div className="spinner" style={{ margin: '18px auto', display: 'block' }} />
          ) : empty ? (
            <p className="log-empty">Ibn Kathir has no separate commentary for this ayat.</p>
          ) : (
            <>
              {coversLabel(tafsir.keys) && <p className="tafsir-covers">{coversLabel(tafsir.keys)}</p>}
              <div className="tafsir-text">{toElements(body)}</div>
              <p className="tafsir-note">Tafsir Ibn Kathir (Abridged), English, from the Quran.com API (Quran Foundation).</p>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
