import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface PetSettings {
  activePetId: string;
  alwaysOnTop: boolean;
}

export const defaultSettings: PetSettings = { activePetId: 'ember', alwaysOnTop: true };

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

export class SettingsStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async read(): Promise<PetSettings> {
    try {
      return normalizeSettings(JSON.parse(await readFile(this.path, 'utf8')));
    } catch {
      return { ...defaultSettings };
    }
  }

  async update(patch: Partial<PetSettings>): Promise<PetSettings> {
    let saved: PetSettings | undefined;
    const operation = this.writeQueue.then(async () => {
      saved = normalizeSettings({ ...await this.read(), ...patch });
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(saved, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.path);
    });
    this.writeQueue = operation.catch(() => undefined);
    await operation;
    if (!saved) throw new Error('Settings were not saved');
    return saved;
  }
}
