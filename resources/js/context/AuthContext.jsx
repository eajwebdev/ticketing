import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setToken, getToken } from '@/lib/api';
import { resetEcho } from '@/lib/echo';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/me');
      setUser(data.data ?? data);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user.data ?? data.user);
    return data.user.data ?? data.user;
  };

  // Google ID token → either signed in, or a new account awaiting approval.
  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/auth/google', { credential });
    if (data.token) {
      setToken(data.token);
      setUser(data.user.data ?? data.user);
      return { approved: true };
    }
    return { approved: false, message: data.message };
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    // Self-registration now requires admin approval — no token is issued yet.
    if (data.token) {
      setToken(data.token);
      setUser(data.user.data ?? data.user);
      return { approved: true };
    }
    return { approved: false, message: data.message };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
    resetEcho();
  };

  const updateUser = (updated) => setUser(updated.data ?? updated);

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, updateUser, reload: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
