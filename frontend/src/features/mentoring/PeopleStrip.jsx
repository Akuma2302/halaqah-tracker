import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../../services/apiClient';
import { hueFor } from '../timetable/timetable';

// The people whose page I can open, in order: my mentees, then the mates in
// my group. Fetched once and kept for a few minutes, so moving from one
// person to the next doesn't fetch it again.
let cache = null; // { at, people }
const KEEP_MS = 5 * 60 * 1000;

export function usePeople() {
  const [people, setPeople] = useState(() => cache?.people || null);
  useEffect(() => {
    if (cache && Date.now() - cache.at < KEEP_MS) return undefined;
    let cancelled = false;
    client
      .get('/mentoring/tree', { params: { date: new Date().toLocaleDateString('en-CA') } })
      .then((res) => {
        const byName = (a, b) => a.name.localeCompare(b.name);
        const list = [
          ...(res.data.mentees || []).map((p) => ({ ...p, role: 'mentee' })).sort(byName),
          ...(res.data.mates || []).filter((m) => m.sameGroup !== false).map((p) => ({ ...p, role: 'mate' })).sort(byName)
        ];
        cache = { at: Date.now(), people: list };
        if (!cancelled) setPeople(list);
      })
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, []);
  return people;
}

// A row of small pictures at the top of a person's page: tap one to open
// them. The one on show is ringed and kept in view.
export function PeopleStrip({ people, currentId }) {
  const row = useRef(null);
  useEffect(() => {
    const on = row.current?.querySelector('.ps-person.on');
    if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [currentId, people]);

  if (!people || people.length < 2) return null;
  return (
    <nav className="ps" ref={row} aria-label="Your mentees and group mates">
      {people.map((p, i) => (
        <span key={p._id} className="ps-slot">
          {/* A line between the mentees and the group mates */}
          {i > 0 && people[i - 1].role !== p.role && <i className="ps-split" aria-hidden="true" />}
          <Link to={`/mentoring/${p._id}`} replace className={`ps-person${p._id === currentId ? ' on' : ''}`} aria-current={p._id === currentId ? 'page' : undefined}>
            {p.avatarUrl ? (
              <img className="ps-pic" src={p.avatarUrl} alt="" />
            ) : (
              <span className="ps-pic ps-letter" style={{ '--hue': hueFor(p.name) }}>
                {(p.name || '?').trim()[0]?.toUpperCase()}
              </span>
            )}
            <small>{p.name.split(' ')[0]}</small>
          </Link>
        </span>
      ))}
    </nav>
  );
}
