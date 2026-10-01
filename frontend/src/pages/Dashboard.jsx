import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Flame, MapPin, NotebookText } from 'lucide-react';
import client from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import MutabaahRing from '../components/MutabaahRing';
import ProfileSheet from '../components/ProfileSheet';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';
import { currentStreak, hijriDate } from '../features/mutabaah/streak';
import { WEEKLY_TARGET_HOURS } from '../features/academic/constants';

const SETUP_DISMISSED_KEY = 'mutabaah_setup_dismissed';

function readSetupDismissed() {
  try {
    return localStorage.getItem(SETUP_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function cellColor(entry) {
  if (!entry) return 'var(--border)';
  const count = MUTABAAH_FIELDS.filter((f) => entry[f.key]).length;
  const ratio = count / MUTABAAH_FIELDS.length;
  if (ratio === 0) return 'var(--border)';
  if (ratio < 0.3) return 'var(--heat-1)';
  if (ratio < 0.6) return 'var(--heat-2)';
  if (ratio < 0.9) return 'var(--heat-3)';
  return 'var(--primary)';
}

export default function Dashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [range, setRange] = useState('week');
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  // Last 30 days, used only for the streak (independent of the trend toggle).
  const [history, setHistory] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(readSetupDismissed);
  const [academicSummary, setAcademicSummary] = useState(null);

  const todayStr = dayjs().format('YYYY-MM-DD');

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

  // Same optimistic toggle as the Mutabaah page, so today's items can be ticked
  // straight from the dashboard. Also patches today's cell in the trend strip.
  async function toggle(key) {
    if (!today) return;
    const previous = today;
    const next = { ...today, [key]: !today[key] };
    setToday(next);
    try {
      const res = await client.put(`/mutabaah/${todayStr}`, { [key]: next[key] });
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

  return (
    <div className="page">
      <div className="page-header greeting">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title">Assalamualaikum, {user?.name?.split(' ')[0]}</h1>
          <p className="page-subtitle">
            {dayjs().format('dddd, D MMM')}
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

      <div className="card ring-card">
        <MutabaahRing entry={today} />
        <div className="quick-checks">
          <span className="section-label" style={{ marginBottom: 2 }}>
            Tap to mark today
          </span>
          {MUTABAAH_FIELDS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`quick-check${today?.[f.key] ? ' done' : ''}`}
              onClick={() => toggle(f.key)}
              disabled={!today}
              aria-pressed={!!today?.[f.key]}
            >
              <span className="quick-check-box">{today?.[f.key] && <Check size={13} strokeWidth={3} />}</span>
              <span className="quick-check-label">{f.label}</span>
              <span className="quick-check-time">{f.time}</span>
            </button>
          ))}
        </div>
      </div>

      <Link to="/academic-journal" className="card hours-card">
        <span className="hours-icon">
          <NotebookText size={18} />
        </span>
        <span className="hours-body">
          <span className="hours-head">
            <span className="hours-title">Study hours this week</span>
            <span className="hours-value">
              <strong>{hours}h</strong> / {WEEKLY_TARGET_HOURS}h
            </span>
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
        </span>
        <ChevronRight size={18} className="hours-chevron" />
      </Link>

      <div className="card" style={{ marginTop: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 10
          }}
        >
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
          <div className="day-strip">
            {dayList.map((d) => {
              const entry = entryByDate[d];
              const count = entry ? MUTABAAH_FIELDS.filter((f) => entry[f.key]).length : 0;
              const ratio = count / MUTABAAH_FIELDS.length;
              return (
                <div
                  key={d}
                  className="day-cell"
                  style={{ background: cellColor(entry), color: ratio > 0.6 ? 'var(--on-primary)' : 'var(--ink-soft)' }}
                  title={`${dayjs(d).format('D MMM')} — ${count}/${MUTABAAH_FIELDS.length}`}
                >
                  {range === 'week' ? dayjs(d).format('dd')[0] : ''}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
