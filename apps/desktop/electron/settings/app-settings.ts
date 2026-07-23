import { app } from 'electron';
import { join } from 'node:path';
import { SettingsStore, type PetSettings, type SettingsUpdateResult } from '@pawclaw/persistence';

let store: SettingsStore | undefined;

function getStore(): SettingsStore {
  store ??= new SettingsStore(join(app.getPath('userData'), 'settings.json'));
  return store;
}

export function readAppSettings(): Promise<PetSettings> {
  return getStore().read();
}

export function updateAppSettings(patch: Partial<PetSettings>): Promise<SettingsUpdateResult> {
  return getStore().applyUpdate(patch);
}
