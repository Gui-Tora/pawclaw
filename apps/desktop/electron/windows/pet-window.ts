import { BrowserWindow } from 'electron';
import { join } from 'node:path';

const alwaysOnTopPreferences = new WeakMap<BrowserWindow, boolean>();

export function applyPetAlwaysOnTop(window: BrowserWindow, enabled: boolean): void {
  if (window.isDestroyed()) return;
  alwaysOnTopPreferences.set(window, enabled);
  window.setAlwaysOnTop(enabled, enabled ? 'screen-saver' : 'normal');
  if (enabled && window.isVisible() && !window.isMinimized()) window.moveTop();
}

export function reinforcePetAlwaysOnTop(window: BrowserWindow): void {
  applyPetAlwaysOnTop(window, alwaysOnTopPreferences.get(window) ?? true);
}

export function createPetWindow(alwaysOnTop: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 180,
    height: 180,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    alwaysOnTop,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  alwaysOnTopPreferences.set(window, alwaysOnTop);
  const reinforce = () => reinforcePetAlwaysOnTop(window);
  window.on('show', reinforce);
  window.on('restore', reinforce);
  window.on('blur', reinforce);
  window.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
    if (!isAlwaysOnTop && alwaysOnTopPreferences.get(window)) setImmediate(reinforce);
  });
  window.on('closed', () => alwaysOnTopPreferences.delete(window));
  window.once('ready-to-show', reinforce);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  void window.loadFile(join(import.meta.dirname, '../../renderer/index.html'), {
    query: { view: 'pet' }
  });
  applyPetAlwaysOnTop(window, alwaysOnTop);
  return window;
}
