import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openclawPet', {
  getPetStatus: () => ipcRenderer.invoke('pet:status'),
  getGatewayStatus: () => ipcRenderer.invoke('openclaw:status'),
  getSettings: () => ipcRenderer.invoke('settings:read'),
  sendChat: (content: string) => ipcRenderer.invoke('chat:send', content),
  getChatHistory: () => ipcRenderer.invoke('chat:history'),
  onChatUpdated: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('chat:updated', handler);
    return () => ipcRenderer.removeListener('chat:updated', handler);
  },
  openChat: () => ipcRenderer.invoke('window:open-chat'),
  openSettings: () => ipcRenderer.invoke('window:open-settings')
});
