import { useEffect, useState } from 'react';
import { Shell } from '../components/Shell';
import { Chip, EmptyState, Skeleton } from '../components/ui';
import { api, OfflineError, type LeaderboardEntry } from '../lib/api';
import { cacheGet, cachePut } from '../lib/idb';
import { formatHeight, initials } from '../lib/format';
import { useAuth } from '../state/AppState';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<'jump' | 'power'>('jump');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setEntries(null);
    const cacheKey = `leaderboard.${metric}`;
    api
      .leaderboard(metric)
      .then(async ({ leaderboard }) => {
        setEntries(leaderboard);
        setOffline(false);
        await cachePut(cacheKey, leaderboard);
      })
      .catch(async (err) => {
        if (err instanceof OfflineError) {
          const cached = await cacheGet<LeaderboardEntry[]>(cacheKey);
          if (cached) {
            setEntries(cached.value);
            setOffline(true);
            return;
          }
        }
        setEntries([]);
      });
  }, [metric]);

  return (
    <Shell
      title="Leaderboard"
      actions={
        <div className="fz-segment" role="tablist" aria-label="Ranking metric">
          <button role="tab" aria-selected={metric === 'jump'} className={metric === 'jump' ? 'active' : ''} onClick={() => setMetric('jump')}>Jump height</button>
          <button role="tab" aria-selected={metric === 'power'} className={metric === 'power' ? 'active' : ''} onClick={() => setMetric('power')}>Power</button>
        </div>
      }
    >
      {offline ? <Chip tone="warning">Offline — showing cached rankings</Chip> : null}
      {!entries ? (
        <div className="fz-card"><Skeleton height={260} /></div>
      ) : entries.length === 0 ? (
        <EmptyState title="No ranked athletes yet" body="Verified assessments feed the board. Be the first." />
      ) : (
        <div className="fz-card fz-card--flush" style={{ marginTop: offline ? 'var(--space-4)' : 0 }}>
          <table className="fz-table">
            <thead>
              <tr><th></th><th>Athlete</th><th>Region</th><th>Sport</th>
                <th>{metric === 'jump' ? 'Best jump' : 'Peak power'}</th><th>Sessions</th></tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isMe = entry.athleteId === user?.id;
                return (
                  <tr key={entry.athleteId} style={isMe ? { background: 'color-mix(in srgb, var(--accent) 8%, transparent)' } : undefined}>
                    <td><span className={`fz-rank${entry.rank <= 3 ? ` fz-rank--${entry.rank}` : ''}`}>#{entry.rank}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', fontWeight: 650 }}>
                        <span className="fz-avatar" style={{ width: 28, height: 28, fontSize: '0.6rem' }}>{initials(entry.name)}</span>
                        {entry.name}{isMe ? <Chip tone="accent">You</Chip> : null}
                      </span>
                    </td>
                    <td>{entry.region ?? '—'}</td>
                    <td>{entry.sport ?? '—'}</td>
                    <td style={{ fontWeight: 700 }}>
                      {metric === 'jump'
                        ? formatHeight(entry.bestJumpHeightM)
                        : `${entry.bestRelativePowerWkg.toFixed(1)} W/kg`}
                    </td>
                    <td>{entry.assessments}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
