import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export function createSettingsWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 520,
    height: 520,
    title: 'OpenClaw Pet Settings',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.loadFile(join(import.meta.dirname, '../../renderer/index.html'), { query: { view: 'settings' } });
  return window;
}
