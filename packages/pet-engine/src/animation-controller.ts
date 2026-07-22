import type { PetMood } from '@pawclaw/shared';

export function animationForMood(mood: PetMood): string {
  return `mood-${mood}`;
}
