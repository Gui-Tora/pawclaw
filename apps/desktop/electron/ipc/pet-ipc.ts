import { ipcMain } from 'electron';
import { PetController } from '@pawclaw/pet-engine';

const pet = new PetController();

export function registerPetIpc(): void {
  ipcMain.handle('pet:status', () => ({ name: 'Sol', mood: pet.mood }));
  ipcMain.handle('pet:open-chat', () => pet.dispatch({ type: 'user:open-chat' }));
}
