import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { Chip, EmptyState, ProgressRing, Skeleton, Stat, Meter } from '../components/ui';
import { TrendChart, Bars } from '../components/charts';
import { api, OfflineError, type AssessmentRecord, type AthleteStats, type CoachingBrief, type PotentialResult } from '../lib/api';
import { cacheGet, cachePut } from '../lib/idb';
import { formatHeight, formatDate } from '../lib/format';
import { useAuth } from '../state/AppState';

interface DashboardData {
  stats: AthleteStats;
  potential: PotentialResult | null;
  assessments: AssessmentRecord[];
  brief: CoachingBrief | null;
}

async function loadDashboard(): Promise<DashboardData> {
  try {
    const [{ stats, potential }, { assessments }] = await Promise.all([
      api.stats(),
      api.listAssessments(),
    ]);
    let brief: CoachingBrief | null = null;
    try {
      brief = (await api.aiBrief()).brief;
    } catch { /* brief is enhancement-only */ }
    const data = { stats, potential, assessments, brief };
    await cachePut('dashboard', data);
    return data;
  } catch (err) {
    if (err instanceof OfflineError) {
      const cached = await cacheGet<DashboardData>('dashboard');
      if (cached) return cached.value;
    }
    throw err;
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  if (user?.role !== 'athlete') return <NonAthleteDashboard />;
  return <AthleteDashboard />;
}

function AthleteDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard().then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, []);

  if (error) {
    return (
      <Shell title="Dashboard">
        <EmptyState title="Couldn't load your dashboard" body={error} />
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell title="Dashboard">
        <div className="fz-grid fz-grid--stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="fz-card" key={i}><Skeleton height={64} /></div>
          ))}
        </div>
      </Shell>
    );
  }

  const { stats, potential, assessments, brief } = data;
  const verified = assessments.filter((a) => a.integrity === 'verified');
  const series = [...verified]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((a) => ({
      x: new Date(a.capturedAt).getTime(),
      y: a.metrics.jumpHeightM * 100,
      ciLow: a.metrics.jumpHeightCiLow * 100,
      ciHigh: a.metrics.jumpHeightCiHigh * 100,
      label: formatDate(a.capturedAt),
    }));

  const firstName = user?.name.split(' ')[0] ?? 'Athlete';

  return (
    <Shell
      title={`Hey, ${firstName}`}
      actions={<Link to="/assess" className="fz-btn fz-btn--primary">New assessment</Link>}
    >
      {stats.assessmentCount === 0 ? (
        <EmptyState
          title="Your baseline is waiting"
          body="Run your first camera assessment to unlock stats, potential scoring and the leaderboard."
          action={<Link to="/assess" className="fz-btn fz-btn--primary fz-btn--lg">Start first assessment</Link>}
        />
      ) : (
        <>
          <div className="fz-grid fz-grid--stats fz-animate-in">
            <div className="fz-card"><Stat label="Personal best" value={formatHeight(stats.bestJumpHeightM)} accent sub="vertical jump" /></div>
            <div className="fz-card"><Stat label="Relative power" value={`${stats.bestRelativePowerWkg.toFixed(1)}`} sub="W/kg peak" /></div>
            <div className="fz-card"><Stat label="Assessments" value={stats.assessmentCount} sub={`${stats.activeDays} active days`} /></div>
            <div className="fz-card"><Stat label="Streak" value={`${stats.streakDays}d`} sub={stats.streakDays >= 3 ? 'keep it alive' : 'build momentum'} /></div>
          </div>

          <div className="fz-section-title"><h2>Jump height trend</h2><Chip>95% confidence band</Chip></div>
          <div className="fz-card fz-card--flush" style={{ padding: 'var(--space-4)' }}>
            {series.length >= 2
              ? <TrendChart points={series} yFormat={(v) => `${v.toFixed(0)}cm`} ariaLabel="Jump height over time" />
              : <EmptyState title="Two assessments unlock the trend" body="Come back after your next jump." />}
          </div>

          <div className="fz-grid fz-grid--two" style={{ marginTop: 'var(--space-5)' }}>
            <section className="fz-card">
              <span className="fz-kicker">Potential analysis</span>
              {potential ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-around', margin: 'var(--space-5) 0' }}>
                    <ProgressRing value={potential.currentPerformance} label="Current" />
                    <ProgressRing value={potential.potentialScore} label="Potential" />
                    <ProgressRing value={potential.confidenceScore} label="Confidence" />
                  </div>
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    <Meter label="Explosiveness" value={potential.components.explosiveness} />
                    <Meter label="Movement quality" value={potential.components.movementQuality} />
                    <Meter label="Consistency" value={potential.components.consistency} />
                    <Meter label="Maturity headroom" value={potential.components.maturityHeadroom} />
                  </div>
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    {potential.insights.slice(0, 3).map((insight) => (
                      <div key={insight.factor + insight.message} className={`fz-insight fz-insight--${insight.kind}`}>
                        <div className="fz-insight__icon" aria-hidden>
                          {insight.kind === 'strength' ? '▲' : insight.kind === 'opportunity' ? '◆' : '●'}
                        </div>
                        <div>
                          <strong>{insight.factor}</strong>
                          <p>{insight.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ color: 'var(--ink-mid)', marginTop: 'var(--space-3)' }}>
                  Potential scoring unlocks after your first verified assessment.
                </p>
              )}
            </section>

            <section style={{ display: 'grid', gap: 'var(--space-4)', alignContent: 'start' }}>
              {brief ? (
                <div className="fz-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="fz-kicker">Coach's brief</span>
                    <Chip tone="accent">{brief.source === 'claude' ? 'AI · Claude' : 'Auto'}</Chip>
                  </div>
                  <p style={{ margin: 'var(--space-3) 0', fontSize: 'var(--text-sm)', color: 'var(--ink-mid)', lineHeight: 1.65 }}>
                    {brief.brief}
                  </p>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {brief.focusAreas.map((area) => <Chip key={area}>{area}</Chip>)}
                  </div>
                </div>
              ) : null}

              <div className="fz-card">
                <span className="fz-kicker">Score profile</span>
                <Bars
                  ariaLabel="Component scores"
                  data={potential ? [
                    { label: 'Power', value: potential.components.power },
                    { label: 'Coord', value: potential.components.coordination },
                    { label: 'Consist', value: potential.components.consistency },
                    { label: 'Anthro', value: potential.components.anthropometric },
                    { label: 'Explos', value: potential.components.explosiveness },
                  ] : []}
                />
              </div>
            </section>
          </div>
        </>
      )}
    </Shell>
  );
}

/** Coach and admin land on their team/overview views. */
function NonAthleteDashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.adminOverview>>['overview'] | null>(null);
  const [roster, setRoster] = useState<Awaited<ReturnType<typeof api.coachRoster>>['roster'] | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      api.adminOverview().then((r) => setOverview(r.overview)).catch(() => undefined);
    }
    api.coachRoster().then((r) => setRoster(r.roster)).catch(() => undefined);
  }, [user?.role]);

  return (
    <Shell title={user?.role === 'admin' ? 'Platform overview' : 'Coach dashboard'}>
      {user?.role === 'admin' && overview ? (
        <div className="fz-grid fz-grid--stats fz-animate-in" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="fz-card"><Stat label="Athletes" value={overview.athletes} sub={`${overview.users} total users`} /></div>
          <div className="fz-card"><Stat label="Assessments" value={overview.assessments} accent /></div>
          <div className="fz-card"><Stat label="Verified" value={overview.verified} sub={`${overview.tampered} flagged tampered`} /></div>
          <div className="fz-card"><Stat label="Badges awarded" value={overview.badgesAwarded} /></div>
        </div>
      ) : null}

      <div className="fz-section-title"><h2>Your athletes</h2><Link to="/team" className="fz-btn fz-btn--ghost">Full roster</Link></div>
      {roster && roster.length > 0 ? (
        <div className="fz-card fz-card--flush">
          <table className="fz-table">
            <thead>
              <tr><th>Athlete</th><th>Sport</th><th>Best jump</th><th>Sessions</th><th>Streak</th></tr>
            </thead>
            <tbody>
              {roster.slice(0, 8).map((athlete) => (
                <tr key={athlete.id}>
                  <td><Link to={`/team/${athlete.id}`} style={{ fontWeight: 650 }}>{athlete.name}</Link></td>
                  <td>{athlete.sport ?? '—'}</td>
                  <td>{formatHeight(athlete.stats.bestJumpHeightM)}</td>
                  <td>{athlete.stats.assessmentCount}</td>
                  <td>{athlete.stats.streakDays}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No athletes assigned yet" body="Athletes appear here when their profile lists you as coach." />
      )}
    </Shell>
  );
}
