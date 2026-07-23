import { app } from 'electron';
import { readFile, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { DEFAULT_PET_ID, type PetManifest } from '@pawclaw/shared';
import { loadManifest } from '@pawclaw/pet-sdk';

const fallbackPetId = DEFAULT_PET_ID;
const petIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface AvailablePet {
  id: string;
  name: string;
  species: string;
  attribution?: PetManifest['attribution'];
}

export function getPetsDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'pets')
    : resolve(app.getAppPath(), '../..', 'pets');
}

export async function getPetManifest(petId: string): Promise<PetManifest> {
  if (!petIdPattern.test(petId)) throw new Error(`Invalid pet id: ${petId}`);
  const petDirectory = join(getPetsDirectory(), petId);
  let content: string;
  try {
    content = await readFile(join(petDirectory, 'pet.local.json'), 'utf8');
  } catch {
    content = await readFile(join(petDirectory, 'pet.json'), 'utf8');
  }
  const manifest = loadManifest(content);
  if (manifest.id !== petId) throw new Error(`Pet id does not match directory: ${petId}`);
  return manifest;
}

export async function listAvailablePets(): Promise<AvailablePet[]> {
  const entries = await readdir(getPetsDirectory(), { withFileTypes: true });
  const pets = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && petIdPattern.test(entry.name))
    .map(async (entry): Promise<AvailablePet | undefined> => {
      try {
        const manifest = await getPetManifest(entry.name);
        if (manifest.enabled === false) return undefined;
        return {
          id: manifest.id,
          name: manifest.name,
          species: manifest.species,
          attribution: manifest.attribution
        };
      } catch {
        return undefined;
      }
    }));
  return pets
    .filter((pet): pet is AvailablePet => pet !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getActivePetManifest(preferredPetId = DEFAULT_PET_ID): Promise<PetManifest> {
  try {
    const preferred = await getPetManifest(preferredPetId);
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
