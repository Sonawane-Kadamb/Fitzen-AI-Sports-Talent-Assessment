import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  analyzeJump,
  appendAuditEntry,
  signAssessment,
  type AuditEntry,
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

const MAX_RECORD_MS = 12_000;

export default function AssessPage() {
  const { user, profile } = useAuth();
  const sync = useSync();
  const { push } = useToasts();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'camera' | 'video' | 'simulation'>('camera');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('setup');
  const [status, setStatus] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [result, setResult] = useState<JumpAnalysis | null>(null);
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
    // Read the source kind BEFORE stopSource() clears the ref.
    const capturedKind = sourceRef.current?.kind ?? 'camera';
    stopSource();
    setStage('analyzing');
    const frames = framesRef.current;

    if (!profile) return;
    if (frames.length === 0 && capturedKind === 'video') {
      setFailure(
        'No person was detected in that video. Make sure the athlete is fully visible, well lit, and fills a good part of the frame.',
      );
      setStage('failed');
      return;
    }
    const analysis = analyzeJump(frames, { heightCm: profile.heightCm, massKg: profile.massKg });
    if (!analysis.ok) {
      setFailure(analysis.message);
      setStage('failed');
      return;
    }
    setResult(analysis);

    // Sign + queue (offline-first): payload → hash → ECDSA → audit trail.
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
        source: capturedKind, frames: frames.length, fps: m.effectiveFps,
      });
      trail = await appendAuditEntry(trail, 'analyzed', {
        jumpHeightM: payload.metrics.jumpHeightM, flightTimeS: payload.metrics.flightTimeS,
      });
      trail = await appendAuditEntry(trail, 'signed', { keyFingerprint: signed.keyFingerprint });
      await enqueueAssessment({ signed, auditTrail: trail });
      push('success', navigator.onLine
        ? 'Assessment signed and uploaded.'
        : 'Assessment signed and queued — will sync when you are back online.');
    } catch {
      push('error', 'Could not queue the assessment for sync.');
    }
    setStage('result');
  }, [profile, push, stopSource, user]);

  const begin = useCallback(async () => {
    if (!profile) return;
    setFailure(null);
    setResult(null);
    framesRef.current = [];
    setFrameCount(0);
    setStage('starting');

    const callbacks = {
      onFrame: (frame: PoseFrame) => {
        // Draw the live overlay regardless of recording state.
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
      // Camera: open the stream + model first so the athlete can frame up,
      // then count down and record.
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
      // Pre-recorded clip: the video's own timeline provides timestamps, so
      // record from the first decoded frame — no countdown needed.
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
      // Simulation: count down first, then start the synthesized jump with
      // recording already live so the baseline and takeoff are captured.
      setStage('countdown');
      for (const n of [3, 2, 1]) {
        setCountdown(n);
        await sleep(350);
      }
      recordingRef.current = true;
      setStage('recording');
      const source: PoseSource = new SimulationPoseSource(callbacks, {
        athleteHeightCm: profile.heightCm,
      });
      sourceRef.current = source;
      await source.start(videoRef.current);
    }
  }, [finishRecording, mode, profile, stopSource, videoFile]);

  if (!profile) {
    return (
      <Shell title="Assess">
        <div className="fz-card fz-animate-in" style={{ maxWidth: 560 }}>
          <h2>Complete your athlete profile first</h2>
          <p style={{ color: 'var(--ink-mid)', margin: 'var(--space-3) 0 var(--space-4)' }}>
            Jump analysis uses your height as the single-camera scale reference and your
            body mass for power estimation — both are required for accurate results.
          </p>
          <Button onClick={() => navigate('/settings')}>Set up profile</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Vertical Jump Assessment">
      <div className="fz-grid fz-grid--two">
        <section>
          <div className="fz-assess-stage">
            <video ref={videoRef} playsInline muted style={{ display: mode !== 'simulation' ? 'block' : 'none' }} />
            {mode === 'simulation' || stage === 'setup' ? (
              <div className="fz-assess-stage__placeholder">
                {stage === 'setup' ? (
                  <>
                    <svg width="52" height="52" viewBox="0 0 32 32" aria-hidden>
                      <path d="M9 24 L16 7 L19 15 L23 15" stroke="var(--volt)" strokeWidth="2.6"
                        fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p>{mode === 'camera'
                      ? 'Position the camera ~3 m away, full body in frame.'
                      : mode === 'video'
                        ? videoFile
                          ? `Ready to process “${videoFile.name}”.`
                          : 'Choose a jump video recorded on any phone — it is processed entirely on this device.'
                        : 'Guided demo synthesizes a realistic jump through the full pipeline.'}</p>
                  </>
                ) : null}
              </div>
            ) : null}
            <canvas ref={canvasRef} />
            {stage === 'countdown' ? <div className="fz-countdown">{countdown}</div> : null}
            <div className="fz-assess-hud">
              {stage !== 'setup' && <Chip>{status || 'Preparing…'}</Chip>}
              {stage === 'recording' && <Chip>{frameCount} frames</Chip>}
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
                    <input
                      type="file"
                      accept="video/*"
                      className="fz-visually-hidden"
                      onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                ) : null}
                <Button size="lg" onClick={() => void begin()} disabled={mode === 'video' && !videoFile}>
                  {stage === 'setup'
                    ? mode === 'video' ? 'Process video' : 'Start assessment'
                    : 'Go again'}
                </Button>
              </>
            )}
            {stage === 'recording' && (
              <Button variant="ghost" size="lg" onClick={() => void finishRecording()}>
                Finish &amp; analyze
              </Button>
            )}
            {stage === 'analyzing' && <Chip tone="accent">Analyzing…</Chip>}
          </div>

          {stage === 'failed' && failure ? (
            <div className="fz-error" style={{ marginTop: 'var(--space-4)' }}>{failure}</div>
          ) : null}
        </section>

        <aside>
          {stage === 'result' && result ? (
            <ResultCard result={result} />
          ) : (
            <div className="fz-card">
              <span className="fz-kicker">Protocol</span>
              {mode === 'video' ? (
                <div className="fz-steps" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="fz-step"><span className="fz-step__num">1</span>Record with any phone: side-on, ~3 m away, whole body in frame, steady camera.</div>
                  <div className="fz-step"><span className="fz-step__num">2</span>The clip should start with 1–2 s of quiet standing (that locks the baseline), then one maximal jump.</div>
                  <div className="fz-step"><span className="fz-step__num">3</span>Choose the file and tap <strong>Process video</strong> — analysis runs entirely on this device; the video is never uploaded.</div>
                  <div className="fz-step"><span className="fz-step__num">4</span>The result is signed and synced like any live assessment.</div>
                </div>
              ) : (
                <div className="fz-steps" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="fz-step"><span className="fz-step__num">1</span>Stand side-on to the camera, whole body visible, good light.</div>
                  <div className="fz-step"><span className="fz-step__num">2</span>Stay still for the countdown so we can lock your baseline.</div>
                  <div className="fz-step"><span className="fz-step__num">3</span>Dip and jump as high as you can, land, and stand tall.</div>
                  <div className="fz-step"><span className="fz-step__num">4</span>Tap <strong>Finish &amp; analyze</strong> — the result is signed on-device and synced.</div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </Shell>
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
