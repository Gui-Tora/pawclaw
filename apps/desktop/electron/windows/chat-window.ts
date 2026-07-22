import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export function createChatWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 460,
    title: 'PawClaw',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.loadFile(join(import.meta.dirname, '../../renderer/index.html'), { query: { view: 'chat' } });
  return window;
}
