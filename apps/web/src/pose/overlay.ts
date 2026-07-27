/**
 * Real-time skeleton overlay renderer.
 * Draws the MediaPipe pose topology and live 3D joint angle badges onto canvas at 60fps.
 */

import { calculate3DVectorAngle, type PoseFrame } from '@fitzen/engines';

const CONNECTIONS: Array<[number, number]> = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso
  [23, 24], // hips
  [23, 25], [25, 27], [27, 29], [27, 31], // left leg
  [24, 26], [26, 28], [28, 30], [28, 32], // right leg
];

const KEY_POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

function drawAngleBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angleDeg: number,
  label: string
): void {
  const text = `${label}: ${Math.round(angleDeg)}°`;
  ctx.font = '600 12px system-ui, sans-serif';
  const metrics = ctx.measureText(text);
  const pad = 6;
  const bw = metrics.width + pad * 2;
  const bh = 20;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = '#c8f135';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x - bw / 2, y - bh / 2, bw, bh, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function drawPoseOverlay(
  canvas: HTMLCanvasElement,
  frame: PoseFrame | null,
  phaseLabel: string | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  if (!frame) return;

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--volt').trim() || '#c8f135';

  ctx.lineWidth = Math.max(2, width / 320);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.9;
  ctx.lineCap = 'round';

  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    const pa = frame.landmarks[a];
    const pb = frame.landmarks[b];
    if (!pa || !pb || pa.visibility < 0.35 || pb.visibility < 0.35) continue;
    ctx.moveTo(pa.x * width, pa.y * height);
    ctx.lineTo(pb.x * width, pb.y * height);
  }
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  for (const i of KEY_POINTS) {
    const p = frame.landmarks[i];
    if (!p || p.visibility < 0.35) continue;
    ctx.beginPath();
    ctx.arc(p.x * width, p.y * height, Math.max(2.5, width / 300), 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw live joint angle badges for elbows and knees
  const lS = frame.landmarks[11];
  const lE = frame.landmarks[13];
  const lW = frame.landmarks[15];
  if (lS && lE && lW && lS.visibility > 0.4 && lE.visibility > 0.4 && lW.visibility > 0.4) {
    const angle = calculate3DVectorAngle(lS, lE, lW);
    if (angle.isValid) {
      drawAngleBadge(ctx, lE.x * width, lE.y * height - 16, angle.angleDeg, 'L-Elbow');
    }
  }

  const rS = frame.landmarks[12];
  const rE = frame.landmarks[14];
  const rW = frame.landmarks[16];
  if (rS && rE && rW && rS.visibility > 0.4 && rE.visibility > 0.4 && rW.visibility > 0.4) {
    const angle = calculate3DVectorAngle(rS, rE, rW);
    if (angle.isValid) {
      drawAngleBadge(ctx, rE.x * width, rE.y * height - 16, angle.angleDeg, 'R-Elbow');
    }
  }

  const lH = frame.landmarks[23];
  const lK = frame.landmarks[25];
  const lA = frame.landmarks[27];
  if (lH && lK && lA && lH.visibility > 0.4 && lK.visibility > 0.4 && lA.visibility > 0.4) {
    const angle = calculate3DVectorAngle(lH, lK, lA);
    if (angle.isValid) {
      drawAngleBadge(ctx, lK.x * width, lK.y * height + 16, angle.angleDeg, 'L-Knee');
    }
  }

  const rH = frame.landmarks[24];
  const rK = frame.landmarks[26];
  const rA = frame.landmarks[28];
  if (rH && rK && rA && rH.visibility > 0.4 && rK.visibility > 0.4 && rA.visibility > 0.4) {
    const angle = calculate3DVectorAngle(rH, rK, rA);
    if (angle.isValid) {
      drawAngleBadge(ctx, rK.x * width, rK.y * height + 16, angle.angleDeg, 'R-Knee');
    }
  }

  if (phaseLabel) {
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const pad = 10;
    ctx.font = `700 ${Math.max(13, width / 46)}px system-ui, sans-serif`;
    const metrics = ctx.measureText(phaseLabel);
    const boxW = metrics.width + pad * 2;
    const boxH = Math.max(26, width / 28);
    ctx.fillStyle = 'rgba(10, 12, 16, 0.75)';
    ctx.beginPath();
    ctx.roundRect(12, 12, boxW, boxH, 8);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillText(phaseLabel, 12 + pad, 12 + boxH / 2 + 5);
  }
  ctx.globalAlpha = 1;
}
