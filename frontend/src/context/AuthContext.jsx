import { createContext, useEffect, useState, useCallback } from 'react';
import client from '../services/apiClient';
import socket from '../services/socket';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    client
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      socket.connect();
      // Ask once per session — browsers remember the choice after that, and
      // silently no-op on unsupported browsers instead of throwing.
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } else {
      socket.disconnect();
    }
    return () => socket.disconnect();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    client
      .get('/notifications')
      .then((res) => setUnreadCount(res.data.filter((n) => !n.isRead).length))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    function onNewNotification(notification) {
      setUnreadCount((c) => c + 1);

      // Native "this device" notification, same as any other app —
      // only fires if the user granted permission and the tab isn't focused.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        try {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/favicon.svg',
            tag: notification._id
          });
        } catch {
          // Some browsers (notably iOS Safari PWA-less) throw on `new Notification`; ignore.
        }
      }
    }

    socket.on('new-notification', onNewNotification);
    return () => socket.off('new-notification', onNewNotification);
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await client.post('/auth/google', { credential });
    setUser(res.data);
    return res.data;
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const res = await client.put('/auth/me', updates);
    setUser(res.data);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    await client.post('/auth/logout');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, updateProfile, logout, unreadCount, setUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}
