import type { PetManifest, PetMood } from '@pawclaw/shared';

export interface DesktopApi {
  getPetStatus(): Promise<{ manifest: PetManifest; mood: PetMood }>;
  getGatewayStatus(): Promise<{ connected: boolean; endpoint: string; detail?: string }>;
  getSettings(): Promise<{ activePetId: string; alwaysOnTop: boolean }>;
  sendChat(content: string): Promise<{ accepted: boolean; reason?: string }>;
  getChatHistory(): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp?: number }>>;
  onChatUpdated(listener: () => void): () => void;
  openChat(): Promise<void>;
  openSettings(): Promise<void>;
}

declare global { interface Window { openclawPet: DesktopApi; } }
