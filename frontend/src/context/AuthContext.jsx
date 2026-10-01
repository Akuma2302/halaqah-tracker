import { createContext, useEffect, useState, useCallback, useRef } from 'react';
import client, { getToken, setToken } from '../services/apiClient';
import socket from '../services/socket';
import { setupPushNotifications } from '../services/push';

export const AuthContext = createContext(null);

// The last /auth/me result, so a returning user sees the app instantly instead
// of a blank spinner while the Render free-tier backend cold-starts (~20-60s).
const USER_CACHE_KEY = 'mutabaah_user';

function readCachedUser() {
  if (!getToken()) return null;
  try {
    return JSON.parse(localStorage.getItem(USER_CACHE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readCachedUser);
  const [loading, setLoading] = useState(() => !!getToken() && !readCachedUser());
  // False until the backend has answered once — lets the UI say "waking up the
  // server" rather than looking frozen.
  const [serverReady, setServerReady] = useState(false);
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
      .catch((err) => {
        // Only an explicit auth rejection means the session is gone. A network
        // error or timeout while the server wakes up shouldn't log anyone out.
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        setServerReady(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  }, [user]);

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
    setServerReady(true);
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
    <AuthContext.Provider
      value={{ user, loading, serverReady, loginWithGoogle, updateProfile, logout, unreadCount, setUnreadCount }}
    >
      {children}
    </AuthContext.Provider>
  );
}
