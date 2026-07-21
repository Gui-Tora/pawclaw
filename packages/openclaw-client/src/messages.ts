import type { GatewayMessage } from './protocol.js';

export async function sendMessage(sessionId: string, content: string): Promise<GatewayMessage> {
  throw new Error(`Gateway transport is not configured for session ${sessionId}: ${content.length} characters queued nowhere`);
}
