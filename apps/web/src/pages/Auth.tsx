import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth, useToasts } from '../state/AppState';
import { api } from '../lib/api';

type Mode = 'login' | 'register' | 'profile';

export default function AuthPage() {
  const { login, register, refreshProfile, user } = useAuth();
  const { push } = useToasts();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // login/register fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'athlete' | 'coach'>('athlete');

  // profile fields
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [birthDate, setBirthDate] = useState('2010-01-01');
  const [heightCm, setHeightCm] = useState('165');
  const [massKg, setMassKg] = useState('55');
  const [sport, setSport] = useState('');
  const [region, setRegion] = useState('');

  async function submitAuth(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        const u = await login(email, password);
        navigate(u.role === 'athlete' ? '/dashboard' : '/dashboard');
      } else {
        const u = await register({ email, password, name, role });
        if (u.role === 'athlete') setMode('profile');
        else navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.saveProfile({
        sex,
        birthDate,
        heightCm: Number(heightCm),
        massKg: Number(massKg),
        sport: sport || undefined,
        region: region || undefined,
      });
      await refreshProfile();
      push('success', `Welcome to Fitzen, ${user?.name ?? 'athlete'}!`);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fz-auth">
      <section className="fz-auth__hero">
        <div className="fz-logo" style={{ color: '#f2f4f8' }}>
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
            <rect width="32" height="32" rx="8" fill="rgba(255,255,255,0.06)" />
            <path d="M9 24 L16 7 L19 15 L23 15" stroke="#c8f135" strokeWidth="3"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Fitzen
        </div>
        <div>
          <h2>Talent is everywhere. <em>Now measurement is too.</em></h2>
          <p>
            Fitzen turns any smartphone into a sports science lab: verified vertical-jump
            testing with on-device AI pose tracking, cryptographically signed results, and
            explainable potential scoring — online or off.
          </p>
        </div>
        <div className="fz-feature-row">
          <div>
            <h4>On-device AI</h4>
            <p>Pose tracking runs locally. No video ever leaves the phone.</p>
          </div>
          <div>
            <h4>Tamper-proof</h4>
            <p>Every result is signed and hash-chained on capture.</p>
          </div>
          <div>
            <h4>Offline-first</h4>
            <p>Assess anywhere; results sync when you reconnect.</p>
          </div>
        </div>
      </section>

      <section className="fz-auth__panel">
        {mode !== 'profile' ? (
          <form className="fz-auth__form fz-animate-in" onSubmit={submitAuth}>
            <div>
              <span className="fz-kicker">{mode === 'login' ? 'Welcome back' : 'Create account'}</span>
              <h2 style={{ marginTop: 4 }}>
                {mode === 'login' ? 'Sign in to Fitzen' : 'Join Fitzen'}
              </h2>
            </div>

            {mode === 'register' ? (
              <>
                <div className="fz-field">
                  <label htmlFor="auth-name">Full name</label>
                  <input id="auth-name" className="fz-input" value={name} required
                    onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </div>
                <div className="fz-field">
                  <label>I am a</label>
                  <div className="fz-segment">
                    <button type="button" className={role === 'athlete' ? 'active' : ''} onClick={() => setRole('athlete')}>Athlete</button>
                    <button type="button" className={role === 'coach' ? 'active' : ''} onClick={() => setRole('coach')}>Coach</button>
                  </div>
                </div>
              </>
            ) : null}

            <div className="fz-field">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" className="fz-input" type="email" value={email} required
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="fz-field">
              <label htmlFor="auth-password">Password</label>
              <input id="auth-password" className="fz-input" type="password" value={password} required minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            {error ? <div className="fz-error" role="alert">{error}</div> : null}

            <Button size="lg" type="submit" disabled={busy}>
              {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--ink-mid)', cursor: 'pointer', fontSize: 'var(--text-sm)' }}
            >
              {mode === 'login' ? "New to Fitzen? Create an account" : 'Already have an account? Sign in'}
            </button>
          </form>
        ) : (
          <form className="fz-auth__form fz-animate-in" onSubmit={submitProfile}>
            <div>
              <span className="fz-kicker">Step 2 of 2</span>
              <h2 style={{ marginTop: 4 }}>Athlete profile</h2>
              <p style={{ color: 'var(--ink-mid)', fontSize: 'var(--text-sm)', marginTop: 6 }}>
                Height calibrates the camera; mass powers the physics. Accuracy here means
                accuracy everywhere.
              </p>
            </div>
            <div className="fz-field">
              <label>Sex</label>
              <div className="fz-segment">
                <button type="button" className={sex === 'male' ? 'active' : ''} onClick={() => setSex('male')}>Male</button>
                <button type="button" className={sex === 'female' ? 'active' : ''} onClick={() => setSex('female')}>Female</button>
              </div>
            </div>
            <div className="fz-field">
              <label htmlFor="p-dob">Date of birth</label>
              <input id="p-dob" className="fz-input" type="date" value={birthDate} required
                onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="fz-field">
                <label htmlFor="p-height">Height (cm)</label>
                <input id="p-height" className="fz-input" type="number" min={80} max={250} value={heightCm} required
                  onChange={(e) => setHeightCm(e.target.value)} />
              </div>
              <div className="fz-field">
                <label htmlFor="p-mass">Weight (kg)</label>
                <input id="p-mass" className="fz-input" type="number" min={20} max={250} value={massKg} required
                  onChange={(e) => setMassKg(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="fz-field">
                <label htmlFor="p-sport">Sport</label>
                <input id="p-sport" className="fz-input" value={sport} placeholder="Basketball"
                  onChange={(e) => setSport(e.target.value)} />
              </div>
              <div className="fz-field">
                <label htmlFor="p-region">Region</label>
                <input id="p-region" className="fz-input" value={region} placeholder="Maharashtra"
                  onChange={(e) => setRegion(e.target.value)} />
              </div>
            </div>
            {error ? <div className="fz-error" role="alert">{error}</div> : null}
            <Button size="lg" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Start assessing'}
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
