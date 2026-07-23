import { app, BrowserWindow, ipcMain, powerMonitor, protocol } from 'electron';
import { createChatWindow } from './windows/chat-window.js';
import { applyPetAlwaysOnTop, createPetWindow, reinforcePetAlwaysOnTop } from './windows/pet-window.js';
import { createSettingsWindow } from './windows/settings-window.js';
import { registerChatIpc } from './ipc/chat-ipc.js';
import { registerOpenClawIpc } from './ipc/openclaw-ipc.js';
import { dispatchPetEvent, registerPetIpc } from './ipc/pet-ipc.js';
import { registerSettingsIpc } from './ipc/settings-ipc.js';
import { registerPetAssetProtocol } from './pets/pet-protocol.js';
import { readAppSettings } from './settings/app-settings.js';

protocol.registerSchemesAsPrivileged([
  { scheme: 'pawclaw-pet', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

let petWindow: BrowserWindow | undefined;
let chatWindow: BrowserWindow | undefined;
let settingsWindow: BrowserWindow | undefined;

function showChat(): void {
  dispatchPetEvent({ type: 'user:open-chat' });
  if (!chatWindow || chatWindow.isDestroyed()) chatWindow = createChatWindow();
  chatWindow.show();
  chatWindow.focus();
}

function showSettings(): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) settingsWindow = createSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

async function ensurePetWindow(): Promise<void> {
  if (petWindow && !petWindow.isDestroyed()) return;
  const settings = await readAppSettings();
  petWindow = createPetWindow(settings.alwaysOnTop);
}

void app.whenReady().then(async () => {
  registerPetAssetProtocol();
  registerOpenClawIpc();
  registerChatIpc();
  registerPetIpc();
  registerSettingsIpc((enabled) => {
    if (petWindow && !petWindow.isDestroyed()) applyPetAlwaysOnTop(petWindow, enabled);
  });
  ipcMain.handle('window:open-chat', showChat);
  ipcMain.handle('window:open-settings', showSettings);
  await ensurePetWindow();
  const reinforcePet = () => {
    if (petWindow && !petWindow.isDestroyed()) reinforcePetAlwaysOnTop(petWindow);
  };
  powerMonitor.on('resume', reinforcePet);
  powerMonitor.on('unlock-screen', reinforcePet);
});

app.on('activate', () => {
  void ensurePetWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
