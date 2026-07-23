import type { PetMotionState, PetMood } from '@pawclaw/shared';

/**
 * The pet only performs automatic movement while taskbar movement is enabled,
 * its locomotion controller has started a walk, and no reactive mood needs to
 * be shown. This keeps agent feedback independent from window locomotion.
 */
export function canPetWalk(mood: PetMood, motion: PetMotionState): boolean {
  return mood === 'idle'
    && motion.mode === 'taskbar'
    && motion.locomotion === 'walking';
}

/**
 * Reactive moods take precedence over locomotion. `busy` is intentionally not
 * considered here: it is a legacy mood whose existing animation mapping is
 * kept for compatibility, but new movement controllers must use locomotion.
 */
export function isMovementSuppressedByMood(mood: PetMood): boolean {
  return mood === 'thinking'
    || mood === 'happy'
    || mood === 'sleeping'
    || mood === 'offline';
}
