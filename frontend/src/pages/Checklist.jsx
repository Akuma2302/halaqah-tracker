import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { BookMarked, ChevronLeft, ChevronRight, Check, Calendar, Copy, X } from 'lucide-react';
import client from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import { MUTABAAH_FIELDS, MUTABAAH_PERIODS, currentPeriodKey, PAGES_PER_JUZ } from '../features/mutabaah/mutabaahFields';
import TilawahStepper from '../components/TilawahStepper';
import { updateAppBadge } from '../features/mutabaah/appBadge';

// Labels used specifically for the "Copy" summary text, per the requested
// format — a couple of these differ from the on-screen checklist labels
// (Tilawah -> "Alquran 1juz", Zikir -> "Istighfar 100x").
const COPY_LABELS = {
  tahajud: 'Tahajud',
  subuhBerjemaah: 'Subuh Berjemaah',
  mathuratPagi: 'Mathurat pagi',
  mathuratPetang: 'Mathurat petang',
  dhuha: 'Dhuha',
  tilawah: 'Alquran 1juz',
  zikir: 'Istighfar 100x'
};

export default function Checklist() {
  const { user } = useAuth();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, 'day').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [periodData, setPeriodData] = useState(null);
  const [periodLoading, setPeriodLoading] = useState(false);
  const [periodError, setPeriodError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pagesError, setPagesError] = useState(false);

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
  const nowPeriod = isToday ? currentPeriodKey(dayjs().hour()) : null;

  useEffect(() => {
    if (isToday) updateAppBadge(entry);
  }, [isToday, entry]);

  async function toggle(key) {
    const previous = entry;
    const next = { ...entry, [key]: !entry[key] };
    const body = { [key]: next[key] };
    // Unticking Tilawah clears its page count too, so the two never disagree.
    if (key === 'tilawah' && !next.tilawah && entry.tilawahPages) {
      next.tilawahPages = 0;
      body.tilawahPages = 0;
    }
    cancelPendingPages();
    setEntry(next);
    try {
      const res = await client.put(`/mutabaah/${date}`, body);
      setEntry(res.data);
    } catch {
      setEntry(previous);
    }
  }

  // Page taps are applied instantly and saved once the user pauses, so tapping
  // "+" ten times is one request rather than ten.
  const pendingPages = useRef(null); // { date, body, timer }

  function cancelPendingPages() {
    if (pendingPages.current) clearTimeout(pendingPages.current.timer);
    pendingPages.current = null;
  }

  function flushPendingPages() {
    const pending = pendingPages.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingPages.current = null;
    return client.put(`/mutabaah/${pending.date}`, pending.body);
  }

  function setTilawahPages(pages) {
    const next = { ...entry, tilawahPages: pages, tilawah: pages > 0 ? true : entry.tilawah };
    setEntry(next);
    cancelPendingPages();
    const body = { tilawahPages: pages, tilawah: next.tilawah };
    pendingPages.current = {
      date,
      body,
      timer: setTimeout(() => {
        flushPendingPages()
          ?.then((res) => {
            // Ignore the reply if the user has kept tapping since.
            if (!pendingPages.current) setEntry((cur) => (cur?.date === res.data.date ? res.data : cur));
          })
          .catch(() => setPagesError(true));
      }, 700)
    };
    setPagesError(false);
  }

  // Don't lose a pending page count when switching day or leaving the page.
  useEffect(() => () => void flushPendingPages()?.catch(() => {}), [date]);

  function loadPeriod() {
    if (!fromDate || !toDate || fromDate > toDate) {
      setPeriodError('Please choose a valid range (from must not be after to).');
      return;
    }
    setPeriodLoading(true);
    setPeriodError('');
    setCopied(false);
    client
      .get('/mutabaah/period', { params: { from: fromDate, to: toDate } })
      .then((res) => setPeriodData(res.data))
      .catch(() => setPeriodError("Couldn't load that period. Please try again."))
      .finally(() => setPeriodLoading(false));
  }

  function copySummary() {
    if (!periodData) return;
    const lines = [
      'Checklist Mutabaah Amal',
      user?.name || '',
      ...MUTABAAH_FIELDS.map(
        (f) => `${COPY_LABELS[f.key]} - ${periodData.totals[f.key]}/${periodData.totalDays}`
      )
    ];
    navigator.clipboard?.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const completedCount = entry ? MUTABAAH_FIELDS.filter((f) => entry[f.key]).length : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mutabaah</h1>
          <p className="page-subtitle">
            {completedCount}/{MUTABAAH_FIELDS.length} done {isToday ? 'today' : `on ${dayjs(date).format('D MMM')}`}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPeriodOpen((v) => !v)}>
          <Calendar size={13} /> {periodOpen ? 'Hide' : 'View'} period performance
        </button>
      </div>

      {periodOpen && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span className="section-label">Period performance</span>
            <button className="icon-btn" onClick={() => setPeriodOpen(false)} aria-label="Close">
              <X size={15} />
            </button>
          </div>

          <div className="grid-2">
            <div className="field">
              <label>From</label>
              <input className="input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} />
            </div>
            <div className="field">
              <label>To</label>
              <input className="input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={dayjs().format('YYYY-MM-DD')} />
            </div>
          </div>

          <button className="btn btn-primary" onClick={loadPeriod} disabled={periodLoading}>
            {periodLoading ? 'Loading…' : 'Show performance'}
          </button>

          {periodError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 10 }}>{periodError}</p>}

          {periodData && (
            <div style={{ marginTop: 16 }}>
              <p className="page-subtitle" style={{ marginBottom: 10 }}>
                {dayjs(periodData.from).format('D MMM YYYY')} – {dayjs(periodData.to).format('D MMM YYYY')} ·{' '}
                {periodData.totalDays} day{periodData.totalDays === 1 ? '' : 's'}
              </p>
              {MUTABAAH_FIELDS.map((f) => (
                <div className="member-row" key={f.key}>
                  <div style={{ flex: 1 }}>
                    <div className="name">{f.label}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    {periodData.totals[f.key]}/{periodData.totalDays}
                  </span>
                </div>
              ))}
              {/* Older backends don't send tilawahPages; hide the row rather than show 0 */}
              {typeof periodData.tilawahPages === 'number' && (
                <div className="member-row">
                  <div style={{ flex: 1 }}>
                    <div className="name">Tilawah pages read</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    {periodData.tilawahPages} ≈ {(periodData.tilawahPages / PAGES_PER_JUZ).toFixed(1)} juz
                  </span>
                </div>
              )}
              <button className="btn btn-ghost btn-block" onClick={copySummary} style={{ marginTop: 12 }}>
                <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}

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
          {MUTABAAH_PERIODS.map((p) => {
            const fields = MUTABAAH_FIELDS.filter((f) => f.period === p.key);
            const doneCount = fields.filter((f) => entry[f.key]).length;
            const isNow = p.key === nowPeriod;
            return (
              <section key={p.key} className={`checklist-group${isNow ? ' now' : ''}`}>
                <div className="checklist-group-head">
                  <span className="checklist-group-title">{p.label}</span>
                  {isNow && <span className="badge badge-gold">Now</span>}
                  <span className="checklist-group-count">
                    {doneCount}/{fields.length}
                  </span>
                </div>
                {fields.map((f) => (
                  <div
                    key={f.key}
                    className={`checklist-item${entry[f.key] ? ' done' : ''}`}
                    onClick={() => toggle(f.key)}
                    role="checkbox"
                    aria-checked={!!entry[f.key]}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(f.key)}
                  >
                    <span className="check-circle">{entry[f.key] && <Check size={15} strokeWidth={3} />}</span>
                    <div>
                      <div className="item-name">{f.label}</div>
                      <div className="item-time">{f.time}</div>
                    </div>
                    {(f.key === 'mathuratPagi' || f.key === 'mathuratPetang') && (
                      <Link
                        className="checklist-read"
                        to={`/mathurat?w=${f.key === 'mathuratPagi' ? 'pagi' : 'petang'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <BookMarked size={13} /> Read
                      </Link>
                    )}
                    {f.key === 'tilawah' && (
                      <TilawahStepper pages={entry.tilawahPages || 0} onChange={setTilawahPages} />
                    )}
                  </div>
                ))}
              </section>
            );
          })}
          {pagesError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>
              Couldn't save your Tilawah pages. Change the number again to retry.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
