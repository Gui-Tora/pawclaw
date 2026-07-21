export const PET_MOODS = ['idle', 'thinking', 'happy', 'busy', 'sleeping', 'offline'] as const;

export type PetMood = (typeof PET_MOODS)[number];
export type WindowKind = 'pet' | 'chat' | 'settings';

export interface PetManifest {
  id: string;
  name: string;
  version: string;
  entry: string;
  supportedStates: PetMood[];
}

export interface GatewayStatus {
  connected: boolean;
  endpoint: string;
  detail?: string;
}
