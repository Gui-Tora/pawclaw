import { BrowserWindow, ipcMain } from 'electron';
import { OpenClawConnection } from '@pawclaw/openclaw-client';
import { dispatchPetEvent, setGatewayStatusProvider } from './pet-ipc.js';

export const connection = new OpenClawConnection();

export function registerOpenClawIpc(): void {
  setGatewayStatusProvider(() => connection.status().connected);
  ipcMain.handle('openclaw:status', () => connection.status());
  ipcMain.handle('openclaw:identity', () => connection.getAgentIdentity());
  connection.onStatusChange((status) => {
    dispatchPetEvent({ type: status.connected ? 'gateway:connected' : 'gateway:disconnected' });
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('openclaw:status-changed', status);
    }
  });
  void connection.connect().catch(() => {
    dispatchPetEvent({ type: 'gateway:disconnected' });
  });
}
