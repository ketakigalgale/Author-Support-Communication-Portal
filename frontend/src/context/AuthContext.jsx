import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('bookleaf_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('bookleaf_token');
    if (!token) {
      setReady(true);
      return;
    }
    authApi
      .me()
      .then((profile) => setUser((prev) => ({ ...prev, ...profile })))
      .catch(() => {
        localStorage.removeItem('bookleaf_token');
        localStorage.removeItem('bookleaf_user');
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const { token, user: loggedInUser } = await authApi.login(email, password);
    localStorage.setItem('bookleaf_token', token);
    localStorage.setItem('bookleaf_user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  };

  const logout = () => {
    localStorage.removeItem('bookleaf_token');
    localStorage.removeItem('bookleaf_user');
    setUser(null);
  };

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
