import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, onSessionExpired } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState(null);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // NFR: handle expired tokens gracefully — the 15-minute inactivity timeout
  // (FR-1.2) surfaces here as a clear message instead of silent 401s.
  useEffect(() => {
    onSessionExpired((message) => {
      setUser(null);
      setSessionMessage(message);
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    setSessionMessage(null);
    return data.user;
  }, []);

  const signup = useCallback(async (email, password) => {
    const data = await api.signup({ email, password });
    setUser(data.user);
    setSessionMessage(null);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, sessionMessage, clearSessionMessage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
