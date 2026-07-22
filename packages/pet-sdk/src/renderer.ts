import type { PetMood } from '@pawclaw/shared';

export interface PetRendererContract {
  setMood(mood: PetMood): void;
}
