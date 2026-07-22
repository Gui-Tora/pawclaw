import type { PetMood } from '@pawclaw/shared';

export interface DesktopApi {
  getPetStatus(): Promise<{ name: string; mood: PetMood }>;
  getGatewayStatus(): Promise<{ connected: boolean; endpoint: string; detail?: string }>;
  getSettings(): Promise<{ activePetId: string; alwaysOnTop: boolean }>;
  sendChat(content: string): Promise<{ accepted: boolean; reason?: string }>;
  openChat(): Promise<void>;
  openSettings(): Promise<void>;
}

declare global { interface Window { openclawPet: DesktopApi; } }
