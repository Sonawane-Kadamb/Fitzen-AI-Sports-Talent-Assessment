import type { Landmark, PoseFrame } from '../jump/types.js';

export interface SimulateExerciseOptions {
  /** Target repetition count to generate (default: 5) */
  targetReps?: number;
  /** Frame rate in FPS (default: 30) */
  fps?: number;
  /** Include 1 intentional half-rep / form error for demonstration (default: true) */
  includeFormError?: boolean;
}

/** Creates a baseline 33-landmark pose template */
function createBaseLandmarks(): Landmark[] {
  const landmarks: Landmark[] = new Array(33);
  for (let i = 0; i < 33; i++) {
    landmarks[i] = { x: 0.5, y: 0.5, z: 0, visibility: 0.95 };
  }
  return landmarks;
}

/**
 * Synthesizes a realistic Push-Up session frame sequence with genuine joint angles.
 */
export function simulatePushupSession(options?: SimulateExerciseOptions): PoseFrame[] {
  const reps = options?.targetReps ?? 5;
  const fps = options?.fps ?? 30;
  const includeError = options?.includeFormError ?? true;

  const frames: PoseFrame[] = [];
  const framesPerRep = fps * 2; // 2 seconds per rep
  const totalFrames = reps * framesPerRep + fps;

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = Math.round((i / fps) * 1000);
    const repIndex = Math.floor(i / framesPerRep);
    const phaseInRep = (i % framesPerRep) / framesPerRep; // [0, 1]

    // 170 deg at top extended position, 85 deg at bottom position
    const isHalfRep = includeError && repIndex === 2;
    const maxOffset = isHalfRep ? 0.10 : 0.22; // 0.22 offset produces ~84 deg angle!

    const elbowOffset = maxOffset * Math.sin(phaseInRep * Math.PI);

    const landmarks = createBaseLandmarks();

    landmarks[11] = { x: 0.35, y: 0.30, z: 0.0, visibility: 0.95 };
    landmarks[13] = { x: 0.35 - elbowOffset, y: 0.50, z: 0.0, visibility: 0.95 };
    landmarks[15] = { x: 0.35, y: 0.70, z: 0.0, visibility: 0.95 };

    landmarks[12] = { x: 0.65, y: 0.30, z: 0.0, visibility: 0.95 };
    landmarks[14] = { x: 0.65 + elbowOffset, y: 0.50, z: 0.0, visibility: 0.95 };
    landmarks[16] = { x: 0.65, y: 0.70, z: 0.0, visibility: 0.95 };

    frames.push({ timestampMs, landmarks });
  }

  return frames;
}

/**
 * Synthesizes a realistic Squat session frame sequence with genuine joint angles.
 */
export function simulateSquatSession(options?: SimulateExerciseOptions): PoseFrame[] {
  const reps = options?.targetReps ?? 5;
  const fps = options?.fps ?? 30;
  const includeError = options?.includeFormError ?? true;

  const frames: PoseFrame[] = [];
  const framesPerRep = Math.floor(fps * 2.5); // 2.5 seconds per rep
  const totalFrames = reps * framesPerRep + fps;

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = Math.round((i / fps) * 1000);
    const repIndex = Math.floor(i / framesPerRep);
    const phaseInRep = (i % framesPerRep) / framesPerRep; // [0, 1]

    const isShallow = includeError && repIndex === 2;
    const maxOffset = isShallow ? 0.12 : 0.26; // 0.26 offset produces ~87 deg squat depth!

    const kneeOffset = maxOffset * Math.sin(phaseInRep * Math.PI);


    const landmarks = createBaseLandmarks();

    landmarks[23] = { x: 0.40, y: 0.40, z: 0.0, visibility: 0.95 };
    landmarks[25] = { x: 0.40 - kneeOffset, y: 0.65, z: 0.0, visibility: 0.95 };
    landmarks[27] = { x: 0.40, y: 0.90, z: 0.0, visibility: 0.95 };

    landmarks[24] = { x: 0.60, y: 0.40, z: 0.0, visibility: 0.95 };
    landmarks[26] = { x: 0.60 + kneeOffset, y: 0.65, z: 0.0, visibility: 0.95 };
    landmarks[28] = { x: 0.60, y: 0.90, z: 0.0, visibility: 0.95 };

    frames.push({ timestampMs, landmarks });
  }

  return frames;
}
