import type { PetEvent } from '@openclaw-pet/shared';

export function eventFromGateway(connected: boolean): PetEvent {
  return { type: connected ? 'gateway:connected' : 'gateway:disconnected' };
}
