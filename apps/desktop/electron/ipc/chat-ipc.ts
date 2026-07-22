import { BrowserWindow, ipcMain } from 'electron';
import { connection } from './openclaw-ipc.js';

export function registerChatIpc(): void {
  ipcMain.handle('chat:send', async (_event, content: unknown) => {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Message content is required');
    if (content.length > 10_000) throw new Error('Message content is too long');
    return connection.sendChat(content.trim());
  });
  ipcMain.handle('chat:history', () => connection.getChatHistory());
  connection.onChatUpdate(() => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send('chat:updated');
  });
}
