import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { ExternalLink } from 'lucide-react';
import { fetchTafsir } from '../services/quranApi';
import { ibnuKatsirLink } from '../features/quran/tafsirLinks';
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

// The tafsirs offered, in tab order.
const TABS = [
  { id: 'zilal', name: 'Fi Zilal', lang: 'Melayu' },
  { id: 'katsir', name: 'Ibnu Katsir', lang: 'Indonesia' },
  { id: 'kathir', name: 'Ibn Kathir', lang: 'English' }
];

function savedTab() {
  try {
    const saved = localStorage.getItem(TAB_KEY);
    return TABS.some((t) => t.id === saved) ? saved : 'zilal';
  } catch {
    return 'zilal';
  }
}

// Tafsir of one ayat ("2:255"). Read in the app: Fi Zilalil Quran (Malay,
// scanned pages) and Ibn Kathir (abridged, English, Quran.com API). The
// Indonesian Tafsir Ibnu Katsir is a link out to its flipbook.
export default function TafsirSheet({ verseKey, chaptersById = {}, onClose }) {
  const [tabId, setTabId] = useState(savedTab);
  const [state, setState] = useState({ key: null, tafsir: null, error: false });

  function chooseTab(next) {
    setTabId(next);
    document.querySelector('.sheet-body')?.scrollTo({ top: 0 }); // each tafsir starts from its own top
    try {
      localStorage.setItem(TAB_KEY, next);
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  const loadKey = `${tabId}/${verseKey}`;
  useEffect(() => {
    if (!verseKey || tabId !== 'kathir') return;
    let cancelled = false;
    setState({ key: loadKey, tafsir: null, error: false });
    fetchTafsir(verseKey)
      .then((tafsir) => !cancelled && setState({ key: loadKey, tafsir, error: false }))
      .catch(() => !cancelled && setState({ key: loadKey, tafsir: null, error: true }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadKey]);

  const [surah, ayat] = (verseKey || '').split(':').map(Number);
  const name = chaptersById[surah]?.name_simple || `Surah ${surah}`;
  const tafsir = state.key === loadKey ? state.tafsir : null;
  const body = tafsir?.html ? new DOMParser().parseFromString(tafsir.html, 'text/html').body : null;
  const empty = tafsir && !body?.textContent.trim();
  const katsir = verseKey ? ibnuKatsirLink(surah) : null;

  return (
    <Sheet
      open={!!verseKey}
      onClose={onClose}
      title={verseKey ? `Tafsir · ${name} ${surah}:${ayat}` : 'Tafsir'}
      header={
        <div className="range-toggle segmented tafsir-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={tabId === t.id ? 'active' : ''} onClick={() => chooseTab(t.id)}>
              <span>{t.name}</span>
              <small>{t.lang}</small>
            </button>
          ))}
        </div>
      }
    >
      {verseKey && (
        <>
          {tabId === 'zilal' ? (
            <FiZilalReader key={verseKey} surah={surah} ayat={ayat} surahName={name} />
          ) : tabId === 'katsir' ? (
            katsir ? (
              <>
                <a className="tafsir-link" href={katsir.url} target="_blank" rel="noopener noreferrer">
                  <div>
                    <div className="tafsir-link-title">Tafsir Ibnu Katsir · Jilid {katsir.volume}</div>
                    <div className="tafsir-link-meta">
                      Bahasa Indonesia · opens where {name} begins (page {katsir.page}) · fliphtml5.com
                    </div>
                  </div>
                  <ExternalLink size={16} />
                </a>
                <p className="tafsir-note">
                  This opens a scanned copy of the printed book (Pustaka Imam Asy-Syafi'i) on another website, at the
                  start of the surah. Flip forward to reach ayat {ayat}.
                </p>
              </>
            ) : (
              <p className="log-empty">There is no Ibnu Katsir link for this surah yet.</p>
            )
          ) : state.error && state.key === loadKey ? (
            <p className="log-empty">Couldn't load the tafsir. Check your connection and try again.</p>
          ) : !tafsir ? (
            <div className="spinner" style={{ margin: '18px auto', display: 'block' }} />
          ) : empty ? (
            <p className="log-empty">Ibn Kathir has no separate commentary for this ayat.</p>
          ) : (
            <>
              {coversLabel(tafsir.keys || []) && <p className="tafsir-covers">{coversLabel(tafsir.keys)}</p>}
              <div className="tafsir-text">{toElements(body)}</div>
              <p className="tafsir-note">Tafsir Ibn Kathir (Abridged), English, from the Quran.com API (Quran Foundation).</p>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
