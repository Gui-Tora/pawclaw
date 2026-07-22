import { BrowserWindow } from 'electron';
import { join } from 'node:path';

export function createPetWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 180,
    height: 180,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.loadFile(join(import.meta.dirname, '../../renderer/index.html'), { query: { view: 'pet' } });
  return window;
}
