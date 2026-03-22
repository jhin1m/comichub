'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '@/lib/api/auth.api';
import { setAccessToken, clearTokens } from '@/lib/api-client';
import type { AuthUser, LoginForm, RegisterForm } from '@/types/auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginForm) => Promise<void>;
  register: (data: RegisterForm) => Promise<void>;
  logout: () => Promise<void>;
  setTokensFromOAuth: (accessToken: string, refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const refreshToken = typeof window !== 'undefined'
        ? localStorage.getItem('refreshToken')
        : null;
      if (!refreshToken) return;

      const { default: axios } = await import('axios');
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';
      const { data: envelope } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const tokens = envelope?.data ?? envelope;
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new Error('Invalid token response');
      }
      setAccessToken(tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      const me = await authApi.me();
      setUser(me);
    } catch {
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = async (data: LoginForm) => {
    const tokens = await authApi.login(data);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
  };

  const register = async (data: RegisterForm) => {
    const tokens = await authApi.register(data);
    setAccessToken(tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    const me = await authApi.me();
    setUser(me);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const setTokensFromOAuth = async (accessToken: string, refreshToken: string) => {
    setAccessToken(accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    const me = await authApi.me();
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setTokensFromOAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
