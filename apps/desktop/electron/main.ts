import { app, BrowserWindow, ipcMain, protocol } from 'electron';
import { createChatWindow } from './windows/chat-window.js';
import { createPetWindow } from './windows/pet-window.js';
import { createSettingsWindow } from './windows/settings-window.js';
import { registerChatIpc } from './ipc/chat-ipc.js';
import { registerOpenClawIpc } from './ipc/openclaw-ipc.js';
import { registerPetIpc } from './ipc/pet-ipc.js';
import { registerSettingsIpc } from './ipc/settings-ipc.js';
import { registerPetAssetProtocol } from './pets/pet-protocol.js';

protocol.registerSchemesAsPrivileged([
  { scheme: 'pawclaw-pet', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

let petWindow: BrowserWindow | undefined;
let chatWindow: BrowserWindow | undefined;
let settingsWindow: BrowserWindow | undefined;

function showChat(): void {
  if (!chatWindow || chatWindow.isDestroyed()) chatWindow = createChatWindow();
  chatWindow.show();
  chatWindow.focus();
}

function showSettings(): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) settingsWindow = createSettingsWindow();
  settingsWindow.show();
  settingsWindow.focus();
}

void app.whenReady().then(() => {
  registerPetAssetProtocol();
  registerChatIpc();
  registerOpenClawIpc();
  registerPetIpc();
  registerSettingsIpc();
  ipcMain.handle('window:open-chat', showChat);
  ipcMain.handle('window:open-settings', showSettings);
  petWindow = createPetWindow();
});

app.on('activate', () => {
  if (!petWindow || petWindow.isDestroyed()) petWindow = createPetWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
