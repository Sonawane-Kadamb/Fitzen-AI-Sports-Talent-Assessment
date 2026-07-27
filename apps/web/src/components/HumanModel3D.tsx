import React, { useMemo, useState } from 'react';
import type { AssessmentRecord, PotentialResult } from '../lib/api';

export interface MuscleInfo {
  id: string;
  name: string;
  locationName: string;
  exercise: string;
  exerciseType: 'jump' | 'pushup' | 'squat';
  status: 'optimal' | 'needs_focus' | 'fatigued';
  score: number;
  svgPos: { x: number; y: number }; // SVG coordinate space (400 x 600)
  whereToImprove: string;
  howToImprove: string;
  recommendedDrills: string[];
}

export interface HumanModel3DProps {
  assessments?: AssessmentRecord[];
  potential?: PotentialResult | null;
  selectedExercise?: 'jump' | 'pushup' | 'squat';
  onSelectExercise?: (exercise: 'jump' | 'pushup' | 'squat') => void;
  onSelectMuscle?: (m: MuscleInfo) => void;
}

export function HumanModel3D({
  assessments = [],
  potential = null,
  selectedExercise = 'jump',
  onSelectExercise,
  onSelectMuscle,
}: HumanModel3DProps) {
  const verified = useMemo(() => assessments.filter((a) => a.integrity === 'verified'), [assessments]);

  const latestPushup = useMemo(() => verified.find((a) => a.test === 'pushup'), [verified]);
  const latestSquat = useMemo(() => verified.find((a) => a.test === 'squat'), [verified]);
  const latestJump = useMemo(() => verified.find((a) => a.test === 'vertical_jump' || !a.test), [verified]);

  const muscleGroups: MuscleInfo[] = useMemo(() => {
    // Assessment Metrics Breakdown
    const pushupAccuracy = latestPushup?.metrics.formAccuracyPercent ?? 82;
    const pushupValidReps = latestPushup?.metrics.validReps ?? 0;
    const pushupTotalAttempts = latestPushup?.metrics.totalAttempts ?? pushupValidReps;
    const pushupAsymmetry = latestPushup?.metrics.avgAsymmetryDeg ?? 5;

    const squatAccuracy = latestSquat?.metrics.formAccuracyPercent ?? 78;
    const squatValidReps = latestSquat?.metrics.validReps ?? 0;
    const squatTotalAttempts = latestSquat?.metrics.totalAttempts ?? squatValidReps;
    const squatAsymmetry = latestSquat?.metrics.avgAsymmetryDeg ?? 6;

    const jumpHeightM = latestJump?.metrics.jumpHeightM ?? 0.42;
    const flightTimeS = latestJump?.metrics.flightTimeS ?? 0.48;

    // Scores & Statuses
    const chestScore = Math.round(pushupAccuracy);
    const shoulderScore = Math.round(Math.max(50, 100 - pushupAsymmetry * 3));
    const bicepScore = Math.round(pushupAccuracy * 0.95);
    const tricepScore = Math.round(pushupAccuracy * 0.98);
    const elbowJointScore = Math.round(Math.max(50, 100 - pushupAsymmetry * 2.5));

    const coreScore = Math.round(potential?.components?.movementQuality ?? 88);
    const hipJointScore = Math.round(potential?.components?.coordination ?? 86);
    const quadScore = Math.round(squatAccuracy);
    const kneeJointScore = Math.round(Math.max(50, 100 - squatAsymmetry * 2.8));

    const hamScore = Math.round(potential?.components?.explosiveness ?? Math.min(98, jumpHeightM * 180));
    const calfScore = Math.round(Math.min(96, flightTimeS * 175));
    const ankleJointScore = Math.round(Math.min(95, flightTimeS * 170));

    const getStatus = (sc: number): 'optimal' | 'needs_focus' | 'fatigued' =>
      sc >= 85 ? 'optimal' : sc >= 70 ? 'needs_focus' : 'fatigued';

    return [
      {
        id: 'chest',
        name: 'Chest',
        locationName: 'Upper Body & Chest',
        exercise: 'Push-Ups & Chest Press',
        exerciseType: 'pushup',
        status: getStatus(chestScore),
        score: chestScore,
        svgPos: { x: 200, y: 195 },
        whereToImprove: latestPushup?.metrics.qualityFlags?.[0] ?? 'Lower chest fully to 90° elbow flexion',
        howToImprove: latestPushup
          ? `Achieved ${pushupValidReps} accurate reps out of ${pushupTotalAttempts} attempts (${pushupAccuracy.toFixed(1)}% rep accuracy). Lower chest fully before pushing up.`
          : 'Perform full range push-ups lowering chest until elbow flexion is <= 90°.',
        recommendedDrills: ['Pause Push-Ups at 90°', 'Chest Touch Drill', 'Slow Eccentric Push-Ups'],
      },
      {
        id: 'shoulders',
        name: 'Shoulders',
        locationName: 'Shoulder Joint & Upper Arms',
        exercise: 'Shoulder Drive & Overhead Support',
        exerciseType: 'pushup',
        status: getStatus(shoulderScore),
        score: shoulderScore,
        svgPos: { x: 135, y: 172 },
        whereToImprove: `Arm Asymmetry: ${pushupAsymmetry.toFixed(1)}° recorded during drive phase`,
        howToImprove: 'Drive evenly through both shoulders without flaring elbows past 45°.',
        recommendedDrills: ['Band Shoulder Presses', 'Scapular Wall Slides', 'Arm Symmetry Push-Ups'],
      },
      {
        id: 'biceps',
        name: 'Biceps & Upper Arms',
        locationName: 'Front Upper Arm & Grip',
        exercise: 'Arm Pulling & Flexion Support',
        exerciseType: 'pushup',
        status: getStatus(bicepScore),
        score: bicepScore,
        svgPos: { x: 122, y: 220 },
        whereToImprove: 'Arm flexion stability during descent',
        howToImprove: 'Control body weight deceleration smoothly on descent.',
        recommendedDrills: ['Chup-Up Holds', 'Isometric Bicep Holds', 'Control Drills'],
      },
      {
        id: 'triceps',
        name: 'Triceps',
        locationName: 'Back Upper Arm',
        exercise: 'Arm Extension & Press Lockout',
        exerciseType: 'pushup',
        status: getStatus(tricepScore),
        score: tricepScore,
        svgPos: { x: 278, y: 220 },
        whereToImprove: 'Full elbow extension lockout at top position',
        howToImprove: 'Push all the way up until arms reach full 160° extension at top.',
        recommendedDrills: ['Diamond Push-Ups', 'Tricep Extension Lockouts', 'Tricep Dips'],
      },
      {
        id: 'elbow_joints',
        name: 'Elbow Joints',
        locationName: 'Left & Right Elbow Joint Flexion',
        exercise: 'Elbow Angle Measurement (Target <= 90°)',
        exerciseType: 'pushup',
        status: getStatus(elbowJointScore),
        score: elbowJointScore,
        svgPos: { x: 125, y: 248 },
        whereToImprove: `Elbow Flexion: Target <= 90° minimum angle`,
        howToImprove: `Keep left and right elbow joint angles balanced to avoid half-reps.`,
        recommendedDrills: ['Elbow Depth Markers', '90° Angle Holds', 'Bilateral Symmetry Drills'],
      },
      {
        id: 'core',
        name: 'Abs & Core',
        locationName: 'Stomach & Core Muscles',
        exercise: 'Core Bracing & Pelvic Stability',
        exerciseType: 'squat',
        status: getStatus(coreScore),
        score: coreScore,
        svgPos: { x: 200, y: 250 },
        whereToImprove: 'Anti-extension core tightness & spinal alignment',
        howToImprove: 'Tuck pelvis slightly and brace abs to keep lower back straight during squats and push-ups.',
        recommendedDrills: ['Plank Holds', 'Hollow Body Bracing', 'Deadbug Core Presses'],
      },
      {
        id: 'hip_joints',
        name: 'Hip Joints',
        locationName: 'Pelvis & Hip Extension Chain',
        exercise: 'Hip Hinge & Pelvic Alignment',
        exerciseType: 'squat',
        status: getStatus(hipJointScore),
        score: hipJointScore,
        svgPos: { x: 200, y: 300 },
        whereToImprove: 'Symmetrical hip hinge drive & depth',
        howToImprove: 'Hinge hips back evenly without shifting weight onto one side.',
        recommendedDrills: ['Glute Bridges', 'Hip Hinge Wall Touches', 'Kettlebell Hinge Drills'],
      },
      {
        id: 'quads',
        name: 'Thighs & Quads',
        locationName: 'Front Thighs',
        exercise: 'Squats & Knee Extension',
        exerciseType: 'squat',
        status: getStatus(quadScore),
        score: quadScore,
        svgPos: { x: 165, y: 360 },
        whereToImprove: latestSquat?.metrics.qualityFlags?.[0] ?? 'Parallel thigh squat depth (flexion <= 95°)',
        howToImprove: latestSquat
          ? `Recorded ${squatValidReps} accurate reps out of ${squatTotalAttempts} attempts (${squatAccuracy.toFixed(1)}% rep accuracy). Lower hips until thighs are parallel to ground.`
          : 'Squat down until thighs are parallel to the ground before standing up.',
        recommendedDrills: ['Parallel Box Squats', 'Goblet Squats', 'Wall Sit Hold'],
      },
      {
        id: 'knee_joints',
        name: 'Knee Joints',
        locationName: 'Left & Right Knee Joint Flexion',
        exercise: 'Knee Tracking & Bilateral Balance',
        exerciseType: 'squat',
        status: getStatus(kneeJointScore),
        score: kneeJointScore,
        svgPos: { x: 172, y: 420 },
        whereToImprove: `Knee Asymmetry: ${squatAsymmetry.toFixed(1)}° recorded`,
        howToImprove: 'Ensure knees track over middle toes without caving inwards (valgus collapse).',
        recommendedDrills: ['Banded Knee Abduction Squats', 'Single-Leg Balance', 'Step Downs'],
      },
      {
        id: 'hamstrings',
        name: 'Hamstrings & Hips',
        locationName: 'Back Thighs & Glutes',
        exercise: 'Vertical Jump Power & Hip Drive',
        exerciseType: 'jump',
        status: getStatus(hamScore),
        score: hamScore,
        svgPos: { x: 235, y: 360 },
        whereToImprove: `Best Jump Height: ${latestJump ? (latestJump.metrics.jumpHeightM * 100).toFixed(1) + ' cm' : 'No jump recorded yet'}`,
        howToImprove: 'Explode upwards quickly through hips and glutes at takeoff.',
        recommendedDrills: ['Romanian Deadlifts', 'Jump Squats', 'Kettlebell Swings'],
      },
      {
        id: 'calves',
        name: 'Calves',
        locationName: 'Lower Legs',
        exercise: 'Jump Takeoff Spring & Landing',
        exerciseType: 'jump',
        status: getStatus(calfScore),
        score: calfScore,
        svgPos: { x: 162, y: 470 },
        whereToImprove: `Flight Time: ${latestJump?.metrics.flightTimeS ? latestJump.metrics.flightTimeS.toFixed(3) + 's' : '0.48s'}`,
        howToImprove: 'Push off balls of feet for maximum elastic vertical spring.',
        recommendedDrills: ['Ankle Pogo Jumps', 'Single-Leg Calf Raises', 'Bounding Drills'],
      },
      {
        id: 'ankle_joints',
        name: 'Ankle Joints',
        locationName: 'Left & Right Ankle Joint Stiffness',
        exercise: 'Ankle Tendon Elastic Stiffness & Ground Contact',
        exerciseType: 'jump',
        status: getStatus(ankleJointScore),
        score: ankleJointScore,
        svgPos: { x: 175, y: 520 },
        whereToImprove: 'Elastic tendon recoil & quick ground contact reaction',
        howToImprove: 'Keep ankle joint stiff on ground contact for maximum energy return.',
        recommendedDrills: ['Drop Jumps', 'Stiff Ankle Pogos', 'Barefoot Ankle Mobility'],
      },
    ];
  }, [latestPushup, latestSquat, latestJump, potential]);

  const activeInitial = useMemo(() => {
    return muscleGroups.find((m) => m.exerciseType === selectedExercise) || muscleGroups[0];
  }, [muscleGroups, selectedExercise]);

  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleInfo | null>(activeInitial);

  React.useEffect(() => {
    const match = muscleGroups.find((m) => m.exerciseType === selectedExercise);
    if (match) setHoveredMuscle(match);
  }, [selectedExercise, muscleGroups]);

  const handleMuscleClick = (m: MuscleInfo) => {
    setHoveredMuscle(m);
    onSelectMuscle?.(m);
    if (onSelectExercise && m.exerciseType !== selectedExercise) {
      onSelectExercise(m.exerciseType);
    }
  };

  const leftBodyContour =
    "M 200,85 C 212,85 222,96 222,112 C 222,126 214,136 206,140 L 206,152 C 224,156 248,162 268,172 C 278,178 284,188 286,200 C 284,212 278,245 272,275 L 268,285 C 262,280 256,240 252,210 C 242,215 228,220 220,225 C 216,245 214,275 216,300 C 224,325 232,365 234,410 C 235,435 232,460 230,490 C 228,515 224,535 218,542 C 214,545 208,545 205,540 C 205,510 206,470 206,430 L 206,315 C 202,315 198,315 194,315 L 194,430 C 194,470 195,510 195,540 C 192,545 186,545 182,542 C 176,535 172,515 170,490 C 168,460 165,435 166,410 C 168,365 176,325 184,300 C 186,275 184,245 180,225 C 172,220 158,215 148,210 C 144,240 138,280 132,285 L 128,275 C 122,245 116,212 114,200 C 116,188 122,178 132,172 C 152,162 176,156 194,152 L 194,140 C 186,136 178,126 178,112 C 178,96 188,85 200,85 Z";

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '490px',
        display: 'flex',
        alignItems: 'center',
        background: '#030712',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid rgba(0, 240, 255, 0.2)',
      }}
    >
      {/* 3D Holographic Human Silhouette */}
      <div style={{ flex: '1 1 52%', height: '490px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg
          viewBox="0 0 400 600"
          style={{
            width: '100%',
            height: '100%',
            maxHeight: '490px',
            filter: 'drop-shadow(0 0 18px rgba(0, 240, 255, 0.85))',
          }}
        >
          <defs>
            <linearGradient id="bgBeamGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
              <stop offset="50%" stopColor="rgba(0, 240, 255, 0.16)" />
              <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
            </linearGradient>

            <linearGradient id="rimGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="50%" stopColor="#00d2ff" />
              <stop offset="100%" stopColor="#0099ff" />
            </linearGradient>

            <radialGradient id="innerBodyGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0.28)" />
              <stop offset="60%" stopColor="rgba(0, 160, 255, 0.12)" />
              <stop offset="100%" stopColor="rgba(0, 40, 80, 0.04)" />
            </radialGradient>

            <filter id="neonCyanGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur1" />
              <feGaussianBlur stdDeviation="12" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Holographic Rays */}
          {[-120, -70, -30, 30, 70, 120].map((offset, idx) => (
            <rect
              key={idx}
              x={200 + offset - 8}
              y="40"
              width="16"
              height="520"
              fill="url(#bgBeamGrad)"
              opacity={0.35 + (idx % 3) * 0.15}
            />
          ))}

          {/* Reflection */}
          <ellipse cx="200" cy="548" rx="85" ry="10" fill="rgba(0, 240, 255, 0.25)" filter="blur(6px)" />
          <line x1="140" y1="546" x2="260" y2="546" stroke="#00f0ff" strokeWidth="3" opacity="0.9" filter="drop-shadow(0 0 8px #00f0ff)" />

          {/* Internal Splines & Joint Connections */}
          <path d="M 200,150 L 200,315" stroke="#00f0ff" strokeWidth="2.5" opacity="0.8" filter="drop-shadow(0 0 6px #00f0ff)" />
          <path d="M 175,185 C 190,195 210,195 225,185" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.8" fill="none" />
          <path d="M 172,205 C 190,218 210,218 228,205" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.8" fill="none" />

          {/* Core striations */}
          <path d="M 182,230 L 218,230" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" />
          <path d="M 184,250 L 216,250" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" />
          <path d="M 186,270 L 214,270" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" />

          {/* Legs */}
          <path d="M 184,300 C 174,340 170,390 172,420 C 174,450 170,490 178,535" stroke="rgba(0, 240, 255, 0.65)" strokeWidth="1.8" fill="none" />
          <path d="M 194,315 C 192,360 190,410 194,440 C 196,470 194,510 194,538" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" fill="none" />
          <path d="M 216,300 C 226,340 230,390 228,420 C 226,450 230,490 222,535" stroke="rgba(0, 240, 255, 0.65)" strokeWidth="1.8" fill="none" />
          <path d="M 206,315 C 208,360 210,410 206,440 C 204,470 206,510 206,538" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" fill="none" />

          {/* Silhouette Contour */}
          <path
            d={leftBodyContour}
            fill="url(#innerBodyGrad)"
            stroke="url(#rimGlow)"
            strokeWidth="3.2"
            strokeLinejoin="round"
            filter="url(#neonCyanGlow)"
          />

          {/* Interactive 12 Muscle & Joint Hotspots */}
          {muscleGroups.map((m) => {
            const isHovered = hoveredMuscle?.id === m.id;
            const isTargetedByExercise = m.exerciseType === selectedExercise;
            const isJoint = m.id.includes('joint');

            const color =
              m.status === 'optimal'
                ? '#00f0ff'
                : m.status === 'needs_focus'
                ? '#ffb703'
                : '#ff0055';

            return (
              <g
                key={m.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredMuscle(m)}
                onClick={() => handleMuscleClick(m)}
              >
                {/* Active Pulse Ring */}
                {isHovered || isTargetedByExercise ? (
                  <circle
                    cx={m.svgPos.x}
                    cy={m.svgPos.y}
                    r={isHovered ? 26 : 18}
                    fill={color}
                    opacity={isHovered ? 0.45 : 0.22}
                    filter="drop-shadow(0 0 14px #00f0ff)"
                  />
                ) : null}

                {/* Hotspot Circle / Diamond for Joints */}
                {isJoint ? (
                  <rect
                    x={m.svgPos.x - (isHovered ? 7 : 5)}
                    y={m.svgPos.y - (isHovered ? 7 : 5)}
                    width={isHovered ? 14 : 10}
                    height={isHovered ? 14 : 10}
                    transform={`rotate(45 ${m.svgPos.x} ${m.svgPos.y})`}
                    fill={isHovered || isTargetedByExercise ? color : 'rgba(0, 240, 255, 0.9)'}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    filter="drop-shadow(0 0 8px #00f0ff)"
                  />
                ) : (
                  <circle
                    cx={m.svgPos.x}
                    cy={m.svgPos.y}
                    r={isHovered ? 11 : isTargetedByExercise ? 8 : 6.5}
                    fill={isHovered || isTargetedByExercise ? color : 'rgba(0, 240, 255, 0.85)'}
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2.5 : 1.2}
                    filter="drop-shadow(0 0 8px #00f0ff)"
                  />
                )}

                <circle cx={m.svgPos.x} cy={m.svgPos.y} r="2.5" fill="#ffffff" />
              </g>
            );
          })}
        </svg>

        <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: '0.75rem', color: '#00f0ff', display: 'flex', alignItems: 'center', gap: '0.4rem', textShadow: '0 0 8px #00f0ff' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 10px #00f0ff' }} />
          12 Interactive Muscle & Joint Hotspots
        </div>
      </div>

      {/* Interactive Biomechanical Diagnostic Card */}
      {hoveredMuscle ? (
        <div
          className="fz-card fz-animate-in"
          style={{
            flex: '1 1 48%',
            marginRight: 'var(--space-4)',
            maxWidth: '380px',
            background: 'rgba(5, 10, 20, 0.96)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 240, 255, 0.45)',
            boxShadow: '0 12px 40px rgba(0, 240, 255, 0.25)',
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          {/* Synchronized Exercise Selection Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: 'var(--space-3)' }}>
            <button
              className={`fz-btn fz-btn--ghost ${hoveredMuscle.exerciseType === 'jump' ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.75rem', background: hoveredMuscle.exerciseType === 'jump' ? 'rgba(0,240,255,0.2)' : 'transparent', color: hoveredMuscle.exerciseType === 'jump' ? '#00f0ff' : 'var(--ink-mid)', border: '1px solid rgba(0,240,255,0.3)' }}
              onClick={() => {
                const match = muscleGroups.find((m) => m.exerciseType === 'jump');
                if (match) handleMuscleClick(match);
              }}
            >
              🚀 Jump
            </button>
            <button
              className={`fz-btn fz-btn--ghost ${hoveredMuscle.exerciseType === 'pushup' ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.75rem', background: hoveredMuscle.exerciseType === 'pushup' ? 'rgba(0,240,255,0.2)' : 'transparent', color: hoveredMuscle.exerciseType === 'pushup' ? '#00f0ff' : 'var(--ink-mid)', border: '1px solid rgba(0,240,255,0.3)' }}
              onClick={() => {
                const match = muscleGroups.find((m) => m.exerciseType === 'pushup');
                if (match) handleMuscleClick(match);
              }}
            >
              💪 Push-Up
            </button>
            <button
              className={`fz-btn fz-btn--ghost ${hoveredMuscle.exerciseType === 'squat' ? 'active' : ''}`}
              style={{ padding: '3px 8px', fontSize: '0.75rem', background: hoveredMuscle.exerciseType === 'squat' ? 'rgba(0,240,255,0.2)' : 'transparent', color: hoveredMuscle.exerciseType === 'squat' ? '#00f0ff' : 'var(--ink-mid)', border: '1px solid rgba(0,240,255,0.3)' }}
              onClick={() => {
                const match = muscleGroups.find((m) => m.exerciseType === 'squat');
                if (match) handleMuscleClick(match);
              }}
            >
              🏋️ Squat
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <span className="fz-kicker" style={{ color: '#00f0ff', letterSpacing: '0.08em' }}>
                MUSCLE & JOINT TARGET
              </span>
              <h3 style={{ margin: '0.2rem 0', fontSize: 'var(--text-lg)', fontWeight: 700, color: '#ffffff' }}>{hoveredMuscle.name}</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-mid)', margin: 0 }}>📍 {hoveredMuscle.locationName}</p>
            </div>
            <div
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 700,
                background:
                  hoveredMuscle.status === 'optimal'
                    ? 'rgba(0, 240, 255, 0.15)'
                    : 'rgba(255, 183, 3, 0.15)',
                color: hoveredMuscle.status === 'optimal' ? '#00f0ff' : '#ffb703',
                border: `1px solid ${hoveredMuscle.status === 'optimal' ? '#00f0ff' : '#ffb703'}`,
              }}
            >
              {hoveredMuscle.score}% Score
            </div>
          </div>

          <div style={{ margin: 'var(--space-3) 0', padding: 'var(--space-3)', background: 'rgba(0, 240, 255, 0.06)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid #00f0ff' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: '#00f0ff', display: 'block', marginBottom: '0.2rem' }}>
              🎯 Primary Assessment Target
            </span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#ffffff' }}>{hoveredMuscle.exercise}</span>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            <div>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.2rem' }}>📍 Form Diagnostic:</strong>
              <p style={{ margin: 0, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{hoveredMuscle.whereToImprove}</p>
            </div>

            <div>
              <strong style={{ color: '#00f0ff', display: 'block', marginBottom: '0.2rem' }}>💡 Biomechanical Advice:</strong>
              <p style={{ margin: 0, color: '#ffffff', lineHeight: 1.5 }}>{hoveredMuscle.howToImprove}</p>
            </div>

            <div>
              <strong style={{ color: 'var(--ink-mid)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                ⚡ Recommended Drills:
              </strong>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {hoveredMuscle.recommendedDrills.map((drill) => (
                  <span
                    key={drill}
                    style={{
                      padding: '0.2rem 0.5rem',
                      background: 'rgba(0, 240, 255, 0.12)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      color: '#00f0ff',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                    }}
                  >
                    {drill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
