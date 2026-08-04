import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Bell, Users, Calendar, Clock, MessageCircle } from 'lucide-react';
import client from '../services/apiClient';
import socket from '../services/socket';
import { useAuth } from '../hooks/useAuth';

dayjs.extend(relativeTime);

const ICONS = {
  reminder: Clock,
  group_invite: Users,
  session_scheduled: Calendar,
  message: MessageCircle
};

export default function Notifications() {
  const { setUnreadCount } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">Reminders, invites, messages, and scheduled sessions</p>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : notifications.length === 0 ? (
        <div className="card empty-state">
          <Bell size={26} style={{ marginBottom: 8, color: 'var(--ink-soft)' }} />
          <h3>You're all caught up</h3>
          <p>Nothing new right now.</p>
        </div>
      ) : (
        <div className="card">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <div className={`notif-item${n.isRead ? ' read' : ''}`} key={n._id} onClick={() => markRead(n)}>
                <span className="notif-dot" />
                <div style={{ flex: 1 }}>
                  <div className="notif-title">
                    <Icon size={13} style={{ verticalAlign: -2, marginRight: 5, color: 'var(--ink-soft)' }} />
                    {n.title}
                  </div>
                  {n.body && <div className="notif-body">{n.body}</div>}
                  <div className="notif-time">{dayjs(n.createdAt).fromNow()}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
