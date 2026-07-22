import { BrowserWindow, ipcMain } from 'electron';
import { PetController } from '@pawclaw/pet-engine';
import type { PetEvent, PetMood } from '@pawclaw/shared';
import { getActivePetManifest } from '../pets/pet-files.js';

const pet = new PetController();
let moodTimer: ReturnType<typeof setTimeout> | undefined;

function broadcastMood(mood: PetMood): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('pet:mood-changed', mood);
  }
}

export function dispatchPetEvent(event: PetEvent): PetMood {
  if (moodTimer) clearTimeout(moodTimer);
  const mood = pet.dispatch(event);
  broadcastMood(mood);

  if (event.type === 'agent:response') {
    moodTimer = setTimeout(() => dispatchPetEvent({ type: 'gateway:connected' }), 3_500);
  } else if (event.type === 'gateway:connected' || event.type === 'user:open-chat') {
    moodTimer = setTimeout(() => dispatchPetEvent({ type: 'user:idle' }), 5 * 60_000);
  }
  return mood;
}

export function registerPetIpc(): void {
  ipcMain.handle('pet:status', async () => ({ manifest: await getActivePetManifest(), mood: pet.mood }));
  ipcMain.handle('pet:open-chat', () => dispatchPetEvent({ type: 'user:open-chat' }));
}
