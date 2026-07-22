import { ipcMain } from 'electron';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:read', () => ({ activePetId: 'ember', alwaysOnTop: true }));
}
