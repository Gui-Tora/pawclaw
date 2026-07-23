import { BrowserWindow, ipcMain } from 'electron';
import type { PetSettings } from '@pawclaw/persistence';
import type { PetCalibration, PetMotionMode } from '@pawclaw/shared';
import { getActivePetManifest, getPetManifest, listAvailablePets } from '../pets/pet-files.js';
import { readAppSettings, updateAppSettings } from '../settings/app-settings.js';
import { broadcastPetChanged } from './pet-ipc.js';

async function settingsSnapshot(input?: PetSettings) {
  const settings = input ?? await readAppSettings();
  const [manifest, pets] = await Promise.all([
    getActivePetManifest(settings.activePetId),
    listAvailablePets()
  ]);
  return {
    activePetId: manifest.id,
    alwaysOnTop: settings.alwaysOnTop,
    motionMode: settings.motionMode,
    petCalibrations: settings.petCalibrations,
    activePetManifest: manifest,
    pets
  };
}

export function registerSettingsIpc(
  onSettingsChanged: (settings: PetSettings, previous: PetSettings) => void
): void {
  ipcMain.handle('settings:read', () => settingsSnapshot());
  ipcMain.handle('settings:update', async (_event, value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('Invalid settings update');
    }
    const input = value as Record<string, unknown>;
    const patch: Partial<PetSettings> = {};

    if ('activePetId' in input) {
      if (typeof input.activePetId !== 'string') throw new Error('Invalid pet id');
      const manifest = await getPetManifest(input.activePetId);
      if (manifest.enabled === false) throw new Error(`Pet is not available: ${input.activePetId}`);
      patch.activePetId = manifest.id;
    }
    if ('alwaysOnTop' in input) {
      if (typeof input.alwaysOnTop !== 'boolean') throw new Error('Invalid always-on-top value');
      patch.alwaysOnTop = input.alwaysOnTop;
    }
    if ('motionMode' in input) {
      if (typeof input.motionMode !== 'string') throw new Error('Invalid motion mode');
      patch.motionMode = input.motionMode as PetMotionMode;
    }
    if ('petCalibrations' in input) {
      if (!input.petCalibrations || typeof input.petCalibrations !== 'object' || Array.isArray(input.petCalibrations)) {
        throw new Error('Invalid pet calibrations');
      }
      // The persistence layer validates the complete nested shape before it
      // can reach disk. Keep this boundary narrow so the renderer cannot
      // write unrelated settings.
      patch.petCalibrations = input.petCalibrations as Record<string, PetCalibration>;
    }
    if (Object.keys(patch).length === 0) throw new Error('No supported settings supplied');

    // previous comes from inside the store's write queue, so concurrent
    // updates can never observe a stale snapshot and skip the change hooks.
    const { previous, settings } = await updateAppSettings(patch);
    if (settings.activePetId !== previous.activePetId) {
      broadcastPetChanged();
    }
    onSettingsChanged(settings, previous);
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('settings:changed');
    }
    return settingsSnapshot(settings);
  });
}
