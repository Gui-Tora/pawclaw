import { PET_MOODS, type PetManifest } from '@openclaw-pet/shared';

const petMoods = new Set<string>(PET_MOODS);
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSafeRelativePath(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.includes('\0') || /^[A-Za-z]:[\\/]/.test(value)) return false;
  const normalized = value.replace(/\\/g, '/');
  return !normalized.startsWith('/') && normalized.split('/').every((segment) => segment !== '..' && segment !== '');
}

export function validateManifest(value: unknown): value is PetManifest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const manifest = value as Partial<PetManifest>;
  if (
    !isNonEmptyString(manifest.id)
    || !identifierPattern.test(manifest.id)
    || !isNonEmptyString(manifest.name)
    || !isNonEmptyString(manifest.version)
    || !versionPattern.test(manifest.version)
    || !isSafeRelativePath(manifest.entry)
    || !Array.isArray(manifest.supportedStates)
    || manifest.supportedStates.length === 0
  ) return false;

  return manifest.supportedStates.every((mood) => typeof mood === 'string' && petMoods.has(mood))
    && new Set(manifest.supportedStates).size === manifest.supportedStates.length;
}
