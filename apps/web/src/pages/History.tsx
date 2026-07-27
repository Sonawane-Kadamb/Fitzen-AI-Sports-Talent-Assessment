import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shell } from '../components/Shell';
import { Chip, EmptyState, IntegrityChip, Skeleton } from '../components/ui';
import { api, OfflineError, type AssessmentRecord } from '../lib/api';
import { cacheGet, cachePut } from '../lib/idb';
import { formatDateTime, formatHeight } from '../lib/format';
import { useToasts } from '../state/AppState';

export default function HistoryPage() {
  const [records, setRecords] = useState<AssessmentRecord[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const { push } = useToasts();

  useEffect(() => {
    api
      .listAssessments()
      .then(async ({ assessments }) => {
        setRecords(assessments);
        await cachePut('history', assessments);
      })
      .catch(async (err) => {
        if (err instanceof OfflineError) {
          const cached = await cacheGet<AssessmentRecord[]>('history');
          if (cached) {
            setRecords(cached.value);
            setOffline(true);
            return;
          }
        }
        setRecords([]);
      });
  }, []);

  async function reverify(id: string) {
    setVerifying(id);
    try {
      const result = await api.verifyAssessment(id);
      push(
        result.integrity === 'verified' ? 'success' : 'error',
        result.integrity === 'verified'
          ? 'Signature, hash chain and plausibility all check out.'
          : `Integrity failure: ${result.reasons[0] ?? 'unknown'}`
      );
      const { assessments } = await api.listAssessments();
      setRecords(assessments);
    } catch {
      push('error', 'Verification requires a connection.');
    } finally {
      setVerifying(null);
    }
  }

  return (
    <Shell
      title="Assessment history"
      actions={
        <Link to="/assess" className="fz-btn fz-btn--primary">
          New assessment
        </Link>
      }
    >
      {offline ? <Chip tone="warning">Offline — showing cached history</Chip> : null}
      {!records ? (
        <div className="fz-card">
          <Skeleton height={220} />
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          body="Your verified assessment history will live here."
          action={
            <Link to="/assess" className="fz-btn fz-btn--primary">
              Run your first
            </Link>
          }
        />
      ) : (
        <div className="fz-card fz-card--flush" style={{ marginTop: offline ? 'var(--space-4)' : 0 }}>
          <table className="fz-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Assessment Type</th>
                <th>Primary Metric</th>
                <th>Form Accuracy</th>
                <th>Symmetry Score</th>
                <th>Integrity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isJump = r.test === 'vertical_jump' || !r.test;
                const isPushup = r.test === 'pushup';
                const isSquat = r.test === 'squat';

                const typeLabel = isPushup
                  ? '💪 Push-Up'
                  : isSquat
                  ? '🏋️ Squat'
                  : '🚀 Vertical Jump';

                const metricLabel = isJump
                  ? formatHeight(r.metrics.jumpHeightM)
                  : r.metrics.validReps !== undefined
                  ? `${r.metrics.validReps} / ${r.metrics.totalAttempts ?? r.metrics.validReps} valid reps`
                  : 'Completed';

                const accuracyLabel = isJump
                  ? `${Math.round(r.metrics.movementQuality)}%`
                  : r.metrics.formAccuracyPercent !== undefined
                  ? `${Math.round(r.metrics.formAccuracyPercent)}%`
                  : `${Math.round(r.metrics.movementQuality)}%`;

                return (
                  <tr key={r.id}>
                    <td>{formatDateTime(r.capturedAt)}</td>
                    <td style={{ fontWeight: 600 }}>{typeLabel}</td>
                    <td style={{ fontWeight: 700, color: 'var(--volt)' }}>{metricLabel}</td>
                    <td>{accuracyLabel}</td>
                    <td>{Math.round(r.metrics.symmetryScore)}</td>
                    <td>
                      <IntegrityChip integrity={r.integrity} />
                    </td>
                    <td>
                      <button
                        className="fz-btn fz-btn--ghost"
                        style={{ padding: '0.25rem 0.7rem', fontSize: 'var(--text-xs)' }}
                        disabled={verifying === r.id}
                        onClick={() => void reverify(r.id)}
                      >
                        {verifying === r.id ? '…' : 'Re-verify'}
                      </button>
                    </td>
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
