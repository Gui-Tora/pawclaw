export const PET_MOODS = ['idle', 'thinking', 'happy', 'busy', 'sleeping', 'offline'] as const;
export const PET_ANIMATION_STATES = ['idle', 'walk', 'sleep', 'think', 'talk', 'celebrate', 'alert'] as const;

export type PetMood = (typeof PET_MOODS)[number];
export type PetAnimationState = (typeof PET_ANIMATION_STATES)[number];
export type WindowKind = 'pet' | 'chat' | 'settings';

export interface PetAnimationDefinition {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps: number;
  loop: boolean;
}

export interface PetAttribution {
  creator: string;
  source: string;
  license: string;
  required: boolean;
}

export interface PetManifest {
  id: string;
  name: string;
  species: string;
  scale: number;
  enabled?: boolean;
  preview?: string;
  attribution?: PetAttribution;
  animations: { idle: PetAnimationDefinition }
    & Partial<Record<Exclude<PetAnimationState, 'idle'>, PetAnimationDefinition>>;
}

export interface GatewayStatus {
  connected: boolean;
  endpoint: string;
  detail?: string;
}
