import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import type { PetAnimationState } from '@pawclaw/shared';

export function createCropEditorWindow(state: PetAnimationState): BrowserWindow {
  const window = new BrowserWindow({
    width: 880,
    height: 720,
    minWidth: 720,
    minHeight: 600,
    title: 'PawClaw · Editor de recorte',
    backgroundColor: '#f7f5f0',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  void window.loadFile(join(import.meta.dirname, '../../renderer/index.html'), {
    query: { view: 'crop-editor', state }
  });
  return window;
}
