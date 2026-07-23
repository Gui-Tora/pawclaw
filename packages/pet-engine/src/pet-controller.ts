import type { PetEvent, PetMood } from '@pawclaw/shared';
import { nextPetMood } from './state-machine.js';

export class PetController {
  #mood: PetMood = 'idle';

  get mood(): PetMood { return this.#mood; }

  dispatch(event: PetEvent): PetMood {
    this.#mood = nextPetMood(this.#mood, event);
    return this.#mood;
  }
}
