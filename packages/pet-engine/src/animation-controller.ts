import type { PetAnimationState, PetMood } from '@pawclaw/shared';

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
