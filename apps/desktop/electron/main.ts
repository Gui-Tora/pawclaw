import { app, BrowserWindow, dialog, ipcMain, powerMonitor, protocol } from 'electron';
import { registerChatIpc } from './ipc/chat-ipc.js';
import { connection, registerOpenClawIpc } from './ipc/openclaw-ipc.js';
import {
  broadcastPetMotion,
  getPetMood,
  onPetMoodChanged,
  registerPetIpc,
  setPetMotionStateProvider,
  dispatchPetEvent
} from './ipc/pet-ipc.js';
import { registerSettingsIpc } from './ipc/settings-ipc.js';
import { getActivePetManifest } from './pets/pet-files.js';
import { registerPetAssetProtocol } from './pets/pet-protocol.js';
import { readAppSettings, updateAppSettings } from './settings/app-settings.js';
import { createTrayApp, type TrayApp } from './tray/tray-app.js';
import { createFlyoutWindow, positionFlyout } from './windows/flyout-window.js';
import {
  applyPetAlwaysOnTop,
  applyPetWindowShape,
  createPetWindow,
  reinforcePetAlwaysOnTop
} from './windows/pet-window.js';
import { PetMotionController } from './windows/pet-motion-controller.js';

protocol.registerSchemesAsPrivileged([
  { scheme: 'pawclaw-pet', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

let flyoutWindow: BrowserWindow | undefined;
let flyoutHiddenAt = 0;
let petWindow: BrowserWindow | undefined;
let petWindowPromise: Promise<BrowserWindow> | undefined;
let petMotion: PetMotionController | undefined;
let trayApp: TrayApp | undefined;
let quitting = false;
let shapeRefreshRequest = 0;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function broadcastSettingsChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('settings:changed');
  }
}

async function refreshPetWindowShape(): Promise<void> {
  const window = petWindow;
  if (!window || window.isDestroyed()) return;
  const request = ++shapeRefreshRequest;
  const settings = await readAppSettings();
  const manifest = await getActivePetManifest(settings.activePetId);
  if (request !== shapeRefreshRequest || petWindow !== window || window.isDestroyed()) return;
  applyPetWindowShape(window, manifest, settings.petCalibrations[manifest.id]);
}

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
      const manifest = await getActivePetManifest(settings.activePetId);
      applyPetWindowShape(window, manifest, settings.petCalibrations[manifest.id]);
      window.on('closed', () => {
        if (petWindow === window) petWindow = undefined;
        if (petMotion) {
          petMotion.destroy();
          petMotion = undefined;
        }
      });
      petWindow = window;
      petMotion = new PetMotionController(
        window,
        settings.motionMode,
        getPetMood(),
        broadcastPetMotion,
        () => {
          void updateAppSettings({ motionMode: 'manual' })
            .then(() => broadcastSettingsChanged())
            .catch((error: unknown) => console.error('[pawclaw] could not persist manual movement', error));
        }
      );
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
    setPetMotionStateProvider(() => petMotion?.state ?? {
      mode: 'manual',
      locomotion: 'stationary',
      direction: 'right'
    });
    onPetMoodChanged((mood) => petMotion?.setMood(mood));
    registerSettingsIpc((settings, previous) => {
      if (settings.activePetId !== previous.activePetId) void trayApp?.refresh();
      if (settings.alwaysOnTop !== previous.alwaysOnTop && petWindow) {
        applyPetAlwaysOnTop(petWindow, settings.alwaysOnTop);
      }
      if (settings.motionMode !== previous.motionMode) {
        petMotion?.setMode(settings.motionMode);
      }
      void refreshPetWindowShape();
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
      petMotion?.refresh();
    });
    powerMonitor.on('unlock-screen', () => {
      if (petWindow) reinforcePetAlwaysOnTop(petWindow);
      petMotion?.refresh();
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
