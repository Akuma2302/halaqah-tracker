import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import client, { getToken, setToken } from '../services/apiClient';
import socket from '../services/socket';
import { setupPushNotifications } from '../services/push';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  // Tracks whether real Web Push is confirmed working for this device, so the
  // in-tab fallback notification (below) only fires when push ISN'T live yet
  // — avoids showing a duplicate popup once push does start working, while
  // guaranteeing desktop still gets *something* if push setup fails for any
  // reason (missing VAPID keys on the backend, browser unsupported, etc.).
  const pushActiveRef = useRef(false);

  useEffect(() => {
    // No stored token = definitely logged out, skip the request entirely.
    if (!getToken()) {
      setLoading(false);
      return;
    }
    client
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      socket.connect();
      setupPushNotifications().then((success) => {
        pushActiveRef.current = success;
      });
    } else {
      socket.disconnect();
      pushActiveRef.current = false;
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

      // Fallback: only fires if real push isn't confirmed active on this
      // device. Once setupPushNotifications() succeeds, the service worker's
      // Web Push handler takes over and this is skipped to avoid duplicates.
      if (
        !pushActiveRef.current &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        document.hidden
      ) {
        try {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/favicon.svg',
            tag: notification._id
          });
        } catch {
          // Some browsers throw on `new Notification`; ignore.
        }
      }
    }

    socket.on('new-notification', onNewNotification);
    return () => socket.off('new-notification', onNewNotification);
  }, []);

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await client.post('/auth/google', { credential });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const res = await client.put('/auth/me', updates);
    setUser(res.data);
    return res.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, updateProfile, logout, unreadCount, setUnreadCount }}>
      {children}
    </AuthContext.Provider>
  );
}
