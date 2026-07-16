'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import api from '@/lib/api';
import type { User } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  getToken: () => string | null;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Token storage keys ────────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const USER_KEY = 'user';

// ─── Helper: decode JWT payload without a library ──────────────────────────────

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isLoading: true,
  });

  // Load saved auth state from localStorage on mount
  useEffect(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (accessToken && savedUser) {
      const user = JSON.parse(savedUser) as User;

      // Check if token is expired
      const payload = decodeJwtPayload(accessToken);
      const isExpired = payload?.exp && payload.exp * 1000 < Date.now();

      if (isExpired && refreshToken) {
        // Try refreshing
        refreshAccessToken(refreshToken);
      } else if (!isExpired) {
        setState({ user, accessToken, isLoading: false });
      } else {
        // Expired and no refresh token — clear
        clearAuth();
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  // Auto-refresh: schedule a refresh before the token expires
  useEffect(() => {
    if (!state.accessToken) return;

    const payload = decodeJwtPayload(state.accessToken);
    if (!payload?.exp) return;

    const expiresIn = payload.exp * 1000 - Date.now();
    // Refresh 60 seconds before expiry
    const refreshIn = Math.max(expiresIn - 60_000, 0);

    const timeout = setTimeout(() => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        refreshAccessToken(refreshToken);
      }
    }, refreshIn);

    return () => clearTimeout(timeout);
  }, [state.accessToken]);

  async function refreshAccessToken(refreshToken: string) {
    try {
      const result = await api.refreshToken(refreshToken);
      const newAccessToken = result.accessToken;
      const user = result.user;

      localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      setState({ user, accessToken: newAccessToken, isLoading: false });
    } catch {
      clearAuth();
    }
  }

  function clearAuth() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, accessToken: null, isLoading: false });
  }

  const login = useCallback(
    (accessToken: string, refreshToken: string, user: User) => {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState({ user, accessToken, isLoading: false });
    },
    []
  );

  const logout = useCallback(() => {
    clearAuth();
  }, []);

  const getToken = useCallback(() => {
    return state.accessToken;
  }, [state.accessToken]);

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    isAuthenticated: !!state.user,
    isAdmin: state.user?.role === 'ADMIN',
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
