import { open, readFile, readdir, stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { isAbsolute, relative, resolve } from 'node:path';
import { loadManifest } from '@pawclaw/pet-sdk';

async function assertFile(path: string, label: string): Promise<void> {
  if (!(await stat(path)).isFile()) throw new Error(`${label} is not a file: ${path}`);
}

async function readPngDimensions(path: string): Promise<{ width: number; height: number }> {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(24);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const signature = '89504e470d0a1a0a';
    if (bytesRead !== header.length || header.subarray(0, 8).toString('hex') !== signature) {
      throw new Error(`Invalid PNG file: ${path}`);
    }
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  } finally {
    await file.close();
  }
}

async function main(): Promise<void> {
  const petsDirectory = resolve('pets');
  const entries = await readdir(petsDirectory, { withFileTypes: true });
  const petDirectories = entries.filter((entry) => entry.isDirectory());
  if (petDirectories.length === 0) throw new Error(`No pet directories found in ${petsDirectory}`);

  for (const directory of petDirectories) {
    const petDirectory = resolve(petsDirectory, directory.name);
    const manifestPath = resolve(petDirectory, 'pet.json');
    const manifest = loadManifest(await readFile(manifestPath, 'utf8'));
    if (manifest.id !== directory.name) {
      throw new Error(`Pet id "${manifest.id}" must match its directory "${directory.name}"`);
    }

    if (manifest.enabled === false) {
      console.log(`Skipped disabled pet assets: ${manifest.id}`);
      continue;
    }

    const assetEntries = [
      ...(manifest.preview ? [['preview', manifest.preview] as const] : []),
      ...Object.entries(manifest.animations).map(([state, animation]) => [state, animation.src] as const)
    ];

    for (const [label, source] of assetEntries) {
      const assetPath = resolve(petDirectory, source);
      const assetRelativePath = relative(petDirectory, assetPath);
      if (assetRelativePath.startsWith('..') || isAbsolute(assetRelativePath)) {
        throw new Error(`Pet asset escapes its directory: ${source}`);
      }
      await assertFile(assetPath, `Pet ${label} asset`);
    }

    for (const [state, animation] of Object.entries(manifest.animations)) {
      if (extname(animation.src).toLowerCase() !== '.png') {
        if (animation.frames > 1) throw new Error(`Animated state ${state} must use a PNG spritesheet`);
        continue;
      }
      const dimensions = await readPngDimensions(resolve(petDirectory, animation.src));
      const expectedWidth = animation.frameWidth * animation.frames;
      if (dimensions.width !== expectedWidth || dimensions.height !== animation.frameHeight) {
        throw new Error(
          `${manifest.id}/${state} is ${dimensions.width}x${dimensions.height}; expected ${expectedWidth}x${animation.frameHeight}`
        );
      }
    }

    console.log(`Validated pet: ${manifest.id}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
