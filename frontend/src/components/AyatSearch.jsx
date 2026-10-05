import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

// "Go to ayat" box for the Quran readers.
//   ranges: [{ surah, from, to }] — the ayat this reader covers. A surah has
//   one range; a juzuk or mushaf page can have several, which adds a surah picker.
// Going to an ayat sets the #surah:ayat hash (what the readers already open
// at), then scrolls to it and flashes it once it's on screen.
export default function AyatSearch({ ranges, chaptersById = {} }) {
  const navigate = useNavigate();
  const [surah, setSurah] = useState(null);
  const [query, setQuery] = useState('');
  const poll = useRef(null);

  useEffect(() => () => clearInterval(poll.current), []);

  if (!ranges.length) return null;
  const range = ranges.find((r) => r.surah === surah) || ranges[0];
  const n = Number(query);
  const valid = query !== '' && Number.isInteger(n) && n >= range.from && n <= range.to;

  function go(e) {
    e.preventDefault();
    if (!valid) return;
    e.currentTarget.querySelector('input')?.blur();
    const key = `${range.surah}:${n}`;
    navigate({ hash: `#${key}` }, { replace: true });

    // The ayat may still be loading (or the mushaf reopening at its page).
    clearInterval(poll.current);
    let tries = 0;
    poll.current = setInterval(() => {
      const els = [...document.querySelectorAll(`.quran-verses [data-key="${key}"], .mushaf-line [data-key="${key}"]`)];
      if (!els.length && ++tries < 60) return;
      clearInterval(poll.current);
      if (!els.length) return;
      const inList = !!els[0].closest('.quran-verses');
      els[0].scrollIntoView({ block: inList ? 'start' : 'center' });
      const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#c98a3b';
      els.forEach((el) =>
        el.animate([{ backgroundColor: `color-mix(in srgb, ${gold} 45%, transparent)` }, { backgroundColor: 'transparent' }], {
          duration: 2200,
          easing: 'ease-out'
        })
      );
    }, 250);
  }

  return (
    <>
      <form className="ayat-search" onSubmit={go}>
        <Search size={15} />
        {ranges.length > 1 && (
          <select
            value={range.surah}
            onChange={(e) => {
              setSurah(Number(e.target.value));
              setQuery('');
            }}
            aria-label="Surah"
          >
            {ranges.map((r) => (
              <option key={r.surah} value={r.surah}>
                {chaptersById[r.surah]?.name_simple || `Surah ${r.surah}`}
              </option>
            ))}
          </select>
        )}
        <input
          type="number"
          inputMode="numeric"
          min={range.from}
          max={range.to}
          placeholder={ranges.length > 1 ? `Ayat ${range.from}–${range.to}` : `Go to ayat (${range.from}–${range.to})`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Ayat number"
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>
          Go
        </button>
      </form>
      {query !== '' && !valid && (
        <p className="ayat-search-hint">
          {range.from === range.to ? `Only ayat ${range.from} is here.` : `Choose an ayat from ${range.from} to ${range.to}.`}
        </p>
      )}
    </>
  );
}
