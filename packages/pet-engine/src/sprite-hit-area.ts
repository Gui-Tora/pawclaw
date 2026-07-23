import { resolveSpriteLayout } from './sprite-layout.js';
import type { PetAnimationState, PetCalibration, PetManifest } from '@pawclaw/shared';

export interface SpriteStageSize {
  width: number;
  height: number;
}

export interface SpriteHitArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the smallest practical rectangular hit area for the selected
 * sprite. Alpha masks are platform-specific, so this intentionally uses the
 * calibrated viewport plus a small drag margin rather than pretending every
 * irregular pixel can be hit-tested natively.
 */
export function spriteHitArea(
  manifest: PetManifest,
  calibration: PetCalibration | undefined,
  stage: SpriteStageSize,
  padding = 8
): SpriteHitArea | undefined {
  const scale = calibration?.scale ?? manifest.scale;
  if (stage.width <= 0 || stage.height <= 0) return undefined;
  let left = stage.width;
  let top = stage.height;
  let right = 0;
  let bottom = 0;

  // Use the union across available animations so a wider walk or alert frame
  // never becomes unclickable when the idle animation has a tighter crop.
  for (const [state, animation] of Object.entries(manifest.animations)) {
    const layout = resolveSpriteLayout(animation, calibration?.animations?.[state as PetAnimationState]);
    const width = Math.round(layout.viewWidth * scale);
    const height = Math.round(layout.viewHeight * scale);
    if (width <= 0 || height <= 0) continue;
    const frameLeft = Math.floor((stage.width - width) / 2 + layout.offsetX * scale) - padding;
    const frameTop = Math.floor(stage.height - height + layout.offsetY * scale) - padding;
    left = Math.min(left, frameLeft);
    top = Math.min(top, frameTop);
    right = Math.max(right, Math.ceil(frameLeft + width + padding * 2));
    bottom = Math.max(bottom, Math.ceil(frameTop + height + padding * 2));
  }
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const clippedRight = Math.min(stage.width, right);
  const clippedBottom = Math.min(stage.height, bottom);
  if (clippedRight <= x || clippedBottom <= y) return undefined;
  return { x, y, width: clippedRight - x, height: clippedBottom - y };
}
