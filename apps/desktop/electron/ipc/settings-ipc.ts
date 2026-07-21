import { ipcMain } from 'electron';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:read', () => ({ activePetId: 'sol', alwaysOnTop: true }));
}
