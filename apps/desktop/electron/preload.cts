import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('openclawPet', {
  getPetStatus: () => ipcRenderer.invoke('pet:status'),
  onPetMoodChanged: (listener: (mood: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, mood: string) => listener(mood);
    ipcRenderer.on('pet:mood-changed', handler);
    return () => ipcRenderer.removeListener('pet:mood-changed', handler);
  },
  onPetChanged: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('pet:changed', handler);
    return () => ipcRenderer.removeListener('pet:changed', handler);
  },
  getGatewayStatus: () => ipcRenderer.invoke('openclaw:status'),
  onGatewayStatusChanged: (listener: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => listener(status);
    ipcRenderer.on('openclaw:status-changed', handler);
    return () => ipcRenderer.removeListener('openclaw:status-changed', handler);
  },
  getAgentIdentity: () => ipcRenderer.invoke('openclaw:identity'),
  getSettings: () => ipcRenderer.invoke('settings:read'),
  updateSettings: (patch: { activePetId?: string; alwaysOnTop?: boolean }) =>
    ipcRenderer.invoke('settings:update', patch),
  sendChat: (content: string) => ipcRenderer.invoke('chat:send', content),
  getChatHistory: () => ipcRenderer.invoke('chat:history'),
  onChatUpdated: (listener: (update: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, update: unknown) => listener(update);
    ipcRenderer.on('chat:updated', handler);
    return () => ipcRenderer.removeListener('chat:updated', handler);
  },
  openChat: () => ipcRenderer.invoke('window:open-chat'),
  hideFlyout: () => ipcRenderer.invoke('window:hide'),
  onFlyoutShown: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on('window:shown', handler);
    return () => ipcRenderer.removeListener('window:shown', handler);
  },
  onFlyoutViewChanged: (listener: (view: 'chat' | 'settings') => void) => {
    const handler = (_event: Electron.IpcRendererEvent, view: 'chat' | 'settings') => listener(view);
    ipcRenderer.on('window:view-changed', handler);
    return () => ipcRenderer.removeListener('window:view-changed', handler);
  }
});
