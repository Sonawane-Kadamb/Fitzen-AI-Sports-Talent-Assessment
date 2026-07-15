import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, useSync, useToasts } from '../state/AppState';
import { initials } from '../lib/format';

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 8h8V3h-8z',
  assess: 'M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-5.5L15 9m-6 6-2.5 2.5m0-11L9 9m6 6 2.5 2.5M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  history: 'M12 8v5l3 2M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.7L21 8m0-5v5h-5',
  leaderboard: 'M8 21V10M12 21V3m4 18v-7M4 21h16',
  badges: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm-3.5-1.5L7 21l5-2.4L17 21l-1.5-7.5',
  team: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2m22 0v-2a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5L9 5.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2L9.5 21h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
};

export function Shell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { user, logout } = useAuth();
  const sync = useSync();
  const { toasts, dismiss } = useToasts();
  const navigate = useNavigate();

  const isAthlete = user?.role === 'athlete';
  const isCoach = user?.role === 'coach';
  const isAdmin = user?.role === 'admin';

  const syncLabel = !sync.online
    ? `Offline · ${sync.pending} queued`
    : sync.syncing
      ? 'Syncing…'
      : sync.pending > 0
        ? `${sync.pending} queued`
        : 'Synced';
  const syncClass = !sync.online
    ? 'fz-syncpill fz-syncpill--offline'
    : sync.syncing
      ? 'fz-syncpill fz-syncpill--syncing'
      : 'fz-syncpill';

  return (
    <div className="fz-shell">
      <aside className="fz-sidebar">
        <div className="fz-logo">
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="8" fill="var(--ink)" opacity="0.06" />
            <path d="M9 24 L16 7 L19 15 L23 15" stroke="var(--volt)" strokeWidth="3"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Fitzen
        </div>

        <nav className="fz-nav" aria-label="Primary">
          <NavLink to="/dashboard"><Icon d={ICONS.dashboard} />Dashboard</NavLink>
          {isAthlete && <NavLink to="/assess"><Icon d={ICONS.assess} />Assess</NavLink>}
          {isAthlete && <NavLink to="/history"><Icon d={ICONS.history} />History</NavLink>}
          <NavLink to="/leaderboard"><Icon d={ICONS.leaderboard} />Leaderboard</NavLink>
          {isAthlete && <NavLink to="/badges"><Icon d={ICONS.badges} />Badges</NavLink>}
          {(isCoach || isAdmin) && <NavLink to="/team"><Icon d={ICONS.team} />Team</NavLink>}
          <NavLink to="/settings"><Icon d={ICONS.settings} />Settings</NavLink>
        </nav>

        <div className="fz-sidebar__footer">
          <span className={syncClass}><span className="fz-syncpill__dot" />{syncLabel}</span>
          <button
            className="fz-btn fz-btn--ghost"
            onClick={() => { logout(); navigate('/'); }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="fz-main">
        <header className="fz-topbar">
          <h1>{title}</h1>
          <div className="fz-topbar__actions">
            {actions}
            <NavLink to="/notifications" aria-label="Notifications" className="fz-btn fz-btn--ghost" style={{ padding: '0.5rem 0.7rem' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </NavLink>
            <div className="fz-avatar" title={user?.name}>{user ? initials(user.name) : '·'}</div>
          </div>
        </header>
        {children}
      </main>

      <div className="fz-toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`fz-toast fz-toast--${toast.kind}`} onClick={() => dismiss(toast.id)}>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
