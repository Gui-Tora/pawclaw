import { BrowserWindow, ipcMain } from 'electron';
import { connection } from './openclaw-ipc.js';
import { dispatchPetEvent } from './pet-ipc.js';

export function registerChatIpc(): void {
  ipcMain.handle('chat:send', async (_event, content: unknown) => {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Message content is required');
    if (content.length > 10_000) throw new Error('Message content is too long');
    dispatchPetEvent({ type: 'agent:thinking' });
    try {
      return await connection.sendChat(content.trim());
    } catch (error: unknown) {
      dispatchPetEvent({ type: connection.status().connected ? 'gateway:connected' : 'gateway:disconnected' });
      throw error;
    }
  });
  ipcMain.handle('chat:history', () => connection.getChatHistory());
  connection.onChatUpdate(() => {
    dispatchPetEvent({ type: 'agent:response' });
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('chat:updated');
  });
}
