import { BrowserWindow, ipcMain } from 'electron';
import { connection } from './openclaw-ipc.js';
import { dispatchPetEvent } from './pet-ipc.js';

function recoveryEvent() {
  return { type: connection.status().connected ? 'gateway:connected' : 'gateway:disconnected' } as const;
}

export function registerChatIpc(): void {
  ipcMain.handle('chat:send', async (_event, content: unknown) => {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Message content is required');
    if (content.length > 10_000) throw new Error('Message content is too long');
    dispatchPetEvent({ type: 'agent:thinking' });
    try {
      const result = await connection.sendChat(content.trim());
      // A rejected send resolves (accepted: false) instead of throwing; the
      // mood must not stay stuck in "thinking" for a run that never started.
      if (!result.accepted) dispatchPetEvent(recoveryEvent());
      return result;
    } catch (error: unknown) {
      dispatchPetEvent(recoveryEvent());
      throw error;
    }
  });
  ipcMain.handle('chat:history', () => connection.getChatHistory());
  connection.onChatUpdate((update) => {
    if (update.type === 'delta' || update.type === 'final') {
      dispatchPetEvent({ type: 'agent:response' });
    } else if (update.type === 'commentary') {
      dispatchPetEvent({ type: 'agent:thinking' });
    } else if (update.type === 'aborted' || update.type === 'error') {
      dispatchPetEvent(recoveryEvent());
    }
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('chat:updated', update);
    }
  });
}
