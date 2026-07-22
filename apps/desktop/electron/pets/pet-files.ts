import { app } from 'electron';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { DEFAULT_PET_ID, type PetManifest } from '@pawclaw/shared';
import { loadManifest } from '@pawclaw/pet-sdk';

const fallbackPetId = 'sol';
const petIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function getPetsDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'pets')
    : resolve(app.getAppPath(), '../..', 'pets');
}

export async function getPetManifest(petId: string): Promise<PetManifest> {
  if (!petIdPattern.test(petId)) throw new Error(`Invalid pet id: ${petId}`);
  const path = join(getPetsDirectory(), petId, 'pet.json');
  const manifest = loadManifest(await readFile(path, 'utf8'));
  if (manifest.id !== petId) throw new Error(`Pet id does not match directory: ${petId}`);
  return manifest;
}

export async function getActivePetManifest(): Promise<PetManifest> {
  try {
    const preferred = await getPetManifest(DEFAULT_PET_ID);
    if (preferred.enabled !== false) return preferred;
  } catch {
    // The optional preferred pet is not installed yet; use the built-in fallback.
  }
  return getPetManifest(fallbackPetId);
}

export function resolvePetAsset(petId: string, source: string): string {
  if (!petIdPattern.test(petId)) throw new Error(`Invalid pet id: ${petId}`);
  const petDirectory = resolve(getPetsDirectory(), petId);
  const assetPath = resolve(petDirectory, source);
  const relativePath = relative(petDirectory, assetPath);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error('Pet asset path escapes its directory');
  }
  return assetPath;
}
