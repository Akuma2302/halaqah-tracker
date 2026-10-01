import { useState } from 'react';
import { AlarmClock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { setupPushNotifications } from '../services/push';

// Mirrors the slot times in backend/src/services/mutabaahReminderService.js.
const SCHEDULE = [
  { time: '7:30 am', items: 'Tahajud, Subuh Berjemaah' },
  { time: '10:30 am', items: 'Mathurat Pagi, Dhuha' },
  { time: '6:15 pm', items: 'Mathurat Petang' },
  { time: '9:30 pm', items: 'Anything still left' }
];

function permissionState() {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

export default function MutabaahReminderCard() {
  const { user, updateProfile } = useAuth();
  const enabled = user?.mutabaahReminders !== false;
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState(permissionState);
  const [pushStatus, setPushStatus] = useState(''); // '', 'working', 'ok', 'failed'

  async function toggle() {
    setSaving(true);
    try {
      await updateProfile({ mutabaahReminders: !enabled });
    } finally {
      setSaving(false);
    }
  }

  // Must run from a tap: iOS only shows the permission prompt for a user gesture.
  async function enablePush() {
    setPushStatus('working');
    const ok = await setupPushNotifications();
    setPermission(permissionState());
    setPushStatus(ok ? 'ok' : 'failed');
  }

  return (
    <div className="card reminder-card">
      <div className="reminder-head">
        <span className="reminder-icon">
          <AlarmClock size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="reminder-title">Mutabaah reminders</div>
          <p className="reminder-sub">A push only for amal you haven't ticked yet.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Mutabaah reminders"
          className={`switch${enabled ? ' on' : ''}`}
          onClick={toggle}
          disabled={saving}
        >
          <span className="switch-knob" />
        </button>
      </div>

      {enabled && (
        <>
          <ul className="reminder-schedule">
            {SCHEDULE.map((s) => (
              <li key={s.time}>
                <span className="reminder-time">{s.time}</span>
                <span>{s.items}</span>
              </li>
            ))}
          </ul>

          {permission === 'denied' ? (
            <p className="reminder-warn">
              Notifications are blocked for this app. Allow them in your phone's settings to get reminders.
            </p>
          ) : permission === 'unsupported' ? (
            <p className="reminder-warn">
              This browser can't receive push. On iPhone, add the app to your Home Screen first (Share → Add to Home
              Screen) and open it from there.
            </p>
          ) : pushStatus === 'ok' ? (
            <p className="reminder-ok">Notifications are on for this device.</p>
          ) : (
            <div className="reminder-push">
              <button className="btn btn-ghost btn-sm" onClick={enablePush} disabled={pushStatus === 'working'}>
                {pushStatus === 'working' ? 'Setting up…' : 'Enable on this phone'}
              </button>
              {pushStatus === 'failed' && (
                <span className="reminder-warn">Couldn't turn on push here. Try again, or check notification settings.</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
