import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { spriteHitArea } from '@pawclaw/pet-engine';
import type { PetCalibration, PetManifest } from '@pawclaw/shared';

const alwaysOnTopPreferences = new WeakMap<BrowserWindow, boolean>();
const PET_WINDOW_SIZE = 180;

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
    width: PET_WINDOW_SIZE,
    height: PET_WINDOW_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    skipTaskbar: true,
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

/**
 * Windows supports a native rectangular window shape. Applying the calibrated
 * sprite viewport prevents the transparent canvas from blocking unrelated
 * clicks while retaining a small border for native dragging.
 */
export function applyPetWindowShape(
  window: BrowserWindow,
  manifest: PetManifest,
  calibration: PetCalibration | undefined
): void {
  if (process.platform !== 'win32' || window.isDestroyed()) return;
  const area = spriteHitArea(manifest, calibration, {
    width: PET_WINDOW_SIZE,
    height: PET_WINDOW_SIZE
  });
  if (!area) return;
  try {
    window.setShape([area]);
  } catch (error) {
    console.warn('[pawclaw] could not apply pet window shape', error);
  }
}
