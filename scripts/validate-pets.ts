import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { loadManifest } from '@pawclaw/pet-sdk';

async function main(): Promise<void> {
  const petsDirectory = resolve('pets');
  const entries = await readdir(petsDirectory, { withFileTypes: true });
  const petDirectories = entries.filter((entry) => entry.isDirectory());
  if (petDirectories.length === 0) throw new Error(`No pet directories found in ${petsDirectory}`);

  for (const directory of petDirectories) {
    const petDirectory = resolve(petsDirectory, directory.name);
    const manifestPath = resolve(petDirectory, 'manifest.json');
    const manifest = loadManifest(await readFile(manifestPath, 'utf8'));
    if (manifest.id !== directory.name) {
      throw new Error(`Pet id "${manifest.id}" must match its directory "${directory.name}"`);
    }

    const assetPath = resolve(petDirectory, manifest.entry);
    const assetRelativePath = relative(petDirectory, assetPath);
    if (assetRelativePath.startsWith('..') || isAbsolute(assetRelativePath)) {
      throw new Error(`Pet entry escapes its directory: ${manifest.entry}`);
    }
    if (!(await stat(assetPath)).isFile()) throw new Error(`Pet entry is not a file: ${assetPath}`);

    console.log(`Validated pet: ${manifest.id}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
