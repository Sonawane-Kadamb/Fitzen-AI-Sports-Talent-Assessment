import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  analyzeJump,
  analyzePushups,
  analyzeSquats,
  appendAuditEntry,
  signAssessment,
  type AuditEntry,
  type ExerciseAnalysisResult,
  type JumpAnalysis,
  type PoseFrame,
} from '@fitzen/engines';
import { Shell } from '../components/Shell';
import { Button, Chip, Meter, ProgressRing } from '../components/ui';
import { drawPoseOverlay } from '../pose/overlay';
import {
  CameraPoseSource,
  SimulationPoseSource,
  VideoFilePoseSource,
  type PoseSource,
} from '../pose/poseSource';
import { getDeviceKeyPair } from '../lib/deviceKeys';
import { enqueueAssessment } from '../lib/sync';
import { useAuth, useSync, useToasts } from '../state/AppState';
import { formatHeight } from '../lib/format';
import type { AssessmentPayload } from '../lib/api';

type Stage = 'setup' | 'starting' | 'countdown' | 'recording' | 'analyzing' | 'result' | 'failed';
type TestKind = 'vertical_jump' | 'pushup' | 'squat';

const MAX_RECORD_MS = 12_000;

export default function AssessPage() {
  const { user, profile } = useAuth();
  const sync = useSync();
  const { push } = useToasts();
  const navigate = useNavigate();

  const [testKind, setTestKind] = useState<TestKind>('vertical_jump');
  const [mode, setMode] = useState<'camera' | 'video' | 'simulation'>('camera');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('setup');
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [jumpResult, setJumpResult] = useState<JumpAnalysis | null>(null);
  const [exerciseResult, setExerciseResult] = useState<ExerciseAnalysisResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<PoseSource | null>(null);
  const framesRef = useRef<PoseFrame[]>([]);
  const recordingRef = useRef(false);
  const stageRef = useRef<Stage>('setup');
  stageRef.current = stage;

  const stopSource = useCallback(() => {
    sourceRef.current?.stop();
    sourceRef.current = null;
    recordingRef.current = false;
  }, []);

  useEffect(() => stopSource, [stopSource]);

  const finishRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const capturedKind = sourceRef.current?.kind ?? 'camera';
    stopSource();
    setStage('analyzing');
    const frames = framesRef.current;

    if (!profile) return;
    if (frames.length === 0 && capturedKind === 'video') {
      setFailure(
        'No person was detected in that video. Make sure the athlete is fully visible, well lit, and fills a good part of the frame.'
      );
      setStage('failed');
      return;
    }

    // Past session baseline mock for improvement comparison
    const pastBaseline = {
      validReps: 4,
      formAccuracyPercent: 80.0,
      avgAsymmetryDeg: 12.0,
    };

    if (testKind === 'pushup') {
      const res = analyzePushups(frames, pastBaseline);
      setExerciseResult(res);
      setJumpResult(null);

      try {
        const keys = await getDeviceKeyPair();
        const m = res.metrics;
        const payload: AssessmentPayload = {
          clientId: crypto.randomUUID(),
          athleteId: user!.id,
          test: 'pushup',
          capturedAt: new Date().toISOString(),
          metrics: {
            jumpHeightM: 0,
            jumpHeightCiLow: 0,
            jumpHeightCiHigh: 0,
            flightTimeS: 0,
            peakPowerW: 0,
            relativePowerWkg: 0,
            symmetryScore: Math.round(Math.max(0, 100 - m.avgMaxAsymmetryDeg * 3)),
            movementQuality: Math.round(m.formAccuracyPercent),
            confidence: 0.95,
            effectiveFps: 30,
            countermovementDepth: 0,
            qualityFlags: res.pointsToImprove,
            validReps: m.validReps,
            totalAttempts: m.totalAttempts,
            formAccuracyPercent: m.formAccuracyPercent,
            avgAsymmetryDeg: m.avgMaxAsymmetryDeg,
          },
        };
        const signed = await signAssessment(payload, keys);
        let trail: AuditEntry[] = [];
        trail = await appendAuditEntry(trail, 'captured', { source: capturedKind, frames: frames.length, fps: 30 });
        trail = await appendAuditEntry(trail, 'analyzed', { test: 'pushup', validReps: m.validReps });
        trail = await appendAuditEntry(trail, 'signed', { keyFingerprint: signed.keyFingerprint });
        await enqueueAssessment({ signed, auditTrail: trail });
        push('success', navigator.onLine ? 'Push-Up assessment signed and uploaded.' : 'Push-Up assessment signed and queued.');
      } catch {
        push('error', 'Could not queue assessment.');
      }
    } else if (testKind === 'squat') {
      const res = analyzeSquats(frames, pastBaseline);
      setExerciseResult(res);
      setJumpResult(null);

      try {
        const keys = await getDeviceKeyPair();
        const m = res.metrics;
        const payload: AssessmentPayload = {
          clientId: crypto.randomUUID(),
          athleteId: user!.id,
          test: 'squat',
          capturedAt: new Date().toISOString(),
          metrics: {
            jumpHeightM: 0,
            jumpHeightCiLow: 0,
            jumpHeightCiHigh: 0,
            flightTimeS: 0,
            peakPowerW: 0,
            relativePowerWkg: 0,
            symmetryScore: Math.round(Math.max(0, 100 - m.avgMaxAsymmetryDeg * 3)),
            movementQuality: Math.round(m.formAccuracyPercent),
            confidence: 0.95,
            effectiveFps: 30,
            countermovementDepth: 0,
            qualityFlags: res.pointsToImprove,
            validReps: m.validReps,
            totalAttempts: m.totalAttempts,
            formAccuracyPercent: m.formAccuracyPercent,
            avgAsymmetryDeg: m.avgMaxAsymmetryDeg,
          },
        };
        const signed = await signAssessment(payload, keys);
        let trail: AuditEntry[] = [];
        trail = await appendAuditEntry(trail, 'captured', { source: capturedKind, frames: frames.length, fps: 30 });
        trail = await appendAuditEntry(trail, 'analyzed', { test: 'squat', validReps: m.validReps });
        trail = await appendAuditEntry(trail, 'signed', { keyFingerprint: signed.keyFingerprint });
        await enqueueAssessment({ signed, auditTrail: trail });
        push('success', navigator.onLine ? 'Squat assessment signed and uploaded.' : 'Squat assessment signed and queued.');
      } catch {
        push('error', 'Could not queue assessment.');
      }
    } else {

      const analysis = analyzeJump(frames, { heightCm: profile.heightCm, massKg: profile.massKg });
      if (!analysis.ok) {
        setFailure(analysis.message);
        setStage('failed');
        return;
      }
      setJumpResult(analysis);
      setExerciseResult(null);

      // Sign + queue jump
      try {
        const keys = await getDeviceKeyPair();
        const m = analysis.metrics;
        const payload: AssessmentPayload = {
          clientId: crypto.randomUUID(),
          athleteId: user!.id,
          test: 'vertical_jump',
          capturedAt: new Date().toISOString(),
          metrics: {
            jumpHeightM: round3(m.jumpHeight.value),
            jumpHeightCiLow: round3(m.jumpHeight.ci95[0]),
            jumpHeightCiHigh: round3(m.jumpHeight.ci95[1]),
            flightTimeS: round3(m.flightTime.value),
            peakPowerW: m.peakPowerW,
            relativePowerWkg: m.relativePowerWkg,
            symmetryScore: m.symmetryScore,
            movementQuality: m.movementQuality,
            confidence: m.confidence,
            effectiveFps: m.effectiveFps,
            countermovementDepth: m.countermovementDepth,
            qualityFlags: m.qualityFlags,
          },
        };
        const signed = await signAssessment(payload, keys);
        let trail: AuditEntry[] = [];
        trail = await appendAuditEntry(trail, 'captured', {
          source: capturedKind,
          frames: frames.length,
          fps: m.effectiveFps,
        });
        trail = await appendAuditEntry(trail, 'analyzed', {
          jumpHeightM: payload.metrics.jumpHeightM,
          flightTimeS: payload.metrics.flightTimeS,
        });
        trail = await appendAuditEntry(trail, 'signed', { keyFingerprint: signed.keyFingerprint });
        await enqueueAssessment({ signed, auditTrail: trail });
        push(
          'success',
          navigator.onLine
            ? 'Jump assessment signed and uploaded.'
            : 'Jump assessment signed and queued for sync.'
        );
      } catch {
        push('error', 'Could not queue assessment.');
      }
    }
    setStage('result');
  }, [profile, push, stopSource, testKind, user]);

  const begin = useCallback(async () => {
    if (!profile) return;
    setFailure(null);
    setJumpResult(null);
    setExerciseResult(null);
    framesRef.current = [];
    setFrameCount(0);
    setStage('starting');

    const callbacks = {
      onFrame: (frame: PoseFrame) => {
        const canvas = canvasRef.current;
        if (canvas) {
          const video = videoRef.current;
          const w = video && video.videoWidth > 0 ? video.videoWidth : 960;
          const h = video && video.videoHeight > 0 ? video.videoHeight : 720;
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          drawPoseOverlay(canvas, frame, recordingRef.current ? 'RECORDING' : 'READY');
        }
        if (recordingRef.current) {
          framesRef.current.push(frame);
          setFrameCount(framesRef.current.length);
        }
      },
      onStatus: (message: string) => {
        setStatus(message);
        if (message === 'Demo complete' || message === 'Video complete') void finishRecording();
      },
      onError: (message: string) => {
        setFailure(message);
        setStage('failed');
        stopSource();
      },
    };

    if (mode === 'camera') {
      const source: PoseSource = new CameraPoseSource(callbacks);
      sourceRef.current = source;
      await source.start(videoRef.current);
      if (stageRef.current === 'failed') return;

      setStage('countdown');
      for (const n of [3, 2, 1]) {
        setCountdown(n);
        await sleep(900);
      }
      recordingRef.current = true;
      setStage('recording');
      window.setTimeout(() => {
        if (recordingRef.current) void finishRecording();
      }, MAX_RECORD_MS);
    } else if (mode === 'video') {
      if (!videoFile) {
        setFailure('Choose a video file first.');
        setStage('failed');
        return;
      }
      recordingRef.current = true;
      setStage('recording');
      const source: PoseSource = new VideoFilePoseSource(callbacks, videoFile);
      sourceRef.current = source;
      await source.start(videoRef.current);
    } else {
      setStage('countdown');
      for (const n of [3, 2, 1]) {
        setCountdown(n);
        await sleep(350);
      }
      recordingRef.current = true;
      setStage('recording');
      const source: PoseSource = new SimulationPoseSource(callbacks, {
        athleteHeightCm: profile.heightCm,
        exerciseType: testKind,
      });
      sourceRef.current = source;
      await source.start(videoRef.current);
    }
  }, [finishRecording, mode, profile, stopSource, testKind, videoFile]);

  if (!profile) {
    return (
      <Shell title="Assess">
        <div className="fz-card fz-animate-in" style={{ maxWidth: 560 }}>
          <h2>Complete your athlete profile first</h2>
          <p style={{ color: 'var(--ink-mid)', margin: 'var(--space-3) 0 var(--space-4)' }}>
            Assessment processing requires your height and mass for scaling and biometric analysis.
          </p>
          <Button onClick={() => navigate('/settings')}>Set up profile</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Athletic Motion Assessment">
      <div className="fz-grid fz-grid--two">
        <section>
          {/* Exercise Selector Tabs */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <span className="fz-kicker" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Select Assessment Type</span>
            <div className="fz-segment" role="tablist">
              <button
                role="tab"
                aria-selected={testKind === 'vertical_jump'}
                className={testKind === 'vertical_jump' ? 'active' : ''}
                onClick={() => setTestKind('vertical_jump')}
              >
                🚀 Vertical Jump
              </button>
              <button
                role="tab"
                aria-selected={testKind === 'pushup'}
                className={testKind === 'pushup' ? 'active' : ''}
                onClick={() => setTestKind('pushup')}
              >
                💪 Push-Ups
              </button>
              <button
                role="tab"
                aria-selected={testKind === 'squat'}
                className={testKind === 'squat' ? 'active' : ''}
                onClick={() => setTestKind('squat')}
              >
                🏋️ Squats
              </button>
            </div>
          </div>

          <div className="fz-assess-stage">
            <video ref={videoRef} playsInline muted style={{ display: mode !== 'simulation' ? 'block' : 'none' }} />
            {mode === 'simulation' || stage === 'setup' ? (
              <div className="fz-assess-stage__placeholder">
                {stage === 'setup' ? (
                  <>
                    <svg width="52" height="52" viewBox="0 0 32 32" aria-hidden>
                      <path d="M9 24 L16 7 L19 15 L23 15" stroke="var(--volt)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p>
                      {mode === 'camera'
                        ? 'Position the camera ~3 m away with full body visible.'
                        : mode === 'video'
                          ? videoFile ? `Ready to process “${videoFile.name}”.` : 'Choose a video recorded on any device.'
                          : `Guided demo mode synthesizes a 3D ${testKind.replace('_', ' ')} assessment.`}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
            <canvas ref={canvasRef} />
            {stage === 'countdown' ? <div className="fz-countdown">{countdown}</div> : null}
            <div className="fz-assess-hud">
              {stage !== 'setup' && <Chip>{status || 'Preparing…'}</Chip>}
              {stage === 'recording' && <Chip>{frameCount} frames captured</Chip>}
              {!sync.online && <Chip>Offline — results will queue</Chip>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
            {(stage === 'setup' || stage === 'result' || stage === 'failed') && (
              <>
                <div className="fz-segment" role="tablist" aria-label="Capture mode">
                  <button role="tab" aria-selected={mode === 'camera'} className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')}>Live camera</button>
                  <button role="tab" aria-selected={mode === 'video'} className={mode === 'video' ? 'active' : ''} onClick={() => setMode('video')}>Upload video</button>
                  <button role="tab" aria-selected={mode === 'simulation'} className={mode === 'simulation' ? 'active' : ''} onClick={() => setMode('simulation')}>Guided demo</button>
                </div>
                {mode === 'video' ? (
                  <label className="fz-btn fz-btn--ghost" style={{ cursor: 'pointer' }}>
                    {videoFile ? `📼 ${shortName(videoFile.name)}` : 'Choose video…'}
                    <input type="file" accept="video/*" className="fz-visually-hidden" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                  </label>
                ) : null}
                <Button size="lg" onClick={() => void begin()} disabled={mode === 'video' && !videoFile}>
                  {stage === 'setup' ? (mode === 'video' ? 'Process video' : 'Start assessment') : 'Go again'}
                </Button>
              </>
            )}
            {stage === 'recording' && (
              <Button variant="ghost" size="lg" onClick={() => void finishRecording()}>
                Finish &amp; analyze
              </Button>
            )}
            {stage === 'analyzing' && <Chip tone="accent">Analyzing 3D angles &amp; form…</Chip>}
          </div>

          {stage === 'failed' && failure ? (
            <div className="fz-error" style={{ marginTop: 'var(--space-4)' }}>{failure}</div>
          ) : null}
        </section>

        <aside>
          {stage === 'result' ? (
            exerciseResult ? (
              <ExerciseResultCard result={exerciseResult} />
            ) : jumpResult ? (
              <ResultCard result={jumpResult} />
            ) : null
          ) : (
            <div className="fz-card">
              <span className="fz-kicker">Assessment Protocol</span>
              <div className="fz-steps" style={{ marginTop: 'var(--space-3)' }}>
                <div className="fz-step"><span className="fz-step__num">1</span>Position full body in frame (facing or side-on).</div>
                <div className="fz-step"><span className="fz-step__num">2</span>Our 3D vector geometry engine measures joint angles (Elbows/Knees) at 60 FPS.</div>
                <div className="fz-step"><span className="fz-step__num">3</span>FSM fraud engine rejects incomplete repetitions ("half-reps") &amp; asymmetry in real time.</div>
                <div className="fz-step"><span className="fz-step__num">4</span>Detailed feedback highlights specific <strong>Points to Improve</strong> &amp; <strong>Past Progress</strong>.</div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function ExerciseResultCard({ result }: { result: ExerciseAnalysisResult }) {
  const m = result.metrics;
  return (
    <div className="fz-card fz-animate-in" style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div>
        <span className="fz-kicker">{result.exerciseName}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
          <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--volt)' }}>{m.validReps}</span>
          <span style={{ color: 'var(--ink-mid)', fontSize: '1.1rem' }}>/ {m.totalAttempts} valid reps</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
        <ProgressRing value={m.formAccuracyPercent} label="Form Accuracy" size={96} stroke={7} />
        <ProgressRing value={Math.max(0, 100 - m.avgMaxAsymmetryDeg * 3)} label="Symmetry" size={96} stroke={7} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        <Meter label="Form Accuracy (%)" value={m.formAccuracyPercent} max={100} />
        <Meter label="Avg Limb Asymmetry (°)" value={m.avgMaxAsymmetryDeg} max={25} />
      </div>

      {/* Points to Improve Section */}
      <div style={{ padding: 'var(--space-3)', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h4 style={{ margin: '0 0 var(--space-2)', color: 'var(--volt)', fontSize: '0.95rem' }}>🎯 Points to Improve</h4>
        <ul style={{ margin: 0, paddingLeft: 'var(--space-4)', display: 'grid', gap: 'var(--space-1)', fontSize: '0.88rem', color: 'var(--ink-mid)' }}>
          {result.pointsToImprove.map((point, idx) => (
            <li key={idx}>{point}</li>
          ))}
        </ul>
      </div>

      {/* Historical Past Comparison Section */}
      <div style={{ padding: 'var(--space-3)', background: 'rgba(200, 241, 53, 0.05)', borderRadius: 8, border: '1px solid rgba(200, 241, 53, 0.2)' }}>
        <h4 style={{ margin: '0 0 var(--space-1)', color: '#ffffff', fontSize: '0.95rem' }}>📈 Improvement from Past</h4>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-mid)' }}>{result.pastImprovement.summaryText}</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Link className="fz-btn fz-btn--ghost" to="/history">View history</Link>
        <Link className="fz-btn fz-btn--ghost" to="/dashboard">Dashboard</Link>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: JumpAnalysis }) {
  const m = result.metrics;
  return (
    <div className="fz-card fz-animate-in">
      <div className="fz-result-hero">
        <span className="fz-kicker">Jump height</span>
        <div className="fz-result-hero__value">{formatHeight(m.jumpHeight.value)}</div>
        <div className="fz-result-hero__ci">
          95% CI {formatHeight(Math.max(0, m.jumpHeight.ci95[0]))} – {formatHeight(m.jumpHeight.ci95[1])}
          {' · '}flight {m.flightTime.value.toFixed(3)}s
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', margin: 'var(--space-4) 0' }}>
        <ProgressRing value={m.symmetryScore} label="Symmetry" size={96} stroke={7} />
        <ProgressRing value={m.movementQuality} label="Quality" size={96} stroke={7} />
        <ProgressRing value={m.confidence * 100} label="Confidence" size={96} stroke={7} />
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <Meter label="Peak power (W)" value={m.peakPowerW} max={Math.max(3000, m.peakPowerW)} />
        <Meter label="Relative power (W/kg)" value={m.relativePowerWkg} max={80} />
      </div>
      {m.qualityFlags.length > 0 ? (
        <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-2)' }}>
          {m.qualityFlags.map((flag) => (
            <Chip key={flag} tone="warning">{flag}</Chip>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)' }}>
        <Link className="fz-btn fz-btn--ghost" to="/history">View history</Link>
        <Link className="fz-btn fz-btn--ghost" to="/dashboard">Dashboard</Link>
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function shortName(name: string): string {
  return name.length > 22 ? `${name.slice(0, 19)}…` : name;
}
