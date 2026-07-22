import { ipcMain } from 'electron';
import { PetController } from '@pawclaw/pet-engine';
import { getActivePetManifest } from '../pets/pet-files.js';

const pet = new PetController();

export function registerPetIpc(): void {
  ipcMain.handle('pet:status', async () => ({ manifest: await getActivePetManifest(), mood: pet.mood }));
  ipcMain.handle('pet:open-chat', () => pet.dispatch({ type: 'user:open-chat' }));
}
