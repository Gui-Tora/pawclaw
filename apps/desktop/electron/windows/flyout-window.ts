import { BrowserWindow, screen, type Rectangle } from 'electron';
import { join } from 'node:path';

const FLYOUT_WIDTH = 430;
const FLYOUT_HEIGHT = 650;
const EDGE_GAP = 8;

export function createFlyoutWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: FLYOUT_WIDTH,
    height: FLYOUT_HEIGHT,
    minWidth: FLYOUT_WIDTH,
    minHeight: FLYOUT_HEIGHT,
    maxWidth: FLYOUT_WIDTH,
    maxHeight: FLYOUT_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    roundedCorners: true,
    backgroundColor: '#f7f5f0',
    title: 'PawClaw',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened()) window.hide();
  });
  void window.loadFile(join(import.meta.dirname, '../../renderer/index.html'), {
    query: { view: 'tray' }
  });
  return window;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

export function positionFlyout(window: BrowserWindow, trayBounds: Rectangle): void {
  const anchor = {
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2)
  };
  const workArea = screen.getDisplayNearestPoint(anchor).workArea;
  const size = window.getSize();
  const centeredX = Math.round(trayBounds.x + trayBounds.width / 2 - size[0] / 2);
  const x = clamp(centeredX, workArea.x + EDGE_GAP, workArea.x + workArea.width - size[0] - EDGE_GAP);

  const taskbarBelow = trayBounds.y >= workArea.y + workArea.height / 2;
  const preferredY = taskbarBelow
    ? trayBounds.y - size[1] - EDGE_GAP
    : trayBounds.y + trayBounds.height + EDGE_GAP;
  const y = clamp(preferredY, workArea.y + EDGE_GAP, workArea.y + workArea.height - size[1] - EDGE_GAP);
  window.setPosition(x, y, false);
}
