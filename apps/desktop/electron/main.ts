import { app, BrowserWindow, dialog, ipcMain, powerMonitor, protocol } from 'electron';
import { registerChatIpc } from './ipc/chat-ipc.js';
import { connection, registerOpenClawIpc } from './ipc/openclaw-ipc.js';
import { dispatchPetEvent, registerPetIpc } from './ipc/pet-ipc.js';
import { registerSettingsIpc } from './ipc/settings-ipc.js';
import { registerPetAssetProtocol } from './pets/pet-protocol.js';
import { readAppSettings } from './settings/app-settings.js';
import { createTrayApp, type TrayApp } from './tray/tray-app.js';
import { createFlyoutWindow, positionFlyout } from './windows/flyout-window.js';
import {
  applyPetAlwaysOnTop,
  createPetWindow,
  reinforcePetAlwaysOnTop
} from './windows/pet-window.js';

protocol.registerSchemesAsPrivileged([
  { scheme: 'pawclaw-pet', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

let flyoutWindow: BrowserWindow | undefined;
let flyoutHiddenAt = 0;
let petWindow: BrowserWindow | undefined;
let petWindowPromise: Promise<BrowserWindow> | undefined;
let trayApp: TrayApp | undefined;
let quitting = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function ensureFlyoutWindow(): BrowserWindow {
  if (!flyoutWindow || flyoutWindow.isDestroyed()) {
    flyoutWindow = createFlyoutWindow();
    flyoutWindow.on('hide', () => {
      flyoutHiddenAt = Date.now();
    });
    flyoutWindow.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      flyoutWindow?.hide();
    });
  }
  return flyoutWindow;
}

async function ensurePetWindow(): Promise<BrowserWindow> {
  if (petWindow && !petWindow.isDestroyed()) return petWindow;
  // Cache the in-flight creation so concurrent callers (whenReady + activate)
  // cannot race past the check above and spawn duplicate pet windows.
  if (!petWindowPromise) {
    petWindowPromise = (async () => {
      const settings = await readAppSettings();
      const window = createPetWindow(settings.alwaysOnTop);
      window.on('closed', () => {
        if (petWindow === window) petWindow = undefined;
      });
      petWindow = window;
      return window;
    })().finally(() => {
      petWindowPromise = undefined;
    });
  }
  return petWindowPromise;
}

let pendingReveal: (() => void) | undefined;

function showFlyout(view: 'chat' | 'settings'): void {
  if (view === 'chat') dispatchPetEvent({ type: 'user:open-chat' });
  const window = ensureFlyoutWindow();
  if (trayApp) positionFlyout(window, trayApp.tray.getBounds());

  const reveal = () => {
    if (window.isDestroyed()) return;
    window.webContents.send('window:view-changed', view);
    window.webContents.send('window:shown');
    window.show();
    window.focus();
  };
  if (window.webContents.isLoadingMainFrame()) {
    // Collapse rapid repeat opens into a single reveal with the latest view.
    const firstQueued = !pendingReveal;
    pendingReveal = reveal;
    if (firstQueued) {
      window.webContents.once('did-finish-load', () => {
        pendingReveal?.();
        pendingReveal = undefined;
      });
    }
  } else {
    reveal();
  }
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => {
    if (app.isReady()) showFlyout('chat');
  });

  void app.whenReady().then(async () => {
    app.setAppUserModelId('com.guitora.pawclaw');
    registerPetAssetProtocol();
    registerOpenClawIpc();
    registerChatIpc();
    registerPetIpc();
    registerSettingsIpc((settings, previous) => {
      if (settings.activePetId !== previous.activePetId) void trayApp?.refresh();
      if (settings.alwaysOnTop !== previous.alwaysOnTop && petWindow) {
        applyPetAlwaysOnTop(petWindow, settings.alwaysOnTop);
      }
    });
    ipcMain.handle('window:open-chat', () => showFlyout('chat'));
    ipcMain.handle('window:hide', () => {
      if (flyoutWindow && !flyoutWindow.isDestroyed()) flyoutWindow.hide();
    });

    ensureFlyoutWindow();
    // The pet window must not depend on tray creation succeeding: a broken
    // tray icon should never leave the app running headless.
    await ensurePetWindow();
    try {
      trayApp = await createTrayApp({
        getWindow: () => flyoutWindow,
        wasRecentlyHidden: () => Date.now() - flyoutHiddenAt < 250,
        show: showFlyout,
        quit: () => app.quit()
      });
    } catch (error) {
      console.error('[pawclaw] tray creation failed; continuing without tray', error);
    }
    connection.onStatusChange(() => {
      void trayApp?.refreshTooltip();
    });
    powerMonitor.on('resume', () => {
      if (petWindow) reinforcePetAlwaysOnTop(petWindow);
    });
    powerMonitor.on('unlock-screen', () => {
      if (petWindow) reinforcePetAlwaysOnTop(petWindow);
    });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[pawclaw] fatal startup error', error);
    dialog.showErrorBox('PawClaw no pudo iniciarse', message);
    app.quit();
  });

  app.on('activate', () => {
    void ensurePetWindow();
  });
}

app.on('before-quit', () => {
  quitting = true;
  connection.disconnect();
});

app.on('window-all-closed', () => {
  // PawClaw intentionally remains alive in the system tray.
});
