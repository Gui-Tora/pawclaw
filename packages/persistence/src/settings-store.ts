import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { DEFAULT_PET_ID } from '@pawclaw/shared';

export interface PetSettings {
  activePetId: string;
  alwaysOnTop: boolean;
}

export const defaultSettings: PetSettings = {
  activePetId: DEFAULT_PET_ID,
  alwaysOnTop: true
};

const petIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSettings(value: unknown): PetSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultSettings };
  const settings = value as Partial<PetSettings>;
  return {
    activePetId: typeof settings.activePetId === 'string' && petIdPattern.test(settings.activePetId)
      ? settings.activePetId
      : defaultSettings.activePetId,
    alwaysOnTop: typeof settings.alwaysOnTop === 'boolean'
      ? settings.alwaysOnTop
      : defaultSettings.alwaysOnTop
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
