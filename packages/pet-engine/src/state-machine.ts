import type { PetEvent, PetMood } from '@pawclaw/shared';

const transitions: Record<PetEvent['type'], PetMood> = {
  'agent:thinking': 'thinking',
  'agent:response': 'happy',
  'gateway:connected': 'idle',
  'gateway:disconnected': 'offline',
  'user:idle': 'sleeping',
  'user:open-chat': 'idle'
};

export function nextPetMood(current: PetMood, event: PetEvent): PetMood {
  // Unknown event types (e.g. arriving over IPC from a newer client) must
  // never produce an undefined mood; keep the current one instead.
  const next: PetMood | undefined = transitions[event.type];
  if (next === undefined) return current;
  // Offline is sticky: user interactions must not paint a healthy mood while
  // the gateway is down. Only gateway events can leave the offline state.
  if (current === 'offline' && !event.type.startsWith('gateway:')) return current;
  return next;
}
