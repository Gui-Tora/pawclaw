import type { PetEvent, PetMood } from '@pawclaw/shared';

const transitions: Record<PetEvent['type'], PetMood> = {
  'agent:thinking': 'thinking',
  'agent:response': 'happy',
  'gateway:connected': 'idle',
  'gateway:disconnected': 'offline',
  'user:idle': 'sleeping',
  'user:open-chat': 'idle'
};

export function nextPetMood(event: PetEvent): PetMood {
  return transitions[event.type];
}
