import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { Pencil, Check, ArrowRight } from 'lucide-react';
import client from '../services/apiClient';
import { useAuth } from '../hooks/useAuth';
import MutabaahRing from '../components/MutabaahRing';
import ProgressRing from '../components/ProgressRing';
import { MUTABAAH_FIELDS } from '../features/mutabaah/mutabaahFields';
import { WEEKLY_TARGET_HOURS } from '../features/academic/constants';

function cellColor(entry) {
  if (!entry) return 'var(--border)';
  const count = MUTABAAH_FIELDS.filter((f) => entry[f.key]).length;
  const ratio = count / MUTABAAH_FIELDS.length;
  if (ratio === 0) return 'var(--border)';
  if (ratio < 0.3) return '#cfe6dd';
  if (ratio < 0.6) return '#8fc2ae';
  if (ratio < 0.9) return '#4d9483';
  return 'var(--primary)';
}

export default function Dashboard() {
  const { user, updateProfile } = useAuth();
  const [today, setToday] = useState(null);
  const [range, setRange] = useState('week');
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [kampusDraft, setKampusDraft] = useState('');
  const [academicSummary, setAcademicSummary] = useState(null);

  const todayStr = dayjs().format('YYYY-MM-DD');

  useEffect(() => {
    setNameDraft(user?.name || '');
    setKampusDraft(user?.kampus || '');
  }, [user]);

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
      setSummary((rows) => [...rows.filter((r) => r.date !== todayStr), { ...res.data, date: todayStr }]);
    } catch {
      setToday(previous);
    }
  }

  async function saveProfile() {
    await updateProfile({ name: nameDraft.trim() || user?.name, kampus: kampusDraft });
    setEditingProfile(false);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          {editingProfile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260 }}>
              <input
                className="input"
                style={{ padding: '6px 10px' }}
                placeholder="Your name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                autoFocus
              />
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="input"
                  style={{ width: 200, padding: '4px 8px' }}
                  placeholder="Your kampus"
                  value={kampusDraft}
                  onChange={(e) => setKampusDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveProfile()}
                />
                <button className="icon-btn" onClick={saveProfile} aria-label="Save profile">
                  <Check size={14} />
                </button>
              </span>
            </div>
          ) : (
            <>
              <h1 className="page-title">Assalamualaikum, {user?.name?.split(' ')[0]}</h1>
              <p className="page-subtitle">
                <span
                  style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setEditingProfile(true)}
                >
                  {user?.kampus || 'Add your name & kampus'}
                  <Pencil size={12} />
                </span>
              </p>
            </>
          )}
        </div>
      </div>

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

      <div className="card ring-card" style={{ marginTop: 14 }}>
        <ProgressRing
          percent={academicSummary?.percent || 0}
          size={140}
          primaryText={`${academicSummary?.hours ?? 0}h`}
          secondaryText={`of ${WEEKLY_TARGET_HOURS}h this week`}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>
            Academic Journal
          </span>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Study hours logged this week toward your target.
          </p>
          <Link to="/academic-journal" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Open Academic Journal <ArrowRight size={14} />
          </Link>
        </div>
      </div>

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
                  style={{ background: cellColor(entry), color: ratio > 0.6 ? 'white' : 'var(--ink-soft)' }}
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
