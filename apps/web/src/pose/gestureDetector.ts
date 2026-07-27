import type { PoseFrame } from '@fitzen/engines';

export type HandGesture = 'thumbs_up' | 'thumbs_down' | null;

/**
 * Detects hands-free gestures (Thumbs Up to start, Thumbs Down to stop)
 * from MediaPipe pose landmark positions at 60 FPS.
 */
export function detectHandGesture(frame: PoseFrame | null): HandGesture {
  if (!frame || !frame.landmarks) return null;

  const lWrist = frame.landmarks[15];
  const rWrist = frame.landmarks[16];
  const lPinky = frame.landmarks[17];
  const rPinky = frame.landmarks[18];
  const lIndex = frame.landmarks[19];
  const rIndex = frame.landmarks[20];
  const lThumb = frame.landmarks[21];
  const rThumb = frame.landmarks[22];

  // 1. Check Left Hand
  if (lWrist && lThumb && lWrist.visibility > 0.35 && lThumb.visibility > 0.35) {
    // Thumbs Up: Thumb tip extended UP above wrist and knuckles
    if (lThumb.y < lWrist.y - 0.055) {
      if (!lIndex || !lPinky || (lIndex.y >= lThumb.y + 0.02 && lPinky.y >= lThumb.y + 0.02)) {
        return 'thumbs_up';
      }
    }
    // Thumbs Down: Thumb tip extended DOWN below wrist and knuckles
    if (lThumb.y > lWrist.y + 0.055) {
      if (!lIndex || !lPinky || (lThumb.y > lIndex.y + 0.03 && lThumb.y > lPinky.y + 0.03)) {
        return 'thumbs_down';
      }
    }
  }

  // 2. Check Right Hand
  if (rWrist && rThumb && rWrist.visibility > 0.35 && rThumb.visibility > 0.35) {
    // Thumbs Up: Thumb tip extended UP above wrist and knuckles
    if (rThumb.y < rWrist.y - 0.055) {
      if (!rIndex || !rPinky || (rIndex.y >= rThumb.y + 0.02 && rPinky.y >= rThumb.y + 0.02)) {
        return 'thumbs_up';
      }
    }
    // Thumbs Down: Thumb tip extended DOWN below wrist and knuckles
    if (rThumb.y > rWrist.y + 0.055) {
      if (!rIndex || !rPinky || (rThumb.y > rIndex.y + 0.03 && rThumb.y > rPinky.y + 0.03)) {
        return 'thumbs_down';
      }
    }
  }

  return null;
}
