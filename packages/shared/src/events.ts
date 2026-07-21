import type { PetMood } from './types.js';

export type PetEvent =
  | { type: 'agent:thinking' }
  | { type: 'agent:response' }
  | { type: 'gateway:connected' }
  | { type: 'gateway:disconnected' }
  | { type: 'user:idle' }
  | { type: 'user:open-chat' };

export interface PetStateChangedEvent {
  mood: PetMood;
  reason: PetEvent['type'];
}
