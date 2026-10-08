import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { BarChart3, BookMarked, ChevronLeft, ChevronRight, Check, Copy } from 'lucide-react';
import client from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import Sheet from '../components/Sheet';
import {
  MUTABAAH_FIELDS,
  MUTABAAH_PERIODS,
  currentPeriodKey,
  PAGES_PER_JUZ,
  MAX_TILAWAH_PAGES,
  ZIKIR_GOAL,
  MAX_ZIKIR_COUNT,
  tilawahPagesPatch,
  zikirCountPatch,
  togglePatch
} from '../features/mutabaah/mutabaahFields';
import { MUTABAAH_ICONS } from '../features/mutabaah/mutabaahIcons';
import CountStepper from '../components/CountStepper';
import { updateAppBadge } from '../features/mutabaah/appBadge';

const TOTAL = MUTABAAH_FIELDS.length;
const todayKey = () => dayjs().format('YYYY-MM-DD');

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

// One-tap ranges for the period report: [label, from, to].
function periodPresets() {
  const today = dayjs();
  return [
    ['Last 7 days', today.subtract(6, 'day'), today],
    ['Last 30 days', today.subtract(29, 'day'), today],
    ['This month', today.startOf('month'), today]
  ].map(([label, from, to]) => ({ label, from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') }));
}

function doneCount(entry) {
  return entry ? MUTABAAH_FIELDS.filter((f) => entry[f.key]).length : 0;
}

export default function Checklist() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayKey);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Last 30 days, for the little rings on the week strip.
  const [history, setHistory] = useState([]);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [fromDate, setFromDate] = useState(dayjs().subtract(6, 'day').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(todayKey);
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

  useEffect(() => {
    client
      .get('/mutabaah/summary?range=month')
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]));
  }, []);

  const today = todayKey();
  const isToday = date === today;
  const nowPeriod = isToday ? currentPeriodKey(dayjs().hour()) : null;

  useEffect(() => {
    if (isToday) updateAppBadge(entry);
  }, [isToday, entry]);

  async function toggle(key) {
    const previous = entry;
    // Tilawah's and Zikir's tick and count move together (done = 20 pages / 100x).
    const body = togglePatch(key, entry);
    const next = { ...entry, ...body };
    cancelPendingPages();
    setEntry(next);
    try {
      const res = await client.put(`/mutabaah/${date}`, body);
      setEntry(res.data);
    } catch {
      setEntry(previous);
    }
  }

  // Count taps (tilawah pages, zikir) are applied instantly and saved once the
  // user pauses, so tapping "+" ten times is one request rather than ten.
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

  function setCount(patch) {
    // Merge with any unsaved change to the other counter so neither is lost.
    const body = { ...(pendingPages.current?.body || {}), ...patch };
    setEntry((cur) => ({ ...cur, ...patch }));
    cancelPendingPages();
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

  function loadPeriod(from = fromDate, to = toDate) {
    if (!from || !to || from > to) {
      setPeriodError('Please choose a valid range (from must not be after to).');
      return;
    }
    setFromDate(from);
    setToDate(to);
    setPeriodLoading(true);
    setPeriodError('');
    setCopied(false);
    client
      .get('/mutabaah/period', { params: { from, to } })
      .then((res) => setPeriodData(res.data))
      .catch(() => setPeriodError("Couldn't load that period. Please try again."))
      .finally(() => setPeriodLoading(false));
  }

  function openPeriod() {
    setPeriodOpen(true);
    loadPeriod();
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

  const completedCount = doneCount(entry);
  const left = TOTAL - completedCount;

  // The week strip: the 7 days ending on the later of the chosen day and
  // today's week window, so today stays in view until you go further back.
  const windowEnd = useMemo(() => {
    const back = dayjs(today).diff(dayjs(date), 'day');
    return dayjs(today)
      .subtract(Math.floor(back / 7) * 7, 'day')
      .format('YYYY-MM-DD');
  }, [date, today]);
  const strip = Array.from({ length: 7 }, (_, i) => dayjs(windowEnd).subtract(6 - i, 'day').format('YYYY-MM-DD'));
  // Done-counts for the strip: history, with the open day always live.
  const countByDate = useMemo(() => {
    const map = Object.fromEntries(history.map((e) => [e.date, doneCount(e)]));
    if (entry && !loading) map[date] = doneCount(entry);
    return map;
  }, [history, entry, date, loading]);

  const presets = periodPresets();

  return (
    <div className="page mutabaah-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mutabaah</h1>
          <p className="page-subtitle">{isToday ? dayjs(date).format('dddd, D MMM') : `${dayjs(date).format('dddd, D MMM YYYY')}`}</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={openPeriod}>
          <BarChart3 size={13} /> Report
        </button>
      </div>

      {/* ---------- the day at a glance ---------- */}
      <div className={`card day-progress${entry && left === 0 ? ' complete' : ''}`}>
        <div className="day-progress-top">
          <span className="day-progress-count">
            {completedCount}
            <small>/{TOTAL}</small>
          </span>
          <span className="day-progress-text">
            <strong>
              {!entry || loading
                ? ' '
                : left === 0
                  ? 'All done. Alhamdulillah.'
                  : isToday
                    ? completedCount === 0
                      ? `${TOTAL} to go today`
                      : `${left} left today`
                    : `${left} not done`}
            </strong>
            <span>{isToday ? 'Tap an item to tick it' : 'You can still update this day'}</span>
          </span>
        </div>
        <div className="day-progress-segments" aria-hidden="true">
          {MUTABAAH_FIELDS.map((f) => (
            <span key={f.key} className={entry?.[f.key] ? 'on' : ''} title={f.label} />
          ))}
        </div>
      </div>

      {/* ---------- pick a day ---------- */}
      <div className="week-strip">
        <button className="icon-btn" onClick={() => setDate(dayjs(date).subtract(7, 'day').format('YYYY-MM-DD'))} aria-label="Previous week">
          <ChevronLeft size={16} />
        </button>
        <div className="week-strip-days">
          {strip.map((d) => {
            const count = countByDate[d];
            const percent = count ? Math.round((count / TOTAL) * 100) : 0;
            return (
              <button
                key={d}
                type="button"
                className={`week-day${d === date ? ' selected' : ''}${d === today ? ' today' : ''}`}
                onClick={() => setDate(d)}
                aria-pressed={d === date}
                aria-label={`${dayjs(d).format('dddd, D MMMM')}${count !== undefined ? `, ${count} of ${TOTAL} done` : ''}`}
              >
                <span className="week-day-name">{dayjs(d).format('dd')[0]}</span>
                <span className={`week-day-ring${count === TOTAL ? ' full' : ''}`} style={{ '--p': percent }}>
                  <span>{dayjs(d).format('D')}</span>
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="icon-btn"
          onClick={() => {
            const next = dayjs(date).add(7, 'day');
            setDate((next.isAfter(dayjs(today)) ? dayjs(today) : next).format('YYYY-MM-DD'));
          }}
          disabled={windowEnd === today}
          aria-label="Next week"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {!isToday && (
        <button type="button" className="back-to-today" onClick={() => setDate(today)}>
          Back to today
        </button>
      )}

      {loading ? (
        <div className="spinner" style={{ margin: '24px auto', display: 'block' }} />
      ) : error || !entry ? (
        <p className="page-subtitle">Couldn't load this day's checklist. Please refresh the page.</p>
      ) : (
        <div>
          {MUTABAAH_PERIODS.map((p) => {
            const fields = MUTABAAH_FIELDS.filter((f) => f.period === p.key);
            const groupDone = fields.filter((f) => entry[f.key]).length;
            const isNow = p.key === nowPeriod;
            return (
              <section key={p.key} className={`checklist-group${isNow ? ' now' : ''}`}>
                <div className="checklist-group-head">
                  <span className="checklist-group-title">{p.label}</span>
                  {isNow && <span className="badge badge-gold">Now</span>}
                  <span className={`checklist-group-count${groupDone === fields.length ? ' full' : ''}`}>
                    {groupDone === fields.length && <Check size={11} strokeWidth={3} />}
                    {groupDone}/{fields.length}
                  </span>
                </div>
                {fields.map((f) => {
                  const Icon = MUTABAAH_ICONS[f.key] || Check;
                  return (
                    <div
                      key={f.key}
                      className={`checklist-item${entry[f.key] ? ' done' : ''}`}
                      onClick={() => toggle(f.key)}
                      role="checkbox"
                      aria-checked={!!entry[f.key]}
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(f.key)}
                    >
                      <span className="item-icon">
                        <Icon size={18} />
                      </span>
                      <div className="item-body">
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
                      <span className="check-circle">{entry[f.key] && <Check size={15} strokeWidth={3} />}</span>
                      {f.key === 'tilawah' && (
                        <CountStepper
                          value={entry.tilawahPages || 0}
                          onChange={(n) => setCount(tilawahPagesPatch(n))}
                          max={MAX_TILAWAH_PAGES}
                          goal={PAGES_PER_JUZ}
                          unit="pages"
                          label="page"
                          quick={[5, 10, 20]}
                          goalText={(n) =>
                            n >= PAGES_PER_JUZ
                              ? `${(n / PAGES_PER_JUZ).toFixed(1).replace(/\.0$/, '')} juz read`
                              : `${PAGES_PER_JUZ - n} more page${PAGES_PER_JUZ - n === 1 ? '' : 's'} to complete 1 juz`
                          }
                        />
                      )}
                      {f.key === 'zikir' && (
                        <CountStepper
                          value={entry.zikirCount || 0}
                          onChange={(n) => setCount(zikirCountPatch(n))}
                          max={MAX_ZIKIR_COUNT}
                          goal={ZIKIR_GOAL}
                          unit="times"
                          label="count"
                          quick={[10, 33, 100]}
                          goalText={(n) => (n >= ZIKIR_GOAL ? `${n}x done` : `${ZIKIR_GOAL - n} more to reach ${ZIKIR_GOAL}x`)}
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
          {pagesError && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12 }}>
              Couldn't save your count. Change the number again to retry.
            </p>
          )}
        </div>
      )}

      {/* ---------- period report ---------- */}
      <Sheet open={periodOpen} onClose={() => setPeriodOpen(false)} title="Period report">
        <div className="chip-row period-presets">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`chip${fromDate === p.from && toDate === p.to ? ' on' : ''}`}
              onClick={() => loadPeriod(p.from, p.to)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid-2 period-dates">
          <div className="field">
            <label>From</label>
            <input className="input" type="date" value={fromDate} onChange={(e) => loadPeriod(e.target.value, toDate)} max={toDate} />
          </div>
          <div className="field">
            <label>To</label>
            <input className="input" type="date" value={toDate} onChange={(e) => loadPeriod(fromDate, e.target.value)} min={fromDate} max={today} />
          </div>
        </div>

        {periodError && <p className="form-error">{periodError}</p>}

        {periodLoading && !periodData ? (
          <div className="spinner" style={{ margin: '18px auto', display: 'block' }} />
        ) : (
          periodData && (
            <div className={`period-result${periodLoading ? ' loading' : ''}`}>
              <p className="period-range">
                {dayjs(periodData.from).format('D MMM YYYY')} – {dayjs(periodData.to).format('D MMM YYYY')} · {periodData.totalDays} day
                {periodData.totalDays === 1 ? '' : 's'}
              </p>
              {MUTABAAH_FIELDS.map((f) => {
                const Icon = MUTABAAH_ICONS[f.key] || Check;
                const percent = periodData.totalDays ? Math.round((periodData.totals[f.key] / periodData.totalDays) * 100) : 0;
                return (
                  <div className="period-row" key={f.key}>
                    <Icon size={15} />
                    <span className="period-row-name">{f.label}</span>
                    <span className="period-row-bar">
                      <span style={{ width: `${percent}%` }} />
                    </span>
                    <span className="period-row-value">
                      {periodData.totals[f.key]}/{periodData.totalDays}
                    </span>
                  </div>
                );
              })}
              <div className="period-extras">
                {typeof periodData.zikirCount === 'number' && (
                  <span>
                    <strong>{periodData.zikirCount}x</strong> istighfar
                  </span>
                )}
                {/* Older backends don't send tilawahPages; hide it rather than show 0 */}
                {typeof periodData.tilawahPages === 'number' && (
                  <span>
                    <strong>{periodData.tilawahPages}</strong> pages ≈ {(periodData.tilawahPages / PAGES_PER_JUZ).toFixed(1)} juz
                  </span>
                )}
              </div>
              <button className="btn btn-primary btn-block" onClick={copySummary} style={{ marginTop: 14 }}>
                <Copy size={14} /> {copied ? 'Copied!' : 'Copy summary'}
              </button>
            </div>
          )
        )}
      </Sheet>
    </div>
  );
}
