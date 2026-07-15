import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppStateProvider, useAuth } from './state/AppState';

const AuthPage = lazy(() => import('./pages/Auth'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const AssessPage = lazy(() => import('./pages/Assess'));
const HistoryPage = lazy(() => import('./pages/History'));
const LeaderboardPage = lazy(() => import('./pages/Leaderboard'));
const BadgesPage = lazy(() => import('./pages/Badges'));
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const TeamPage = lazy(() => import('./pages/Team'));

function Protected({ children, roles }: { children: ReactNode; roles?: Array<'athlete' | 'coach' | 'admin'> }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-mid)' }}>
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <AuthPage />;
}

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
            <Route path="/assess" element={<Protected roles={['athlete']}><AssessPage /></Protected>} />
            <Route path="/history" element={<Protected roles={['athlete']}><HistoryPage /></Protected>} />
            <Route path="/leaderboard" element={<Protected><LeaderboardPage /></Protected>} />
            <Route path="/badges" element={<Protected roles={['athlete']}><BadgesPage /></Protected>} />
            <Route path="/notifications" element={<Protected><NotificationsPage /></Protected>} />
            <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
            <Route path="/team" element={<Protected roles={['coach', 'admin']}><TeamPage /></Protected>} />
            <Route path="/team/:athleteId" element={<Protected roles={['coach', 'admin']}><TeamPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppStateProvider>
  );
}
