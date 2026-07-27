import React, { useState } from 'react';

export interface MuscleInfo {
  id: string;
  name: string;
  locationName: string;
  exercise: string;
  status: 'optimal' | 'needs_focus' | 'fatigued';
  score: number;
  svgPos: { x: number; y: number }; // SVG coordinate space (400 x 600)
  whereToImprove: string;
  howToImprove: string;
  recommendedDrills: string[];
}

export const MUSCLE_GROUPS: MuscleInfo[] = [
  {
    id: 'chest',
    name: 'Pectoralis Major & Triceps',
    locationName: 'Sternal & Clavicular Chest, Triceps Lateral Head',
    exercise: 'Push-Ups & Horizontal Press',
    status: 'needs_focus',
    score: 78,
    svgPos: { x: 200, y: 195 },
    whereToImprove: 'Elbow Flexion Depth & Chest Touch Point',
    howToImprove: 'Lower chest until elbow joint angle reaches ≤ 90°. Avoid flaring elbows past 45° to protect shoulder capsular stability.',
    recommendedDrills: ['Pause Push-Ups at 90°', 'Bilateral Arm Balance Drills', 'Tempo Eccentric Down (3s)'],
  },
  {
    id: 'shoulders',
    name: 'Deltoids & Upper Trapezius',
    locationName: 'Anterior & Lateral Deltoids',
    exercise: 'Overhead Press & Arm Drive',
    status: 'optimal',
    score: 92,
    svgPos: { x: 130, y: 175 },
    whereToImprove: 'Scapular Retraction & Overhead Reach',
    howToImprove: 'Maintain stable scapular depression. Avoid shrugging trap muscles during upper arm push phase.',
    recommendedDrills: ['Band Face Pulls', 'Scapular Push-Ups', 'Y-T-W Dumbbell Flies'],
  },
  {
    id: 'core',
    name: 'Rectus Abdominis & Obliques',
    locationName: 'Anterior Core & Transverse Abdominis',
    exercise: 'Plank Hold & Pelvic Stability',
    status: 'optimal',
    score: 88,
    svgPos: { x: 200, y: 245 },
    whereToImprove: 'Lumbar Spine Anti-Extension',
    howToImprove: 'Engage deep core bracing to prevent lower back sagging during push-ups or landing phases.',
    recommendedDrills: ['Hollow Body Holds', 'Deadbugs', 'Paloff Press'],
  },
  {
    id: 'quadriceps',
    name: 'Quadriceps Femoris',
    locationName: 'Vastus Lateralis, Medialis & Rectus Femoris',
    exercise: 'Squats & Jump Takeoff Drive',
    status: 'needs_focus',
    score: 74,
    svgPos: { x: 165, y: 355 },
    whereToImprove: 'Parallel Squat Depth & Knee Tracking',
    howToImprove: 'Achieve full parallel knee flexion (≤ 95°). Ensure knees track over 2nd-3rd toes without valgus collapse.',
    recommendedDrills: ['Goblet Pause Squats', 'Single-Leg Bulgarian Split Squats', 'Eccentric Squat Slow Downs'],
  },
  {
    id: 'glutes_hamstrings',
    name: 'Gluteus Maximus & Hamstrings',
    locationName: 'Posterior Hip Extension Chain',
    exercise: 'Countermovement Jump & Hip Hinge',
    status: 'optimal',
    score: 91,
    svgPos: { x: 235, y: 345 },
    whereToImprove: 'Explosive Hip Hinge Rate of Force Development',
    howToImprove: 'Accelerate rapidly through hip extension at peak takeoff phase during countermovement jump.',
    recommendedDrills: ['Romanian Deadlifts', 'Kettlebell Swings', 'Depth Jumps'],
  },
  {
    id: 'calves',
    name: 'Gastrocnemius & Soleus',
    locationName: 'Ankle Plantarflexors & Achilles Tendon',
    exercise: 'Vertical Jump Ankle Stiffness & Flight',
    status: 'optimal',
    score: 86,
    svgPos: { x: 162, y: 465 },
    whereToImprove: 'Ankle Reactivity & Elastic Energy Recoil',
    howToImprove: 'Minimize ground contact time by maintaining stiff ankle tendon spring reaction during pogo hops.',
    recommendedDrills: ['Ankle Pogo Hops', 'Single-Leg Calf Raises', 'Drop Jumps'],
  },
];

export function HumanModel3D({ onSelectMuscle }: { onSelectMuscle?: (m: MuscleInfo) => void }) {
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleInfo | null>(MUSCLE_GROUPS[0]);

  // Organic Bezier Curves forming an athletic, curved human silhouette with distinct legs, waist & rounded deltoids
  const leftBodyContour = "M 200,85 C 212,85 222,96 222,112 C 222,126 214,136 206,140 L 206,152 C 224,156 248,162 268,172 C 278,178 284,188 286,200 C 284,212 278,245 272,275 L 268,285 C 262,280 256,240 252,210 C 242,215 228,220 220,225 C 216,245 214,275 216,300 C 224,325 232,365 234,410 C 235,435 232,460 230,490 C 228,515 224,535 218,542 C 214,545 208,545 205,540 C 205,510 206,470 206,430 L 206,315 C 202,315 198,315 194,315 L 194,430 C 194,470 195,510 195,540 C 192,545 186,545 182,542 C 176,535 172,515 170,490 C 168,460 165,435 166,410 C 168,365 176,325 184,300 C 186,275 184,245 180,225 C 172,220 158,215 148,210 C 144,240 138,280 132,285 L 128,275 C 122,245 116,212 114,200 C 116,188 122,178 132,172 C 152,162 176,156 194,152 L 194,140 C 186,136 178,126 178,112 C 178,96 188,85 200,85 Z";

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '480px', display: 'flex', alignItems: 'center', background: '#000000', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      {/* 100% Organic Holographic Human Silhouette Display */}
      <div style={{ flex: '1 1 52%', height: '480px', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg
          viewBox="0 0 400 600"
          style={{ width: '100%', height: '100%', maxHeight: '480px', filter: 'drop-shadow(0 0 16px rgba(0, 240, 255, 0.85))' }}
        >
          <defs>
            {/* Background Vertical Light Beams */}
            <linearGradient id="bgBeamGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0)" />
              <stop offset="50%" stopColor="rgba(0, 240, 255, 0.16)" />
              <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
            </linearGradient>

            {/* Neon Cyan Rim Glow */}
            <linearGradient id="rimGlow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00f0ff" />
              <stop offset="50%" stopColor="#00d2ff" />
              <stop offset="100%" stopColor="#0099ff" />
            </linearGradient>

            {/* Translucent Body Fill */}
            <radialGradient id="innerBodyGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="rgba(0, 240, 255, 0.28)" />
              <stop offset="60%" stopColor="rgba(0, 160, 255, 0.12)" />
              <stop offset="100%" stopColor="rgba(0, 40, 80, 0.04)" />
            </radialGradient>

            {/* Neon Cyan Filter */}
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

          {/* Background Vertical Holographic Light Rays */}
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

          {/* Glossy Floor Reflection */}
          <ellipse cx="200" cy="548" rx="85" ry="10" fill="rgba(0, 240, 255, 0.25)" filter="blur(6px)" />
          <line x1="140" y1="546" x2="260" y2="546" stroke="#00f0ff" strokeWidth="3" opacity="0.9" filter="drop-shadow(0 0 8px #00f0ff)" />

          {/* Organic Internal Muscle Fiber Spline Lines (Chest, Abs, Lats, Quads, Calves) */}
          {/* Spinal Line */}
          <path d="M 200,150 L 200,315" stroke="#00f0ff" strokeWidth="2.5" opacity="0.8" filter="drop-shadow(0 0 6px #00f0ff)" />

          {/* Organic Pectoral & Lat Rib Curves */}
          <path d="M 175,185 C 190,195 210,195 225,185" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.8" fill="none" />
          <path d="M 172,205 C 190,218 210,218 228,205" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.8" fill="none" />
          
          {/* Abdominal Core Striations */}
          <path d="M 182,230 L 218,230" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" />
          <path d="M 184,250 L 216,250" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" />
          <path d="M 186,270 L 214,270" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" />

          {/* Distinct Curved Left Leg (Quads & Calf Muscle Curves) */}
          <path d="M 184,300 C 174,340 170,390 172,420 C 174,450 170,490 178,535" stroke="rgba(0, 240, 255, 0.65)" strokeWidth="1.8" fill="none" />
          <path d="M 194,315 C 192,360 190,410 194,440 C 196,470 194,510 194,538" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" fill="none" />

          {/* Distinct Curved Right Leg (Quads & Calf Muscle Curves) */}
          <path d="M 216,300 C 226,340 230,390 228,420 C 226,450 230,490 222,535" stroke="rgba(0, 240, 255, 0.65)" strokeWidth="1.8" fill="none" />
          <path d="M 206,315 C 208,360 210,410 206,440 C 204,470 206,510 206,538" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.5" fill="none" />

          {/* 100% Organic Curved Athletic Silhouette */}
          <path
            d={leftBodyContour}
            fill="url(#innerBodyGrad)"
            stroke="url(#rimGlow)"
            strokeWidth="3.2"
            strokeLinejoin="round"
            filter="url(#neonCyanGlow)"
          />

          {/* Interactive Muscle Group Overlay Hotspots */}
          {MUSCLE_GROUPS.map((m) => {
            const isHovered = hoveredMuscle?.id === m.id;
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
                onMouseEnter={() => {
                  setHoveredMuscle(m);
                  onSelectMuscle?.(m);
                }}
              >
                {/* Active Muscle Highlight Aura */}
                {isHovered ? (
                  <circle
                    cx={m.svgPos.x}
                    cy={m.svgPos.y}
                    r="28"
                    fill={color}
                    opacity="0.35"
                    filter="drop-shadow(0 0 16px #00f0ff)"
                  />
                ) : null}

                {/* Hotspot Outer Pulsing Beacon */}
                <circle
                  cx={m.svgPos.x}
                  cy={m.svgPos.y}
                  r={isHovered ? 11 : 7}
                  fill={isHovered ? color : 'rgba(0, 240, 255, 0.85)'}
                  stroke="#ffffff"
                  strokeWidth={isHovered ? 2.5 : 1}
                  filter="drop-shadow(0 0 8px #00f0ff)"
                />

                {/* Hotspot Inner Dot */}
                <circle cx={m.svgPos.x} cy={m.svgPos.y} r="3" fill="#ffffff" />
              </g>
            );
          })}
        </svg>

        <div style={{ position: 'absolute', bottom: 12, left: 16, fontSize: '0.75rem', color: '#00f0ff', display: 'flex', alignItems: 'center', gap: '0.4rem', textShadow: '0 0 8px #00f0ff' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 10px #00f0ff' }} />
          Organic Athletic Hologram • Hover muscle hotspots
        </div>
      </div>

      {/* Interactive Muscle Diagnostics & Improvement Tooltip Card */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
            <div>
              <span className="fz-kicker" style={{ color: '#00f0ff', letterSpacing: '0.08em' }}>
                ANATOMICAL TARGET
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
              🎯 Primary Assessment Impact
            </span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#ffffff' }}>{hoveredMuscle.exercise}</span>
          </div>

          <div style={{ display: 'grid', gap: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
            <div>
              <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.2rem' }}>📍 Where to Improve:</strong>
              <p style={{ margin: 0, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{hoveredMuscle.whereToImprove}</p>
            </div>

            <div>
              <strong style={{ color: '#00f0ff', display: 'block', marginBottom: '0.2rem' }}>💡 How to Improve:</strong>
              <p style={{ margin: 0, color: '#ffffff', lineHeight: 1.5 }}>{hoveredMuscle.howToImprove}</p>
            </div>

            <div>
              <strong style={{ color: 'var(--ink-mid)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                ⚡ Recommended Form Drills:
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
