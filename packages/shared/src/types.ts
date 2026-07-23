export const PET_MOODS = ['idle', 'thinking', 'happy', 'busy', 'sleeping', 'offline'] as const;
export const PET_ANIMATION_STATES = ['idle', 'walk', 'sleep', 'think', 'talk', 'celebrate', 'alert'] as const;
export const PET_MOTION_MODES = ['disabled', 'manual', 'taskbar'] as const;
export const PET_LOCOMOTION_STATES = ['stationary', 'walking'] as const;
export const PET_DIRECTIONS = ['left', 'right'] as const;

export type PetMood = (typeof PET_MOODS)[number];
export type PetAnimationState = (typeof PET_ANIMATION_STATES)[number];
export type PetMotionMode = (typeof PET_MOTION_MODES)[number];
export type PetLocomotionState = (typeof PET_LOCOMOTION_STATES)[number];
export type PetDirection = (typeof PET_DIRECTIONS)[number];

/**
 * Runtime-only movement state. It deliberately has no screen coordinates or
 * persistence fields: Electron owns window placement, while settings and
 * calibration are introduced in later stages.
 */
export interface PetMotionState {
  mode: PetMotionMode;
  locomotion: PetLocomotionState;
  direction: PetDirection;
}

export const DEFAULT_PET_MOTION_STATE: PetMotionState = {
  mode: 'manual',
  locomotion: 'stationary',
  direction: 'right'
};

export interface PetSpriteInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Source-pixel adjustments shared by author defaults and user calibration.
 * Anchor coordinates refer to the unscaled animation frame, before cropping.
 */
export interface PetAnimationLayout {
  crop?: PetSpriteInsets;
  offsetX?: number;
  offsetY?: number;
  anchorX?: number;
  groundY?: number;
}

/** User overrides for one pet. Omitted fields inherit from its manifest. */
export interface PetCalibration {
  scale?: number;
  /** Inverts the artwork's horizontal facing direction for this pet. */
  flipX?: boolean;
  /** Horizontal patrol speed in display-independent pixels per second. */
  motionSpeed?: number;
  animations?: Partial<Record<PetAnimationState, PetAnimationLayout>>;
}

export interface PetAnimationDefinition {
  src: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  fps: number;
  loop: boolean;
  layout?: PetAnimationLayout;
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
