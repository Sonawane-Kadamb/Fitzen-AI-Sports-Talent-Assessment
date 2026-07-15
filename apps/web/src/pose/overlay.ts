/**
 * Real-time skeleton overlay renderer.
 * Draws the MediaPipe pose topology onto a canvas at 60fps, mirroring the
 * source video's aspect. Pure canvas — no per-frame allocations beyond paths.
 */

import type { PoseFrame } from '@fitzen/engines';

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

  if (phaseLabel) {
    ctx.globalAlpha = 1;
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
