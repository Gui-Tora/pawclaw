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

export interface AgentIdentity {
  agentId: string;
  name: string;
  avatar?: string;
  emoji?: string;
}

export type ChatUpdate =
  | { type: 'delta'; runId: string; content: string; timestamp: number }
  | { type: 'commentary'; runId: string; itemId?: string; content: string; timestamp: number }
  | {
      type: 'final' | 'aborted' | 'error';
      runId: string;
      message?: { id: string; role: 'user' | 'assistant'; content: string; timestamp?: number };
      reason?: string;
      timestamp: number;
    }
  | { type: 'history'; timestamp: number };

export interface DesktopApi {
  getPetStatus(): Promise<{ manifest: PetManifest; mood: PetMood }>;
  onPetMoodChanged(listener: (mood: PetMood) => void): () => void;
  onPetChanged(listener: () => void): () => void;
  getGatewayStatus(): Promise<{ connected: boolean; endpoint: string; detail?: string }>;
  onGatewayStatusChanged(
    listener: (status: { connected: boolean; endpoint: string; detail?: string }) => void
  ): () => void;
  getAgentIdentity(): Promise<AgentIdentity>;
  getSettings(): Promise<SettingsSnapshot>;
  updateSettings(
    patch: Partial<Pick<SettingsSnapshot, 'activePetId' | 'alwaysOnTop'>>
  ): Promise<SettingsSnapshot>;
  sendChat(content: string): Promise<{ accepted: boolean; runId?: string; reason?: string }>;
  getChatHistory(): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp?: number }>>;
  onChatUpdated(listener: (update: ChatUpdate) => void): () => void;
  openChat(): Promise<void>;
  openSettings(): Promise<void>;
  hideFlyout(): Promise<void>;
  onFlyoutShown(listener: () => void): () => void;
  onFlyoutViewChanged(listener: (view: 'chat' | 'settings') => void): () => void;
}

declare global { interface Window { openclawPet: DesktopApi; } }
