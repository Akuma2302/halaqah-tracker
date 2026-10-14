import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AlarmClock, Bell, CalendarClock, CheckCheck, MessageCircle, Users } from 'lucide-react';
import client from '../services/apiClient';
import socket from '../services/socket';
import { useAuth } from '../hooks/useAuth';
import MutabaahReminderCard from '../components/MutabaahReminderCard';
import { NotificationsSkeleton } from '../components/PageSkeletons';

dayjs.extend(relativeTime);

// Every notification type falls into one of these, which is how the list is
// filtered and coloured.
const CATEGORIES = [
  {
    key: 'exam',
    label: 'Exams & due',
    icon: CalendarClock,
    types: ['exam_alert', 'deadline_reminder', 'mentee_exam'],
    empty: 'No exam or due-date reminders yet.'
  },
  { key: 'reminder', label: 'Reminders', icon: AlarmClock, types: ['reminder'], empty: 'No reminders yet.' },
  { key: 'group', label: 'Groups', icon: Users, types: ['group_invite', 'session_scheduled'], empty: 'No group invites or sessions yet.' },
  { key: 'message', label: 'Messages', icon: MessageCircle, types: ['message'], empty: 'No messages yet.' }
];
const CATEGORY_OF = Object.fromEntries(CATEGORIES.flatMap((c) => c.types.map((t) => [t, c])));
const OTHER = { key: 'other', icon: Bell };

// "Today", "Yesterday" or "Earlier", for the headings in the list.
function dayGroup(createdAt) {
  const days = dayjs().startOf('day').diff(dayjs(createdAt).startOf('day'), 'day');
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : 'Earlier';
}

export default function Notifications() {
  const { setUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    client
      .get('/notifications')
      .then((res) => {
        setNotifications(res.data);
        setUnreadCount(res.data.filter((n) => !n.isRead).length);
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, [setUnreadCount]);

  // Live-prepend messages/reminders that arrive while this page is open,
  // instead of only picking them up on next visit/refresh.
  useEffect(() => {
    function onNewNotification(notification) {
      setNotifications((prev) => [notification, ...prev]);
    }
    socket.on('new-notification', onNewNotification);
    return () => socket.off('new-notification', onNewNotification);
  }, []);

  async function markRead(n) {
    if (n.isRead) return;
    setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await client.patch(`/notifications/${n._id}/read`);
    } catch {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: false } : x)));
      setUnreadCount((c) => c + 1);
    }
  }

  async function markAllRead() {
    const before = notifications;
    const unreadBefore = before.filter((n) => !n.isRead).length;
    setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnreadCount(0);
    try {
      await client.patch('/notifications/read-all');
    } catch {
      setNotifications(before);
      setUnreadCount(unreadBefore);
    }
  }

  const unread = notifications.filter((n) => !n.isRead).length;
  const unreadIn = (category) => notifications.filter((n) => !n.isRead && category.types.includes(n.type)).length;
  const active = CATEGORIES.find((c) => c.key === filter);
  const shown = active ? notifications.filter((n) => active.types.includes(n.type)) : notifications;

  // Newest first already; split under Today / Yesterday / Earlier.
  const groups = useMemo(() => {
    const out = [];
    shown.forEach((n) => {
      const label = dayGroup(n.createdAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    });
    return out;
  }, [shown]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unread > 0 ? `${unread} unread` : "You're all caught up"}</p>
        </div>
        {unread > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="notif-filters" role="tablist" aria-label="Kind of notification">
        <button type="button" role="tab" aria-selected={filter === 'all'} className={`notif-filter${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>
          All
          {unread > 0 && <span className="notif-count">{unread}</span>}
        </button>
        {CATEGORIES.map((c) => {
          const count = unreadIn(c);
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              className={`notif-filter${filter === c.key ? ' active' : ''}`}
              onClick={() => setFilter(c.key)}
            >
              <c.icon size={13} />
              {c.label}
              {count > 0 && <span className="notif-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <NotificationsSkeleton />
      ) : shown.length === 0 ? (
        <div className="card empty-state notif-empty">
          {(() => {
            const Icon = active?.icon || Bell;
            return <Icon size={24} />;
          })()}
          <h3>{active ? active.empty : 'Nothing here yet'}</h3>
          {!active && <p>Reminders, exam alerts, group invites and messages will show up here.</p>}
        </div>
      ) : (
        groups.map((g) => (
          <div className="notif-group" key={g.label}>
            <div className="notif-group-title">{g.label}</div>
            <div className="card notif-list">
              {g.items.map((n) => {
                const category = CATEGORY_OF[n.type] || OTHER;
                const Icon = category.icon;
                return (
                  <button type="button" className={`notif-item tone-${category.key}${n.isRead ? ' read' : ''}`} key={n._id} onClick={() => markRead(n)}>
                    <span className="notif-icon">
                      <Icon size={16} />
                    </span>
                    <span className="notif-text">
                      <span className="notif-title">{n.title}</span>
                      {n.body && <span className="notif-body">{n.body}</span>}
                      <span className="notif-time">{dayjs(n.createdAt).fromNow()}</span>
                    </span>
                    {!n.isRead && <span className="notif-dot" aria-label="Unread" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}

      <div className="notif-group-title notif-settings-title">Reminder settings</div>
      <MutabaahReminderCard />
    </div>
  );
}
