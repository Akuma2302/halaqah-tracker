import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Check, Minus, Plus, RotateCcw, Sun, Sunset } from 'lucide-react';
import client from '../services/apiClient';
import { MATHURAT_SECTIONS } from '../features/mathurat/mathuratData';

const PREFS_KEY = 'mathurat_prefs';
const DEFAULT_PREFS = { arabic: true, rumi: true, meaning: false, size: 26 };
const MIN_SIZE = 20;
const MAX_SIZE = 40;

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
    // Private mode etc. — preferences just won't persist.
  }
}

// Pagi is read after Subuh, petang after Asar; default by time of day.
function defaultWaktu() {
  return dayjs().hour() < 15 ? 'pagi' : 'petang';
}

function textFor(section, waktu) {
  const override = waktu === 'petang' ? section.petang : null;
  return {
    ar: override?.ar ?? section.ar,
    rumi: override?.rumi ?? section.rumi,
    ms: override?.ms ?? section.ms
  };
}

// Arabic-Indic digits for the ayah markers.
function arabicNumber(n) {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
}

export default function Mathurat() {
  const [params, setParams] = useSearchParams();
  const waktu = params.get('w') === 'petang' || params.get('w') === 'pagi' ? params.get('w') : defaultWaktu();
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...readJson(PREFS_KEY, {}) }));

  // Counts per section id, kept for today so leaving the page doesn't lose the place.
  const today = dayjs().format('YYYY-MM-DD');
  const progressKey = `mathurat_progress_${today}_${waktu}`;
  // Stored with its key so switching pagi/petang never writes one session's
  // counts under the other's key.
  const [progress, setProgress] = useState(() => ({ key: progressKey, counts: readJson(progressKey, {}) }));
  const counts = progress.key === progressKey ? progress.counts : readJson(progressKey, {});
  function setCounts(update) {
    setProgress((p) => {
      const base = p.key === progressKey ? p.counts : readJson(progressKey, {});
      const next = typeof update === 'function' ? update(base) : update;
      writeJson(progressKey, next);
      return { key: progressKey, counts: next };
    });
  }
  useEffect(() => writeJson(PREFS_KEY, prefs), [prefs]);

  const mutabaahKey = waktu === 'pagi' ? 'mathuratPagi' : 'mathuratPetang';
  const [marked, setMarked] = useState(null); // null = unknown
  const [marking, setMarking] = useState(false);
  useEffect(() => {
    setMarked(null);
    client
      .get(`/mutabaah/${today}`)
      .then((res) => setMarked(!!res.data[mutabaahKey]))
      .catch(() => setMarked(null));
  }, [today, mutabaahKey]);

  const sectionRefs = useRef({});
  const doneCount = MATHURAT_SECTIONS.filter((s) => (counts[s.id] || 0) >= s.repeat).length;
  const total = MATHURAT_SECTIONS.length;
  const allDone = doneCount === total;

  function setWaktu(next) {
    setParams(next === defaultWaktu() ? {} : { w: next }, { replace: true });
  }

  function togglePref(key) {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      // Keep at least one of the three text layers visible.
      return next.arabic || next.rumi || next.meaning ? next : p;
    });
  }

  function count(section) {
    const current = counts[section.id] || 0;
    if (current >= section.repeat) return;
    const next = current + 1;
    setCounts((c) => ({ ...c, [section.id]: next }));
    if (next >= section.repeat) {
      const following = MATHURAT_SECTIONS.find((s) => s.id > section.id && (counts[s.id] || 0) < s.repeat);
      if (following) {
        setTimeout(() => sectionRefs.current[following.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
      }
    }
  }

  function resetSection(section) {
    setCounts((c) => {
      const next = { ...c };
      delete next[section.id];
      return next;
    });
  }

  function resetAll() {
    if (window.confirm(`Start Mathurat ${waktu === 'pagi' ? 'Pagi' : 'Petang'} again from the beginning?`)) {
      setCounts({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function markMutabaah() {
    setMarking(true);
    try {
      const res = await client.put(`/mutabaah/${today}`, { [mutabaahKey]: true });
      setMarked(!!res.data[mutabaahKey]);
    } catch {
      window.alert("Couldn't update your mutabaah. Please try again.");
    } finally {
      setMarking(false);
    }
  }

  const label = waktu === 'pagi' ? 'Pagi' : 'Petang';
  const arabicStyle = useMemo(() => ({ fontSize: prefs.size }), [prefs.size]);

  return (
    <div className="page mathurat">
      <div className="page-header">
        <div>
          <h1 className="page-title">Al-Mathurat</h1>
          <p className="page-subtitle">Sughra (ringkas) · 30 bacaan</p>
        </div>
      </div>

      <div className="mathurat-toolbar">
        <div className="range-toggle segmented mathurat-waktu">
          <button className={waktu === 'pagi' ? 'active' : ''} onClick={() => setWaktu('pagi')}>
            <Sun size={14} /> Pagi
          </button>
          <button className={waktu === 'petang' ? 'active' : ''} onClick={() => setWaktu('petang')}>
            <Sunset size={14} /> Petang
          </button>
        </div>

        <div className="mathurat-options">
          {[
            ['arabic', 'Arabic'],
            ['rumi', 'Rumi'],
            ['meaning', 'Meaning']
          ].map(([key, text]) => (
            <button
              key={key}
              type="button"
              className={`chip${prefs[key] ? ' on' : ''}`}
              aria-pressed={prefs[key]}
              onClick={() => togglePref(key)}
            >
              {text}
            </button>
          ))}
          <span className="mathurat-size" aria-label="Arabic text size">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPrefs((p) => ({ ...p, size: Math.max(MIN_SIZE, p.size - 2) }))}
              disabled={prefs.size <= MIN_SIZE}
              aria-label="Smaller Arabic text"
            >
              <Minus size={14} />
            </button>
            <span className="mathurat-size-label">أ</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setPrefs((p) => ({ ...p, size: Math.min(MAX_SIZE, p.size + 2) }))}
              disabled={prefs.size >= MAX_SIZE}
              aria-label="Larger Arabic text"
            >
              <Plus size={14} />
            </button>
          </span>
        </div>
      </div>

      <div className="mathurat-progress" role="status">
        <div className="mathurat-progress-head">
          <span>
            <strong>{doneCount}</strong> / {total} done
          </span>
          {doneCount > 0 && (
            <button type="button" className="mathurat-reset" onClick={resetAll}>
              <RotateCcw size={12} /> Restart
            </button>
          )}
        </div>
        <span className="hours-bar">
          <span className="hours-bar-fill" style={{ width: `${(doneCount / total) * 100}%` }} />
        </span>
      </div>

      <div className="mathurat-list">
        {MATHURAT_SECTIONS.map((s) => {
          const n = counts[s.id] || 0;
          const done = n >= s.repeat;
          const text = textFor(s, waktu);
          return (
            <section
              key={s.id}
              ref={(el) => (sectionRefs.current[s.id] = el)}
              className={`mathurat-card${done ? ' done' : ''}`}
            >
              <header className="mathurat-card-head">
                <span className="mathurat-num">{s.id}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mathurat-title">{s.title}</div>
                  {s.ref && <div className="mathurat-ref">{s.ref}</div>}
                </div>
                {s.repeat > 1 && <span className="mathurat-repeat">{s.repeat}×</span>}
                {done && (
                  <button type="button" className="mathurat-undo" onClick={() => resetSection(s)} aria-label="Read again">
                    <RotateCcw size={13} />
                  </button>
                )}
              </header>

              {!done && (
                <>
                  {prefs.arabic && (
                    <p className="mathurat-arabic" dir="rtl" lang="ar" style={arabicStyle}>
                      {s.kind === 'quran'
                        ? s.ayat.map((a) => (
                            <span key={a.n}>
                              {a.ar} <span className="ayah-mark">﴿{arabicNumber(a.n)}﴾</span>{' '}
                            </span>
                          ))
                        : text.ar}
                    </p>
                  )}
                  {prefs.rumi && <p className="mathurat-rumi">{text.rumi}</p>}
                  {prefs.meaning && (
                    <p className="mathurat-meaning">
                      {s.kind === 'quran'
                        ? s.ayat.map((a) => (
                            <span key={a.n}>
                              {a.ms} <span className="mathurat-ayah-n">({a.n})</span>{' '}
                            </span>
                          ))
                        : text.ms}
                    </p>
                  )}

                  <button type="button" className="mathurat-count" onClick={() => count(s)}>
                    {s.repeat === 1 ? (
                      <>
                        <Check size={16} /> Done
                      </>
                    ) : (
                      <>
                        <span className="mathurat-dots" aria-hidden="true">
                          {Array.from({ length: s.repeat }).map((_, i) => (
                            <span key={i} className={i < n ? 'on' : ''} />
                          ))}
                        </span>
                        Count {n + 1 > s.repeat ? s.repeat : n + 1}/{s.repeat}
                      </>
                    )}
                  </button>
                </>
              )}
            </section>
          );
        })}
      </div>

      <div className={`card mathurat-finish${allDone ? ' complete' : ''}`}>
        <div className="mathurat-finish-title">
          {allDone ? `Alhamdulillah, Mathurat ${label} complete` : `Finished Mathurat ${label}?`}
        </div>
        {marked ? (
          <p className="reminder-ok" style={{ marginTop: 6 }}>
            <Check size={13} style={{ verticalAlign: -2 }} /> Mathurat {label} is ticked in today's mutabaah.
          </p>
        ) : (
          <>
            <p className="setup-text" style={{ margin: '4px 0 12px' }}>
              Tick it in today's mutabaah{allDone ? '' : ', even if you read from your own book'}.
            </p>
            <button className="btn btn-primary btn-block" onClick={markMutabaah} disabled={marking}>
              {marking ? 'Saving…' : `Mark Mathurat ${label} done`}
            </button>
          </>
        )}
      </div>

      <p className="mathurat-source">
        Quran text and meaning: Tanzil (Uthmani) and Tafsir Pimpinan ar-Rahman (Abdullah Basmeih). Order and repeat
        counts follow the Al-Mathurat Sughra guide on akuislam.com.
      </p>
    </div>
  );
}
