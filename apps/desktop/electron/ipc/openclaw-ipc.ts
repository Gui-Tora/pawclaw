import { ipcMain } from 'electron';
import { OpenClawConnection } from '@pawclaw/openclaw-client';

const connection = new OpenClawConnection();

export function registerOpenClawIpc(): void {
  ipcMain.handle('openclaw:status', () => connection.status());
}
