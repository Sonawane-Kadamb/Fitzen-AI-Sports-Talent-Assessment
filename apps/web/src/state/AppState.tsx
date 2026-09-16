/**
 * Global app state: authentication, theme, toasts, and sync status.
 * Deliberately context-based — the state surface is small and stable.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken, type Profile, type User } from '../lib/api';
import { startSyncLoop, subscribeSync, type SyncState } from '../lib/sync';
import { supabase } from '../lib/supabaseClient';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { email: string; password: string; name: string; role?: 'athlete' | 'coach' }) => Promise<User>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const THEME_KEY = 'fitzen.theme';

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: Toast['kind'], message: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastState | null>(null);

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

const SyncContext = createContext<SyncState>({
  pending: 0, syncing: false, lastSyncAt: null, online: true,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children: ReactNode }) {
  // --- auth ---
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(({ user, profile }) => {
        setUser(user);
        setProfile(profile);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    // 1. Authenticate with Supabase Cloud Auth
    try {
      await supabase.auth.signInWithPassword({ email, password });
    } catch (e) {
      console.warn('Supabase Auth sync deferred:', e);
    }

    // 2. Authenticate with Fitzen API
    const { user, token } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    const { profile } = await api.me();
    setProfile(profile);
    return user;
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; name: string; role?: 'athlete' | 'coach' }) => {
      // 1. Register with Supabase Cloud Auth (triggers public.profiles sync)
      try {
        await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: { data: { full_name: input.name, role: input.role ?? 'athlete' } },
        });
      } catch (e) {
        console.warn('Supabase Auth signup deferred:', e);
      }

      // 2. Register with Fitzen API
      const { user, token } = await api.register(input);
      setToken(token);
      setUser(user);
      setProfile(null);
      return user;
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const { user, profile } = await api.me();
    setUser(user);
    setProfile(profile);
  }, []);

  const logout = useCallback(() => {
    void supabase.auth.signOut();
    setToken(null);
    setUser(null);
    setProfile(null);
  }, []);

  // --- theme ---
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => (localStorage.getItem(THEME_KEY) as ThemePreference) || 'dark',
  );
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveTheme(preference));

  useEffect(() => {
    const apply = () => {
      const mode = resolveTheme(preference);
      setResolved(mode);
      document.documentElement.dataset.theme = mode;
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: light)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    localStorage.setItem(THEME_KEY, p);
    setPreferenceState(p);
  }, []);

  // --- toasts ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = nextId.current++;
    setToasts((cur) => [...cur.slice(-3), { id, kind, message }]);
    window.setTimeout(() => dismiss(id), 4500);
  }, [dismiss]);

  // --- sync ---
  const [syncState, setSyncState] = useState<SyncState>({
    pending: 0, syncing: false, lastSyncAt: null, online: navigator.onLine,
  });
  useEffect(() => {
    startSyncLoop();
    return subscribeSync(setSyncState);
  }, []);

  const authValue = useMemo(
    () => ({ user, profile, loading, login, register, refreshProfile, logout }),
    [user, profile, loading, login, register, refreshProfile, logout],
  );
  const themeValue = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
  const toastValue = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <AuthContext.Provider value={authValue}>
      <ThemeContext.Provider value={themeValue}>
        <ToastContext.Provider value={toastValue}>
          <SyncContext.Provider value={syncState}>{children}</SyncContext.Provider>
        </ToastContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AppStateProvider');
  return ctx;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside AppStateProvider');
  return ctx;
}

export function useToasts(): ToastState {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToasts must be used inside AppStateProvider');
  return ctx;
}

export function useSync(): SyncState {
  return useContext(SyncContext);
}
