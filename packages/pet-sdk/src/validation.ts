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

function isBoundedString(value: unknown, maxLength: number): value is string {
  return isNonEmptyString(value) && value.length <= maxLength;
}

export function isSafePetPath(value: unknown): value is string {
  // `D:file` (drive-relative, no separator) resolves outside the pet
  // directory too, so reject any drive prefix — not just `D:\`/`D:/`.
  if (!isBoundedString(value, 1024) || value.includes('\0') || /^[A-Za-z]:/.test(value)) return false;
  // Backslash separators pass a naive check but the renderer builds URLs by
  // splitting on '/' only, so `sprites\idle.png` would 404 at runtime.
  if (value.includes('\\')) return false;
  return !value.startsWith('/')
    && value.split('/').every((segment) => segment !== '..' && segment !== '.' && segment !== '');
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
    !isBoundedString(attribution.creator, 256)
    || !isBoundedString(attribution.license, 256)
    || typeof attribution.required !== 'boolean'
    || !isBoundedString(attribution.source, 2048)
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
    !isBoundedString(manifest.id, 64)
    || !identifierPattern.test(manifest.id)
    || !isBoundedString(manifest.name, 256)
    || !isBoundedString(manifest.species, 256)
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
