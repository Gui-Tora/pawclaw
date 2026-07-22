import { validateManifest } from './validation.js';
import type { PetManifest } from '@pawclaw/shared';

export function loadManifest(content: string): PetManifest {
  const parsed: unknown = JSON.parse(content);
  if (!validateManifest(parsed)) throw new Error('Invalid pet manifest');
  return parsed;
}
