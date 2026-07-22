import {
  PET_ANIMATION_STATES,
  type PetAnimationDefinition,
  type PetAttribution,
  type PetManifest
} from '@pawclaw/shared';

const animationStates = new Set<string>(PET_ANIMATION_STATES);
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isSafePetPath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.includes('\0') || /^[A-Za-z]:[\\/]/.test(value)) return false;
  const normalized = value.replace(/\\/g, '/');
  return !normalized.startsWith('/')
    && normalized.split('/').every((segment) => segment !== '..' && segment !== '.' && segment !== '');
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isNumberInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function validateAnimation(value: unknown): value is PetAnimationDefinition {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const animation = value as Partial<PetAnimationDefinition>;
  return isSafePetPath(animation.src)
    && isIntegerInRange(animation.frameWidth, 1, 4096)
    && isIntegerInRange(animation.frameHeight, 1, 4096)
    && isIntegerInRange(animation.frames, 1, 512)
    && isNumberInRange(animation.fps, 0.1, 60)
    && typeof animation.loop === 'boolean';
}

function validateAttribution(value: unknown): value is PetAttribution {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const attribution = value as Partial<PetAttribution>;
  if (
    !isNonEmptyString(attribution.creator)
    || !isNonEmptyString(attribution.license)
    || typeof attribution.required !== 'boolean'
    || !isNonEmptyString(attribution.source)
  ) return false;

  try {
    return new URL(attribution.source).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateManifest(value: unknown): value is PetManifest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const manifest = value as Partial<PetManifest>;
  if (
    !isNonEmptyString(manifest.id)
    || !identifierPattern.test(manifest.id)
    || !isNonEmptyString(manifest.name)
    || !isNonEmptyString(manifest.species)
    || !isIntegerInRange(manifest.scale, 1, 16)
    || (manifest.enabled !== undefined && typeof manifest.enabled !== 'boolean')
    || (manifest.preview !== undefined && !isSafePetPath(manifest.preview))
    || (manifest.attribution !== undefined && !validateAttribution(manifest.attribution))
    || manifest.animations === null
    || typeof manifest.animations !== 'object'
    || Array.isArray(manifest.animations)
  ) return false;

  const entries = Object.entries(manifest.animations);
  return entries.length > 0
    && entries.every(([state, animation]) => animationStates.has(state) && validateAnimation(animation))
    && validateAnimation(manifest.animations.idle);
}
