import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openclawPet', {
  getPetStatus: () => ipcRenderer.invoke('pet:status'),
  getGatewayStatus: () => ipcRenderer.invoke('openclaw:status'),
  getSettings: () => ipcRenderer.invoke('settings:read'),
  sendChat: (content: string) => ipcRenderer.invoke('chat:send', content),
  openChat: () => ipcRenderer.invoke('window:open-chat'),
  openSettings: () => ipcRenderer.invoke('window:open-settings')
});
