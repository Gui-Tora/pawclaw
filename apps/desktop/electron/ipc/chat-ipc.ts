import { ipcMain } from 'electron';

export function registerChatIpc(): void {
  ipcMain.handle('chat:send', (_event, content: unknown) => {
    if (typeof content !== 'string' || !content.trim()) throw new Error('Message content is required');
    if (content.length > 10_000) throw new Error('Message content is too long');
    return { accepted: false, reason: 'OpenClaw gateway transport is not connected yet' };
  });
}
