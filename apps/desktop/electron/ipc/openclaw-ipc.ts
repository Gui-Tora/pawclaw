import { ipcMain } from 'electron';
import { OpenClawConnection } from '@pawclaw/openclaw-client';
import { dispatchPetEvent } from './pet-ipc.js';

export const connection = new OpenClawConnection();

export function registerOpenClawIpc(): void {
  ipcMain.handle('openclaw:status', () => connection.status());
  connection.onStatusChange((status) => {
    dispatchPetEvent({ type: status.connected ? 'gateway:connected' : 'gateway:disconnected' });
  });
  void connection.connect().catch(() => {
    dispatchPetEvent({ type: 'gateway:disconnected' });
  });
}
