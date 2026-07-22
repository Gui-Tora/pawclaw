import { ipcMain } from 'electron';
import { OpenClawConnection } from '@pawclaw/openclaw-client';

export const connection = new OpenClawConnection();

export function registerOpenClawIpc(): void {
  ipcMain.handle('openclaw:status', () => connection.status());
  void connection.connect().catch(() => undefined);
}
