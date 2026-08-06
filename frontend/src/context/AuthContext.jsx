import { createContext, useEffect, useState, useCallback } from 'react';
import client, { getToken, setToken } from '../services/apiClient';
import socket from '../services/socket';
import { setupPushNotifications } from '../services/push';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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
      // Real OS-level push (works even if the app isn't open) — see
      // services/push.js. Replaces the old plain Notification.requestPermission()
      // call, which only ever worked while a tab was open.
      setupPushNotifications();
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
    function onNewNotification() {
      // The OS-level popup itself now comes from the service worker's real
      // Web Push handler (services/push.js + service-worker.js), which fires
      // independently of whether this tab is open. Calling `new Notification()`
      // here too would show a duplicate popup on any device with push already
      // subscribed — so this listener only needs to keep the in-app badge live.
      setUnreadCount((c) => c + 1);
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