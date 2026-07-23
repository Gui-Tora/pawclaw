import { BrowserWindow, ipcMain } from 'electron';
import { PetController } from '@pawclaw/pet-engine';
import { DEFAULT_PET_MOTION_STATE, type PetEvent, type PetMood, type PetMotionState } from '@pawclaw/shared';
import { getActivePetManifest } from '../pets/pet-files.js';
import { readAppSettings } from '../settings/app-settings.js';

const pet = new PetController();
let moodTimer: ReturnType<typeof setTimeout> | undefined;
let motionStateProvider: () => PetMotionState = () => DEFAULT_PET_MOTION_STATE;
const moodListeners = new Set<(mood: PetMood) => void>();

// Injected by registerOpenClawIpc so mood timers can consult the live gateway
// status without creating a module cycle with openclaw-ipc.
let gatewayConnected: () => boolean = () => true;

export function setGatewayStatusProvider(provider: () => boolean): void {
  gatewayConnected = provider;
}

function broadcastMood(mood: PetMood): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('pet:mood-changed', mood);
  }
  for (const listener of moodListeners) listener(mood);
}

export function broadcastPetMotion(motion: PetMotionState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('pet:motion-changed', motion);
  }
}

export function setPetMotionStateProvider(provider: () => PetMotionState): void {
  motionStateProvider = provider;
}

export function onPetMoodChanged(listener: (mood: PetMood) => void): () => void {
  moodListeners.add(listener);
  return () => moodListeners.delete(listener);
}

export function getPetMood(): PetMood {
  return pet.mood;
}

export function broadcastPetChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('pet:changed');
  }
}

function gatewayStatusEvent(): PetEvent {
  return { type: gatewayConnected() ? 'gateway:connected' : 'gateway:disconnected' };
}

export function dispatchPetEvent(event: PetEvent): PetMood {
  if (moodTimer) clearTimeout(moodTimer);
  const previousMood = pet.mood;
  const mood = pet.dispatch(event);
  // Streaming responses dispatch agent:response per chunk; only pay the
  // cross-window IPC cost when the mood actually changes.
  if (mood !== previousMood) broadcastMood(mood);

  if (event.type === 'agent:response') {
    moodTimer = setTimeout(() => dispatchPetEvent(gatewayStatusEvent()), 3_500);
  } else if (event.type === 'gateway:connected' || event.type === 'user:open-chat') {
    moodTimer = setTimeout(() => dispatchPetEvent({ type: 'user:idle' }), 5 * 60_000);
  }
  return mood;
}

export function registerPetIpc(): void {
  ipcMain.handle('pet:status', async () => {
    const settings = await readAppSettings();
    return {
      manifest: await getActivePetManifest(settings.activePetId),
      mood: pet.mood,
      motion: motionStateProvider()
    };
  });
}
