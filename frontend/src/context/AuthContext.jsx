import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, onSessionExpired } from '../api.js';

const AuthContext = createContext(null);

// The backend only stores email, so the display name lives in this browser.
const nameKey = (email) => `ra:name:${(email || '').toLowerCase()}`;
function readName(email) {
  try {
    return localStorage.getItem(nameKey(email)) || '';
  } catch {
    return '';
  }
}
function fallbackName(email) {
  const local = (email || 'there').split('@')[0].replace(/[._-]+/g, ' ');
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState(null);
  const [nameVersion, setNameVersion] = useState(0);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // The 15-minute inactivity timeout (FR-1.2) surfaces here as a clear message instead of silent 401s.
  useEffect(() => {
    onSessionExpired((message) => {
      setUser(null);
      setSessionMessage(message || 'Your session expired. Please log in again.');
    });
  }, []);

  const setName = useCallback((email, name) => {
    try {
      if (name) localStorage.setItem(nameKey(email), name);
      else localStorage.removeItem(nameKey(email));
    } catch {
      // storage blocked
    }
    setNameVersion((v) => v + 1);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    setUser(data.user);
    setSessionMessage(null);
    return data.user;
  }, []);

  const signup = useCallback(
    async (email, password, name) => {
      const data = await api.signup({ email, password });
      if (name) setName(data.user.email, name);
      setUser(data.user);
      setSessionMessage(null);
      return data.user;
    },
    [setName]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  // nameVersion forces a re-read after setName.
  void nameVersion;
  const displayName = user ? readName(user.email) || fallbackName(user.email) : '';

  return (
    <AuthContext.Provider
      value={{ user, loading, displayName, setName, login, signup, logout, sessionMessage, clearSessionMessage, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
