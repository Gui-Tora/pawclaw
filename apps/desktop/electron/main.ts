import { app, BrowserWindow, ipcMain, powerMonitor, protocol } from 'electron';
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
let petWindow: BrowserWindow | undefined;
let trayApp: TrayApp | undefined;
let quitting = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();

function ensureFlyoutWindow(): BrowserWindow {
  if (!flyoutWindow || flyoutWindow.isDestroyed()) {
    flyoutWindow = createFlyoutWindow();
    flyoutWindow.on('close', (event) => {
      if (quitting) return;
      event.preventDefault();
      flyoutWindow?.hide();
    });
  }
  return flyoutWindow;
}

async function ensurePetWindow(): Promise<BrowserWindow> {
  if (!petWindow || petWindow.isDestroyed()) {
    const settings = await readAppSettings();
    petWindow = createPetWindow(settings.alwaysOnTop);
    petWindow.on('closed', () => {
      petWindow = undefined;
    });
  }
  return petWindow;
}

function showFlyout(view: 'chat' | 'settings'): void {
  dispatchPetEvent({ type: 'user:open-chat' });
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
    window.webContents.once('did-finish-load', reveal);
  } else {
    reveal();
  }
}

if (hasSingleInstanceLock) {
  app.on('second-instance', () => showFlyout('chat'));

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
    ipcMain.handle('window:open-settings', () => showFlyout('settings'));
    ipcMain.handle('window:hide', () => flyoutWindow?.hide());

    ensureFlyoutWindow();
    trayApp = await createTrayApp({
      getWindow: () => flyoutWindow,
      show: showFlyout,
      quit: () => app.quit()
    });
    await ensurePetWindow();
    connection.onStatusChange(() => {
      void trayApp?.refreshTooltip();
    });
    powerMonitor.on('resume', () => {
      if (petWindow) reinforcePetAlwaysOnTop(petWindow);
    });
    powerMonitor.on('unlock-screen', () => {
      if (petWindow) reinforcePetAlwaysOnTop(petWindow);
    });
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
