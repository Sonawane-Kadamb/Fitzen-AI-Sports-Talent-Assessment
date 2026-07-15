import { useEffect, useState, type FormEvent } from 'react';
import { Shell } from '../components/Shell';
import { Button, Chip } from '../components/ui';
import { api, type Settings } from '../lib/api';
import { getDeviceFingerprint } from '../lib/deviceKeys';
import { useAuth, useTheme, useToasts } from '../state/AppState';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { preference, setPreference } = useTheme();
  const { push } = useToasts();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [busy, setBusy] = useState(false);

  // profile form state
  const [sex, setSex] = useState<'male' | 'female'>(profile?.sex ?? 'male');
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '2010-01-01');
  const [heightCm, setHeightCm] = useState(String(profile?.heightCm ?? 165));
  const [massKg, setMassKg] = useState(String(profile?.massKg ?? 55));
  const [sport, setSport] = useState(profile?.sport ?? '');
  const [region, setRegion] = useState(profile?.region ?? '');

  useEffect(() => {
    api.getSettings().then(({ settings }) => setSettings(settings)).catch(() => undefined);
    getDeviceFingerprint().then(setFingerprint).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!profile) return;
    setSex(profile.sex);
    setBirthDate(profile.birthDate.slice(0, 10));
    setHeightCm(String(profile.heightCm));
    setMassKg(String(profile.massKg));
    setSport(profile.sport ?? '');
    setRegion(profile.region ?? '');
  }, [profile]);

  async function saveSettings(patch: Partial<Settings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await api.saveSettings(next);
    } catch {
      push('error', 'Could not save settings (offline?)');
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.saveProfile({
        sex, birthDate,
        heightCm: Number(heightCm), massKg: Number(massKg),
        sport: sport || undefined, region: region || undefined,
        coachId: profile?.coachId,
      });
      await refreshProfile();
      push('success', 'Profile saved.');
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Settings">
      <div className="fz-grid fz-grid--two">
        <section style={{ display: 'grid', gap: 'var(--space-4)', alignContent: 'start' }}>
          {user?.role === 'athlete' ? (
            <form className="fz-card" onSubmit={saveProfile}>
              <span className="fz-kicker">Athlete profile</span>
              <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                <div className="fz-field">
                  <label>Sex</label>
                  <div className="fz-segment">
                    <button type="button" className={sex === 'male' ? 'active' : ''} onClick={() => setSex('male')}>Male</button>
                    <button type="button" className={sex === 'female' ? 'active' : ''} onClick={() => setSex('female')}>Female</button>
                  </div>
                </div>
                <div className="fz-field">
                  <label htmlFor="s-dob">Date of birth</label>
                  <input id="s-dob" className="fz-input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="fz-field">
                    <label htmlFor="s-height">Height (cm)</label>
                    <input id="s-height" className="fz-input" type="number" min={80} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
                  </div>
                  <div className="fz-field">
                    <label htmlFor="s-mass">Weight (kg)</label>
                    <input id="s-mass" className="fz-input" type="number" min={20} max={250} value={massKg} onChange={(e) => setMassKg(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <div className="fz-field">
                    <label htmlFor="s-sport">Sport</label>
                    <input id="s-sport" className="fz-input" value={sport} onChange={(e) => setSport(e.target.value)} />
                  </div>
                  <div className="fz-field">
                    <label htmlFor="s-region">Region</label>
                    <input id="s-region" className="fz-input" value={region} onChange={(e) => setRegion(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</Button>
              </div>
            </form>
          ) : null}

          <div className="fz-card">
            <span className="fz-kicker">Device identity</span>
            <p style={{ color: 'var(--ink-mid)', fontSize: 'var(--text-sm)', margin: 'var(--space-3) 0' }}>
              Assessments captured on this device are signed with a locally-generated
              ECDSA key. The fingerprint below appears in every audit trail.
            </p>
            <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--accent)' }}>
              {fingerprint ? `⬡ ${fingerprint}` : 'generating…'}
            </code>
          </div>
        </section>

        <section style={{ display: 'grid', gap: 'var(--space-4)', alignContent: 'start' }}>
          <div className="fz-card">
            <span className="fz-kicker">Appearance</span>
            <div className="fz-field" style={{ marginTop: 'var(--space-3)' }}>
              <label>Theme</label>
              <div className="fz-segment">
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button key={t} className={preference === t ? 'active' : ''}
                    onClick={() => { setPreference(t); void saveSettings({ theme: t }); }}>
                    {t[0]!.toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {settings ? (
            <div className="fz-card" style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <span className="fz-kicker">Preferences</span>
              <ToggleRow
                label="Units"
                control={
                  <div className="fz-segment">
                    <button className={settings.units === 'metric' ? 'active' : ''} onClick={() => void saveSettings({ units: 'metric' })}>Metric</button>
                    <button className={settings.units === 'imperial' ? 'active' : ''} onClick={() => void saveSettings({ units: 'imperial' })}>Imperial</button>
                  </div>
                }
              />
              <ToggleRow
                label="Notifications"
                control={
                  <div className="fz-segment">
                    <button className={settings.notificationsEnabled ? 'active' : ''} onClick={() => void saveSettings({ notificationsEnabled: true })}>On</button>
                    <button className={!settings.notificationsEnabled ? 'active' : ''} onClick={() => void saveSettings({ notificationsEnabled: false })}>Off</button>
                  </div>
                }
              />
              <ToggleRow
                label="Appear on leaderboards"
                control={
                  <div className="fz-segment">
                    <button className={settings.leaderboardOptIn ? 'active' : ''} onClick={() => void saveSettings({ leaderboardOptIn: true })}>Yes</button>
                    <button className={!settings.leaderboardOptIn ? 'active' : ''} onClick={() => void saveSettings({ leaderboardOptIn: false })}>No</button>
                  </div>
                }
              />
            </div>
          ) : null}

          <div className="fz-card">
            <span className="fz-kicker">Account</span>
            <div style={{ marginTop: 'var(--space-3)', display: 'grid', gap: 'var(--space-2)', fontSize: 'var(--text-sm)', color: 'var(--ink-mid)' }}>
              <div>{user?.name} · <Chip tone="accent">{user?.role}</Chip></div>
              <div>{user?.email}</div>
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}

function ToggleRow({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{label}</span>
      {control}
    </div>
  );
}
