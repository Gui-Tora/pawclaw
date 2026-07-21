import { ipcMain } from 'electron';
import { OpenClawConnection } from '@openclaw-pet/openclaw-client';

const connection = new OpenClawConnection();

export function registerOpenClawIpc(): void {
  ipcMain.handle('openclaw:status', () => connection.status());
}
