'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '@/lib/api/auth.api';
import { setAccessToken, clearTokens } from '@/lib/api-client';
import { refreshTokens } from '@/lib/auth-refresh';
import type { AuthUser, LoginForm, RegisterForm } from '@/types/auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginForm) => Promise<void>;
  register: (data: RegisterForm) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setTokensFromOAuth: (accessToken: string, refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      if (!localStorage.getItem('refreshToken')) return;

      await refreshTokens();
      const me = await authApi.me();
      setUser(me);
    } catch {
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip on OAuth callback — exchangeGoogleCode will own auth. Running
    // restoreSession here races with /auth/google/exchange (both rotate the
    // single refresh-tokens row) and triggers H3 reuse detection.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback')) {
      setLoading(false);
      return;
    }
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (data: LoginForm) => {
    const tokens = await authApi.login(data);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const register = useCallback(async (data: RegisterForm) => {
    const tokens = await authApi.register(data);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const setTokensFromOAuth = useCallback(async (accessToken: string, refreshToken: string) => {
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const value = useMemo(() => ({
    user, loading, login, register, logout, restoreSession, setTokensFromOAuth,
  }), [user, loading, login, register, logout, restoreSession, setTokensFromOAuth]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
