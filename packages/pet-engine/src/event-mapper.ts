import type { PetEvent } from '@pawclaw/shared';

export function eventFromGateway(connected: boolean): PetEvent {
  return { type: connected ? 'gateway:connected' : 'gateway:disconnected' };
}
