import { createContext, useEffect, useState, useCallback } from 'react';
import client from '../services/apiClient';
import socket from '../services/socket';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

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
    } else {
      socket.disconnect();
    }
    return () => socket.disconnect();
  }, [user]);

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
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
