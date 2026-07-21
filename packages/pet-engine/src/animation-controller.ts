import type { PetMood } from '@openclaw-pet/shared';

export function animationForMood(mood: PetMood): string {
  return `mood-${mood}`;
}
