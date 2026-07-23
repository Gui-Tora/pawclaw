import type { PetAnimationDefinition, PetAnimationLayout } from '@pawclaw/shared';

export interface ResolvedSpriteLayout {
  crop: { top: number; right: number; bottom: number; left: number };
  viewWidth: number;
  viewHeight: number;
  offsetX: number;
  offsetY: number;
  anchorX: number;
  groundY: number;
}

function clamp(value: number | undefined, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

/**
 * Merges the author-defined layout with an optional user override. The result
 * is safe to render even if a persisted override was created for a different
 * version of a pet: crop values are clamped to leave at least one source pixel.
 */
export function resolveSpriteLayout(
  animation: PetAnimationDefinition,
  override?: PetAnimationLayout
): ResolvedSpriteLayout {
  const layout = { ...animation.layout, ...override };
  const requestedCrop = layout.crop ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const left = clamp(requestedCrop.left, 0, animation.frameWidth - 1);
  const right = clamp(requestedCrop.right, 0, animation.frameWidth - left - 1);
  const top = clamp(requestedCrop.top, 0, animation.frameHeight - 1);
  const bottom = clamp(requestedCrop.bottom, 0, animation.frameHeight - top - 1);

  return {
    crop: { top, right, bottom, left },
    viewWidth: animation.frameWidth - left - right,
    viewHeight: animation.frameHeight - top - bottom,
    offsetX: clamp(layout.offsetX ?? 0, -4096, 4096),
    offsetY: clamp(layout.offsetY ?? 0, -4096, 4096),
    anchorX: clamp(layout.anchorX ?? Math.floor(animation.frameWidth / 2), 0, animation.frameWidth),
    groundY: clamp(layout.groundY ?? animation.frameHeight, 0, animation.frameHeight)
  };
}
