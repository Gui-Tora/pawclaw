import type { PetEvent, PetMood } from '@openclaw-pet/shared';
import { nextPetMood } from './state-machine.js';

export class PetController {
  #mood: PetMood = 'offline';

  get mood(): PetMood { return this.#mood; }

  dispatch(event: PetEvent): PetMood {
    this.#mood = nextPetMood(event);
    return this.#mood;
  }
}
