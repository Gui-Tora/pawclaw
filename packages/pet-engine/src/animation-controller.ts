import type { PetAnimationState, PetMotionState, PetMood } from '@pawclaw/shared';
import { canPetWalk } from './motion-contract.js';

const moodAnimations: Record<PetMood, PetAnimationState> = {
  idle: 'idle',
  thinking: 'think',
  happy: 'talk',
  busy: 'walk',
  sleeping: 'sleep',
  offline: 'alert'
};

export function animationForMood(mood: PetMood): PetAnimationState {
  return moodAnimations[mood];
}

/**
 * Resolves the animation shown by the desktop pet. Locomotion is allowed to
 * select `walk` only from an idle mood; every reactive mood keeps control of
 * its own animation. The legacy `busy` mapping remains in animationForMood
 * for callers that still use the mood-only API.
 */
export function animationForPetState(
  mood: PetMood,
  motion: PetMotionState
): PetAnimationState {
  return canPetWalk(mood, motion) ? 'walk' : animationForMood(mood);
}
