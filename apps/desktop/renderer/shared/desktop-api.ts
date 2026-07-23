import type { PetManifest, PetMood } from '@pawclaw/shared';

export interface PetOption {
  id: string;
  name: string;
  species: string;
  attribution?: PetManifest['attribution'];
}

export interface SettingsSnapshot {
  activePetId: string;
  alwaysOnTop: boolean;
  pets: PetOption[];
}

export interface DesktopApi {
  getPetStatus(): Promise<{ manifest: PetManifest; mood: PetMood }>;
  onPetMoodChanged(listener: (mood: PetMood) => void): () => void;
  onPetChanged(listener: () => void): () => void;
  getGatewayStatus(): Promise<{ connected: boolean; endpoint: string; detail?: string }>;
  getSettings(): Promise<SettingsSnapshot>;
  updateSettings(patch: Partial<Pick<SettingsSnapshot, 'activePetId' | 'alwaysOnTop'>>): Promise<SettingsSnapshot>;
  sendChat(content: string): Promise<{ accepted: boolean; reason?: string }>;
  getChatHistory(): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp?: number }>>;
  onChatUpdated(listener: () => void): () => void;
  openChat(): Promise<void>;
  openSettings(): Promise<void>;
}

declare global { interface Window { openclawPet: DesktopApi; } }
