import type {
  ExerciseFSMConfig,
  FSMFrameResult,
  FSMState,
  InvalidRepReason,
  KinematicFrameData,
  RepetitionRecord,
} from './types.js';

export class ExerciseFSM {
  private config: ExerciseFSMConfig;
  private currentState: FSMState = 'INIT';
  private validReps = 0;
  private invalidReps = 0;
  private repHistory: RepetitionRecord[] = [];

  // Tracking current active rep
  private currentRepStartTimeMs = 0;
  private minLeftAngleInCurrentRep = 180;
  private minRightAngleInCurrentRep = 180;
  private maxAsymmetryInCurrentRep = 0;
  private reachedDownState = false;
  private formViolationInCurrentRep: InvalidRepReason | undefined = undefined;

  constructor(config?: Partial<ExerciseFSMConfig>) {
    this.config = {
      exerciseType: config?.exerciseType ?? 'pushup',
      downAngleThreshold: config?.downAngleThreshold ?? 90.0,
      upAngleThreshold: config?.upAngleThreshold ?? 160.0,
      maxAsymmetryDeg: config?.maxAsymmetryDeg ?? 15.0,
      minVisibility: config?.minVisibility ?? 0.5,
    };
  }

  public getConfig(): ExerciseFSMConfig {
    return { ...this.config };
  }

  public getHistory(): RepetitionRecord[] {
    return [...this.repHistory];
  }

  public processFrame(frame: KinematicFrameData): FSMFrameResult {
    const { timestampMs, leftAngleDeg, rightAngleDeg, visibilityScore = 1.0 } = frame;
    let repCompleted = false;
    let lastRepRecord: RepetitionRecord | undefined = undefined;
    let feedbackMessage = 'Position yourself in front of the camera';

    const avgAngle = (leftAngleDeg + rightAngleDeg) / 2.0;
    const asymmetry = Math.abs(leftAngleDeg - rightAngleDeg);

    // Visibility score check
    if (visibilityScore < this.config.minVisibility) {
      feedbackMessage = 'Warning: Body parts occluded or low visibility';
    }

    switch (this.currentState) {
      case 'INIT':
        if (avgAngle >= this.config.upAngleThreshold) {
          this.currentState = 'UP';
          feedbackMessage = 'Good starting position! Lower down to begin repetition.';
        } else {
          feedbackMessage = `Extend fully to reach starting position (>= ${this.config.upAngleThreshold}°)`;
        }
        break;

      case 'UP':
        feedbackMessage = 'Lower down into position';

        // Check if starting to descend
        if (avgAngle < this.config.upAngleThreshold - 10) {
          this.currentRepStartTimeMs = timestampMs;
          this.minLeftAngleInCurrentRep = leftAngleDeg;
          this.minRightAngleInCurrentRep = rightAngleDeg;
          this.maxAsymmetryInCurrentRep = asymmetry;
          this.reachedDownState = false;
          this.formViolationInCurrentRep = undefined;
        }

        // Track minimum angles & asymmetry
        this.minLeftAngleInCurrentRep = Math.min(this.minLeftAngleInCurrentRep, leftAngleDeg);
        this.minRightAngleInCurrentRep = Math.min(this.minRightAngleInCurrentRep, rightAngleDeg);
        this.maxAsymmetryInCurrentRep = Math.max(this.maxAsymmetryInCurrentRep, asymmetry);

        // Check for asymmetry violation
        if (asymmetry > this.config.maxAsymmetryDeg) {
          this.formViolationInCurrentRep = 'ASYMMETRIC_FORM';
          feedbackMessage = `Form warning: Keep left and right sides balanced (${Math.round(asymmetry)}° asymmetry)`;
        }

        // Check if reached DOWN state threshold
        if (leftAngleDeg <= this.config.downAngleThreshold && rightAngleDeg <= this.config.downAngleThreshold) {
          this.currentState = 'DOWN';
          this.reachedDownState = true;
          feedbackMessage = 'Good depth! Push back up to complete repetition.';
        }
        break;

      case 'DOWN':
        // Update tracking
        this.minLeftAngleInCurrentRep = Math.min(this.minLeftAngleInCurrentRep, leftAngleDeg);
        this.minRightAngleInCurrentRep = Math.min(this.minRightAngleInCurrentRep, rightAngleDeg);
        this.maxAsymmetryInCurrentRep = Math.max(this.maxAsymmetryInCurrentRep, asymmetry);

        if (asymmetry > this.config.maxAsymmetryDeg) {
          this.formViolationInCurrentRep = 'ASYMMETRIC_FORM';
          feedbackMessage = `Form warning: High asymmetry detected (${Math.round(asymmetry)}°)`;
        } else {
          feedbackMessage = 'Push back up fully';
        }

        // Transition back UP to complete rep
        if (leftAngleDeg >= this.config.upAngleThreshold && rightAngleDeg >= this.config.upAngleThreshold) {
          const durationMs = Math.max(0, timestampMs - this.currentRepStartTimeMs);
          const isValid = !this.formViolationInCurrentRep && this.reachedDownState;
          const totalAttempts = this.validReps + this.invalidReps + 1;

          lastRepRecord = {
            repIndex: totalAttempts,
            timestampMs,
            durationMs,
            isValid,
            minLeftAngle: Math.round(this.minLeftAngleInCurrentRep * 10) / 10,
            minRightAngle: Math.round(this.minRightAngleInCurrentRep * 10) / 10,
            maxAsymmetryDeg: Math.round(this.maxAsymmetryInCurrentRep * 10) / 10,
            invalidReason: isValid ? undefined : this.formViolationInCurrentRep,
          };

          this.repHistory.push(lastRepRecord);
          this.minLeftAngleInCurrentRep = 180;
          this.minRightAngleInCurrentRep = 180;
          this.reachedDownState = false;

          if (isValid) {
            this.validReps++;
            this.currentState = 'VALID_REP';
            repCompleted = true;
            feedbackMessage = `Repetition ${this.validReps} Verified! ✅`;
          } else {
            this.invalidReps++;
            this.currentState = 'UP';
            repCompleted = true;
            feedbackMessage = `Repetition Rejected ❌ (${lastRepRecord.invalidReason})`;
          }

        }
        break;

      case 'VALID_REP':
        // Brief state before continuing next rep
        this.currentState = 'UP';
        feedbackMessage = 'Ready for next repetition';
        break;
    }

    // Half-rep detection: If in UP state, and previously descended but reversed back UP without hitting DOWN threshold
    if (
      this.currentState === 'UP' &&
      !this.reachedDownState &&
      this.minLeftAngleInCurrentRep < this.config.upAngleThreshold - 20 &&
      avgAngle >= this.config.upAngleThreshold
    ) {

      // Incomplete depth / half-rep!
      const totalAttempts = this.validReps + this.invalidReps + 1;
      lastRepRecord = {
        repIndex: totalAttempts,
        timestampMs,
        durationMs: Math.max(0, timestampMs - this.currentRepStartTimeMs),
        isValid: false,
        minLeftAngle: Math.round(this.minLeftAngleInCurrentRep * 10) / 10,
        minRightAngle: Math.round(this.minRightAngleInCurrentRep * 10) / 10,
        maxAsymmetryDeg: Math.round(this.maxAsymmetryInCurrentRep * 10) / 10,
        invalidReason: 'HALF_REP_INCOMPLETE_ROM',
      };

      this.repHistory.push(lastRepRecord);
      this.invalidReps++;
      repCompleted = true;
      feedbackMessage = 'Repetition Rejected ❌ (Incomplete depth / Half-rep)';
      this.minLeftAngleInCurrentRep = 180;
      this.minRightAngleInCurrentRep = 180;
      this.currentRepStartTimeMs = 0;

    }

    const totalAttempts = this.validReps + this.invalidReps;
    const formAccuracyPercent =
      totalAttempts > 0 ? Math.round((this.validReps / totalAttempts) * 1000) / 10 : 100.0;

    return {
      state: this.currentState,
      validReps: this.validReps,
      invalidReps: this.invalidReps,
      totalAttempts,
      repCompleted,
      lastRepRecord,
      feedbackMessage,
      formAccuracyPercent,
    };
  }
}

export function createExerciseFSM(config?: Partial<ExerciseFSMConfig>): ExerciseFSM {
  return new ExerciseFSM(config);
}
