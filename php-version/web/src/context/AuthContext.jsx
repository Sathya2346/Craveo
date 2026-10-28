import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { getApiError, getToken, setToken, setUnauthorizedHandler } from '../lib/api.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('craveo:cart');
    localStorage.removeItem('craveo:favourites');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
    });
  }, []);

  useEffect(() => {
    let active = true;
    if (!getToken()) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    api
      .get('/auth/me')
      .then((response) => {
        if (active) setUser(response.data.data.user);
      })
      .catch(() => {
        if (active) setToken(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      setToken(response.data.data.token);
      setUser(response.data.data.user);
      return { ok: true, user: response.data.data.user, message: response.data.message };
    } catch (error) {
      return { ok: false, ...getApiError(error) };
    }
  }, []);

  const register = useCallback(async (payload) => {
    try {
      const response = await api.post('/auth/register', payload);
      setToken(response.data.data.token);
      setUser(response.data.data.user);
      return { ok: true, user: response.data.data.user, message: response.data.message };
    } catch (error) {
      return { ok: false, ...getApiError(error) };
    }
  }, []);

  const updateProfile = useCallback(async (payload) => {
    try {
      const response = await api.patch('/auth/me', payload);
      setUser(response.data.data.user);
      return { ok: true, user: response.data.data.user, message: response.data.message };
    } catch (error) {
      return { ok: false, ...getApiError(error) };
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.data.user);
      return response.data.data;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isStaff: user?.role === 'ADMIN' || user?.role === 'MANAGER',
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      updateProfile,
      refresh,
      setUser,
    }),
    [user, loading, login, register, logout, updateProfile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
