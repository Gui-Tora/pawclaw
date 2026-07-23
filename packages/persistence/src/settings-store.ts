import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  DEFAULT_PET_ID,
  PET_ANIMATION_STATES,
  PET_MOTION_MODES,
  type PetAnimationLayout,
  type PetCalibration,
  type PetMotionMode,
  type PetSpriteInsets
} from '@pawclaw/shared';

export interface PetSettings {
  activePetId: string;
  alwaysOnTop: boolean;
  motionMode: PetMotionMode;
  petCalibrations: Record<string, PetCalibration>;
}

export const defaultSettings: PetSettings = {
  activePetId: DEFAULT_PET_ID,
  alwaysOnTop: true,
  motionMode: 'manual',
  petCalibrations: {}
};

const petIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const motionModes = new Set<string>(PET_MOTION_MODES);
const animationStates = new Set<string>(PET_ANIMATION_STATES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.25 && value <= 16;
}

function parseInsets(value: unknown): PetSpriteInsets | undefined {
  if (!isRecord(value) || Object.keys(value).length !== 4) return undefined;
  if (!isIntegerInRange(value.top, 0, 4095)
    || !isIntegerInRange(value.right, 0, 4095)
    || !isIntegerInRange(value.bottom, 0, 4095)
    || !isIntegerInRange(value.left, 0, 4095)) return undefined;
  return { top: value.top, right: value.right, bottom: value.bottom, left: value.left };
}

function parseAnimationLayout(value: unknown): PetAnimationLayout | undefined {
  if (!isRecord(value)) return undefined;
  const allowed = new Set(['crop', 'offsetX', 'offsetY', 'anchorX', 'groundY']);
  const keys = Object.keys(value);
  if (keys.length === 0 || !keys.every((key) => allowed.has(key))) return undefined;

  const layout: PetAnimationLayout = {};
  if ('crop' in value) {
    const crop = parseInsets(value.crop);
    if (!crop) return undefined;
    layout.crop = crop;
  }
  if ('offsetX' in value) {
    if (!isIntegerInRange(value.offsetX, -4096, 4096)) return undefined;
    layout.offsetX = value.offsetX;
  }
  if ('offsetY' in value) {
    if (!isIntegerInRange(value.offsetY, -4096, 4096)) return undefined;
    layout.offsetY = value.offsetY;
  }
  if ('anchorX' in value) {
    if (!isIntegerInRange(value.anchorX, 0, 4096)) return undefined;
    layout.anchorX = value.anchorX;
  }
  if ('groundY' in value) {
    if (!isIntegerInRange(value.groundY, 0, 4096)) return undefined;
    layout.groundY = value.groundY;
  }
  return layout;
}

function parseCalibration(value: unknown): PetCalibration | undefined {
  if (!isRecord(value)) return undefined;
  const allowed = new Set(['scale', 'animations']);
  const keys = Object.keys(value);
  if (keys.length === 0 || !keys.every((key) => allowed.has(key))) return undefined;

  const calibration: PetCalibration = {};
  if ('scale' in value) {
    if (!isScale(value.scale)) return undefined;
    calibration.scale = value.scale;
  }
  if ('animations' in value) {
    if (!isRecord(value.animations)) return undefined;
    const animations: Partial<Record<(typeof PET_ANIMATION_STATES)[number], PetAnimationLayout>> = {};
    for (const [state, layoutValue] of Object.entries(value.animations)) {
      if (!animationStates.has(state)) return undefined;
      const layout = parseAnimationLayout(layoutValue);
      if (!layout) return undefined;
      animations[state as keyof typeof animations] = layout;
    }
    calibration.animations = animations;
  }
  return calibration;
}

function parsePetCalibrations(value: unknown, strict: boolean): Record<string, PetCalibration> | undefined {
  if (!isRecord(value)) return undefined;
  const calibrations: Record<string, PetCalibration> = {};
  for (const [petId, calibrationValue] of Object.entries(value)) {
    const calibration = petIdPattern.test(petId) ? parseCalibration(calibrationValue) : undefined;
    if (!calibration) {
      if (strict) return undefined;
      continue;
    }
    calibrations[petId] = calibration;
  }
  return calibrations;
}

function normalizeSettings(value: unknown): PetSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultSettings };
  const settings = value as Partial<PetSettings>;
  return {
    activePetId: typeof settings.activePetId === 'string' && petIdPattern.test(settings.activePetId)
      ? settings.activePetId
      : defaultSettings.activePetId,
    alwaysOnTop: typeof settings.alwaysOnTop === 'boolean'
      ? settings.alwaysOnTop
      : defaultSettings.alwaysOnTop,
    motionMode: typeof settings.motionMode === 'string' && motionModes.has(settings.motionMode)
      ? settings.motionMode as PetMotionMode
      : defaultSettings.motionMode,
    petCalibrations: parsePetCalibrations(settings.petCalibrations, false) ?? {}
  };
}

function validatePatch(patch: Partial<PetSettings>): Partial<PetSettings> {
  const validated: Partial<PetSettings> = {};
  if ('activePetId' in patch) {
    if (typeof patch.activePetId !== 'string' || !petIdPattern.test(patch.activePetId)) {
      throw new Error(`Invalid activePetId in settings patch: ${String(patch.activePetId)}`);
    }
    validated.activePetId = patch.activePetId;
  }
  if ('alwaysOnTop' in patch) {
    if (typeof patch.alwaysOnTop !== 'boolean') {
      throw new Error('Invalid alwaysOnTop in settings patch');
    }
    validated.alwaysOnTop = patch.alwaysOnTop;
  }
  if ('motionMode' in patch) {
    if (typeof patch.motionMode !== 'string' || !motionModes.has(patch.motionMode)) {
      throw new Error(`Invalid motionMode in settings patch: ${String(patch.motionMode)}`);
    }
    validated.motionMode = patch.motionMode as PetMotionMode;
  }
  if ('petCalibrations' in patch) {
    const petCalibrations = parsePetCalibrations(patch.petCalibrations, true);
    if (!petCalibrations) throw new Error('Invalid petCalibrations in settings patch');
    validated.petCalibrations = petCalibrations;
  }
  return validated;
}

export interface SettingsUpdateResult {
  previous: PetSettings;
  settings: PetSettings;
}

let temporaryFileCounter = 0;

export class SettingsStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async read(): Promise<PetSettings> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (error) {
      // Only a missing file may fall back to defaults. Transient errors
      // (EACCES/EBUSY from AV scans, etc.) must propagate: silently returning
      // defaults here would let update() overwrite the user's real settings.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...defaultSettings };
      throw error;
    }
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      // Corrupted content is unrecoverable; defaults are the best we can do.
      return { ...defaultSettings };
    }
  }

  async update(patch: Partial<PetSettings>): Promise<PetSettings> {
    return (await this.applyUpdate(patch)).settings;
  }

  /**
   * Like update(), but also reports the pre-patch settings, read inside the
   * write queue so concurrent updates cannot observe a stale "previous".
   */
  async applyUpdate(patch: Partial<PetSettings>): Promise<SettingsUpdateResult> {
    // Validate up front: an invalid patch value must fail loudly instead of
    // being silently normalized back to package defaults, which would destroy
    // the user's current (valid) value.
    const validated = validatePatch(patch);
    let result: SettingsUpdateResult | undefined;
    const operation = this.writeQueue.then(async () => {
      const previous = await this.read();
      const saved: PetSettings = { ...previous, ...validated };
      result = { previous, settings: saved };
      await mkdir(dirname(this.path), { recursive: true });
      // pid + counter: two store instances in the same process must not
      // interleave writes to an identical temp file.
      const temporaryPath = `${this.path}.${process.pid}.${++temporaryFileCounter}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(saved, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.path);
    });
    this.writeQueue = operation.catch(() => undefined);
    await operation;
    if (!result) throw new Error('Settings were not saved');
    return result;
  }
}
