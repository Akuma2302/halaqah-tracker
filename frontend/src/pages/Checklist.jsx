import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import client from '../services/apiClient';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';

export default function Checklist() {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    client
      .get(`/mutabaah/${date}`)
      .then((res) => setEntry(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [date]);

  const isToday = date === dayjs().format('YYYY-MM-DD');

  async function toggle(key) {
    const previous = entry;
    const next = { ...entry, [key]: !entry[key] };
    setEntry(next);
    try {
      const res = await client.put(`/mutabaah/${date}`, { [key]: next[key] });
      setEntry(res.data);
    } catch {
      setEntry(previous);
    }
  }

  const completedCount = entry ? MUTABAAH_FIELDS.filter((f) => entry[f.key]).length : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Checklist</h1>
          <p className="page-subtitle">
            {completedCount}/{MUTABAAH_FIELDS.length} done {isToday ? 'today' : `on ${dayjs(date).format('D MMM')}`}
          </p>
        </div>
      </div>

      <div className="date-nav">
        <button
          className="icon-btn"
          onClick={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}
          aria-label="Previous day"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="date-label">{isToday ? 'Today' : dayjs(date).format('dddd, D MMM YYYY')}</span>
        <button
          className="icon-btn"
          onClick={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}
          disabled={isToday}
          aria-label="Next day"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {loading ? (
        <div className="spinner" style={{ margin: '0 auto', display: 'block' }} />
      ) : error || !entry ? (
        <p className="page-subtitle">Couldn't load today's checklist. Please refresh the page.</p>
      ) : (
        <div>
          {MUTABAAH_FIELDS.map((f) => (
            <div
              key={f.key}
              className={`checklist-item${entry[f.key] ? ' done' : ''}`}
              onClick={() => toggle(f.key)}
              role="checkbox"
              aria-checked={!!entry[f.key]}
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(f.key)}
            >
              <span className="check-circle">{entry[f.key] && <Check size={15} />}</span>
              <div>
                <div className="item-name">{f.label}</div>
                <div className="item-time">{f.time}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
