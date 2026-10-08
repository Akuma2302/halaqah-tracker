import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookMarked,
  BookOpenText,
  Check,
  ChevronRight,
  CloudSun,
  Flame,
  MapPin,
  MoonStar,
  Network,
  NotebookText,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  TrendingUp
} from 'lucide-react';
import client from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import MutabaahRing from '../components/MutabaahRing';
import ProfileSheet from '../components/ProfileSheet';
import { MUTABAAH_FIELDS, currentPeriodKey, togglePatch } from '../features/mutabaah/mutabaahFields';
import { currentStreak, hijriDate } from '../features/mutabaah/streak';
import { updateAppBadge } from '../features/mutabaah/appBadge';
import { WEEKLY_TARGET_HOURS } from '../features/academic/constants';
import { lastReadPath, readLastRead } from '../services/quranApi';

const SETUP_DISMISSED_KEY = 'mutabaah_setup_dismissed';
const TOTAL = MUTABAAH_FIELDS.length;
const ICONS = {
  tahajud: MoonStar,
  subuhBerjemaah: Sunrise,
  mathuratPagi: Sun,
  mathuratPetang: Sunset,
  dhuha: CloudSun,
  tilawah: BookOpenText,
  zikir: Sparkles
};

function readSetupDismissed() {
  try {
    return localStorage.getItem(SETUP_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function doneCount(entry) {
  return entry ? MUTABAAH_FIELDS.filter((f) => entry[f.key]).length : 0;
}

function cellColor(count) {
  const ratio = count / TOTAL;
  if (ratio === 0) return 'var(--border)';
  if (ratio < 0.3) return 'var(--heat-1)';
  if (ratio < 0.6) return 'var(--heat-2)';
  if (ratio < 0.9) return 'var(--heat-3)';
  return 'var(--primary)';
}

// Where the "Next up" suggestion can take you, if anywhere.
function shortcutFor(field, lastRead) {
  if (field.key === 'mathuratPagi') return { to: '/mathurat?w=pagi', label: 'Read' };
  if (field.key === 'mathuratPetang') return { to: '/mathurat?w=petang', label: 'Read' };
  if (field.key === 'tilawah') return { to: lastRead?.key ? lastReadPath(lastRead) : '/quran', label: lastRead?.key ? 'Continue' : 'Open Quran' };
  return null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [range, setRange] = useState('week');
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  // Last 30 days, used for the streak and the 7-day average (independent of the trend toggle).
  const [history, setHistory] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(readSetupDismissed);
  const [academicSummary, setAcademicSummary] = useState(null);
  const lastRead = useMemo(readLastRead, []);

  const todayStr = dayjs().format('YYYY-MM-DD');

  useEffect(() => updateAppBadge(today), [today]);

  useEffect(() => {
    client
      .get('/mutabaah/summary?range=month')
      .then((res) => setHistory(res.data))
      .catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    client.get(`/mutabaah/${todayStr}`).then((res) => setToday(res.data)).catch(() => {});
  }, [todayStr]);

  useEffect(() => {
    client
      .get('/academic/summary')
      .then((res) => setAcademicSummary(res.data))
      .catch(() => setAcademicSummary(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    client
      .get(`/mutabaah/summary?range=${range}`)
      .then((res) => setSummary(res.data))
      .catch(() => setSummary([]))
      .finally(() => setLoading(false));
  }, [range]);

  const days = range === 'month' ? 30 : 7;
  const dayList = Array.from({ length: days }).map((_, i) =>
    dayjs()
      .subtract(days - 1 - i, 'day')
      .format('YYYY-MM-DD')
  );
  const entryByDate = Object.fromEntries(summary.map((e) => [e.date, e]));
  const trendCounts = dayList.map((d) => doneCount(entryByDate[d]));
  const trendAverage = trendCounts.reduce((a, b) => a + b, 0) / days;
  const fullDays = trendCounts.filter((c) => c === TOTAL).length;

  // Same optimistic toggle as the Mutabaah page, so today's items can be ticked
  // straight from the dashboard. Also patches today's cell in the trend strip.
  async function toggle(key) {
    if (!today) return;
    const previous = today;
    // Same rule as the Mutabaah page: Tilawah is done at 20 pages, Zikir at 100.
    const body = togglePatch(key, today);
    const next = { ...today, ...body };
    setToday(next);
    try {
      const res = await client.put(`/mutabaah/${todayStr}`, body);
      setToday(res.data);
      const patch = (rows) => [...rows.filter((r) => r.date !== todayStr), { ...res.data, date: todayStr }];
      setSummary(patch);
      setHistory(patch);
    } catch {
      setToday(previous);
    }
  }

  function dismissSetup() {
    setSetupDismissed(true);
    try {
      localStorage.setItem(SETUP_DISMISSED_KEY, '1');
    } catch {
      // Ignore: it just shows again next visit.
    }
  }

  const streak = currentStreak(history);
  const hijri = hijriDate();
  const showSetup = !user?.kampus && !setupDismissed;
  const hours = academicSummary?.hours ?? 0;
  const hoursPercent = Math.min(100, academicSummary?.percent || 0);

  // Today at a glance: how many are left, and what to do next. "Next" prefers
  // an item that belongs to the current part of the day.
  const done = doneCount(today);
  const left = TOTAL - done;
  const nowPeriod = currentPeriodKey(new Date().getHours());
  const pending = MUTABAAH_FIELDS.filter((f) => !today?.[f.key]);
  const nextUp = today ? pending.find((f) => f.period === nowPeriod) || pending[0] || null : null;
  const nextShortcut = nextUp && shortcutFor(nextUp, lastRead);

  // Average for the last 7 days (today included), from the 30-day history.
  const historyByDate = Object.fromEntries(history.map((e) => [e.date, e]));
  const last7 = Array.from({ length: 7 }, (_, i) => doneCount(historyByDate[dayjs().subtract(i, 'day').format('YYYY-MM-DD')]));
  const weekPercent = Math.round((last7.reduce((a, b) => a + b, 0) / (7 * TOTAL)) * 100);
  const activeDays = last7.filter((c) => c > 0).length;

  const mathuratWaktu = new Date().getHours() < 12 ? 'pagi' : 'petang';

  return (
    <div className="page home">
      <div className="page-header greeting">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Assalamualaikum, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle greeting-date">
            {/* Short weekday on phones so the date and Hijri date fit on one line */}
            <span className="greeting-date-long">{dayjs().format('dddd, D MMM')}</span>
            <span className="greeting-date-short">{dayjs().format('ddd, D MMM')}</span>
            {hijri && (
              <>
                <span className="greeting-sep"> · </span>
                <span className="greeting-hijri">{hijri}</span>
              </>
            )}
          </p>
        </div>
        <div className={`streak-chip${streak > 0 ? ' active' : ''}`} title="Days in a row with at least one amal ticked">
          <Flame size={16} />
          {streak > 0 ? (
            <span>
              <strong>{streak >= 30 ? '30+' : streak}</strong> day{streak === 1 ? '' : 's'}
            </span>
          ) : (
            <span>Start a streak</span>
          )}
        </div>
      </div>

      {showSetup && (
        <div className="card setup-card">
          <span className="setup-icon">
            <MapPin size={18} />
          </span>
          <div className="setup-body">
            <div className="setup-title">Add your kampus</div>
            <p className="setup-text">So your halaqah knows where you're studying.</p>
          </div>
          <div className="setup-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setProfileOpen(true)}>
              Add
            </button>
            <button className="btn btn-ghost btn-sm" onClick={dismissSetup}>
              Not now
            </button>
          </div>
        </div>
      )}

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} title="Set up your profile" />

      <div className="home-today">
        {/* ---------- today at a glance ---------- */}
        <div className={`card today-hero${today && left === 0 ? ' complete' : ''}`}>
          <MutabaahRing entry={today} size={124} caption={false} />
          <div className="today-hero-text">
            <div className="today-hero-label">Today's mutabaah</div>
            <div className="today-hero-status">
              {!today ? 'Loading…' : left === 0 ? 'All done. Alhamdulillah.' : done === 0 ? `${TOTAL} to go` : `${left} left today`}
            </div>
            <div className="today-hero-sub">
              {done} of {TOTAL} completed
            </div>
            {nextUp && (
              <div className="today-next">
                <span className="today-next-text">
                  Next up: <strong>{nextUp.label}</strong>
                </span>
                {nextShortcut ? (
                  <Link to={nextShortcut.to} className="today-next-link">
                    {nextShortcut.label} <ArrowRight size={13} />
                  </Link>
                ) : (
                  <button type="button" className="today-next-link" onClick={() => toggle(nextUp.key)}>
                    Mark done <Check size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---------- tick today's items ---------- */}
        <div className="card quick-card">
          <div className="quick-head">
            <span className="section-label" style={{ marginBottom: 0 }}>
              Tap to mark today
            </span>
            <Link to="/checklist" className="quick-more">
              Details <ChevronRight size={14} />
            </Link>
          </div>
          <div className="quick-checks">
            {MUTABAAH_FIELDS.map((f) => {
              const Icon = ICONS[f.key] || Check;
              const isDone = !!today?.[f.key];
              const amount =
                f.key === 'tilawah' && today?.tilawahPages
                  ? `${today.tilawahPages} pages`
                  : f.key === 'zikir' && today?.zikirCount
                    ? `${today.zikirCount}x`
                    : '';
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`quick-check${isDone ? ' done' : ''}`}
                  onClick={() => toggle(f.key)}
                  disabled={!today}
                  aria-pressed={isDone}
                >
                  <span className="quick-check-box">
                    <Icon size={17} />
                  </span>
                  <span className="quick-check-text">
                    <span className="quick-check-label">{f.label}</span>
                    <span className="quick-check-time">{amount ? `${f.time} · ${amount}` : f.time}</span>
                  </span>
                  {!isDone && f.period === nowPeriod && <span className="badge badge-gold">Now</span>}
                  <span className="quick-check-tick" aria-hidden="true">
                    {isDone && <Check size={13} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ---------- the week in two numbers ---------- */}
      <div className="home-stats">
        <Link to="/academic-journal" className="card home-stat">
          <span className="home-stat-head">
            <span className="home-stat-icon">
              <NotebookText size={16} />
            </span>
            Study this week
          </span>
          <span className="home-stat-value">
            {hours}h <small>of the {WEEKLY_TARGET_HOURS}h target</small>
          </span>
          <span
            className="hours-bar"
            role="progressbar"
            aria-valuenow={hoursPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Weekly study hours progress"
          >
            <span className="hours-bar-fill" style={{ width: `${hoursPercent}%` }} />
          </span>
        </Link>
        <Link to="/checklist" className="card home-stat">
          <span className="home-stat-head">
            <span className="home-stat-icon gold">
              <TrendingUp size={16} />
            </span>
            Mutabaah, last 7 days
          </span>
          <span className="home-stat-value">
            {weekPercent}% <small>{activeDays} of 7 days active</small>
          </span>
          <span className="hours-bar" role="progressbar" aria-valuenow={weekPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Mutabaah over the last 7 days">
            <span className="hours-bar-fill gold" style={{ width: `${weekPercent}%` }} />
          </span>
        </Link>
      </div>

      {/* ---------- shortcuts ---------- */}
      <div className="home-links">
        <Link to={lastRead?.key ? lastReadPath(lastRead) : '/quran'} className="card home-link">
          <BookOpenText size={18} />
          <span className="home-link-title">Al-Quran</span>
          <span className="home-link-sub">{lastRead?.label ? `Continue: ${lastRead.label}` : 'Start reading'}</span>
        </Link>
        <Link to={`/mathurat?w=${mathuratWaktu}`} className="card home-link">
          <BookMarked size={18} />
          <span className="home-link-title">Al-Mathurat</span>
          <span className="home-link-sub">{mathuratWaktu === 'pagi' ? 'Bacaan pagi' : 'Bacaan petang'}</span>
        </Link>
        <Link to="/mentoring" className="card home-link">
          <Network size={18} />
          <span className="home-link-title">Mentoring</span>
          <span className="home-link-sub">Tree and dashboard</span>
        </Link>
      </div>

      {/* ---------- trend ---------- */}
      <div className="card trend-card">
        <div className="trend-head">
          <span className="section-label" style={{ marginBottom: 0 }}>
            Your trend
          </span>
          <div className="range-toggle">
            <button className={range === 'week' ? 'active' : ''} onClick={() => setRange('week')}>
              Week
            </button>
            <button className={range === 'month' ? 'active' : ''} onClick={() => setRange('month')}>
              Month
            </button>
          </div>
        </div>

        {loading ? (
          <div className="spinner" />
        ) : (
          <>
            <p className="trend-summary">
              Average <strong>{Math.round(trendAverage * 10) / 10}</strong> of {TOTAL} a day · {fullDays} full day{fullDays === 1 ? '' : 's'}
            </p>
            {range === 'week' ? (
              <div className="trend-bars" aria-label="Mutabaah items done per day, last 7 days">
                {dayList.map((d, i) => (
                  <div key={d} className={`trend-bar${d === todayStr ? ' today' : ''}`} title={`${dayjs(d).format('D MMM')}: ${trendCounts[i]}/${TOTAL}`}>
                    <span className="trend-bar-value">{trendCounts[i] || ''}</span>
                    <span className="trend-bar-track">
                      <span className="trend-bar-fill" style={{ height: `${(trendCounts[i] / TOTAL) * 100}%`, background: cellColor(trendCounts[i]) }} />
                    </span>
                    <span className="trend-bar-day">{dayjs(d).format('dd')[0]}</span>
                    <span className="trend-bar-date">{dayjs(d).format('D')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="trend-grid" aria-label="Mutabaah items done per day, last 30 days">
                {dayList.map((d, i) => (
                  <div
                    key={d}
                    className={`trend-cell${d === todayStr ? ' today' : ''}`}
                    style={{ background: cellColor(trendCounts[i]), color: trendCounts[i] / TOTAL > 0.6 ? 'var(--on-primary)' : 'var(--ink-soft)' }}
                    title={`${dayjs(d).format('D MMM')}: ${trendCounts[i]}/${TOTAL}`}
                  >
                    {dayjs(d).format('D')}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
