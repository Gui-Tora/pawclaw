import type { PetMood } from '@openclaw-pet/shared';

export interface PetRendererContract {
  setMood(mood: PetMood): void;
}
