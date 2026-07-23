import type {
  PetAnimationState,
  PetCalibration,
  PetManifest,
  PetMood,
  PetMotionMode,
  PetMotionState
} from '@pawclaw/shared';
// Single source of truth for the shapes that cross the IPC boundary: a
// hand-rolled copy here already drifted once from the real client types.
import type { AgentIdentity, ChatMessage, ChatSendResult, ChatUpdate } from '@pawclaw/openclaw-client';

export type { AgentIdentity, ChatUpdate };

export interface PetOption {
  id: string;
  name: string;
  species: string;
  attribution?: PetManifest['attribution'];
}

export interface SettingsSnapshot {
  activePetId: string;
  alwaysOnTop: boolean;
  motionMode: PetMotionMode;
  petCalibrations: Record<string, PetCalibration>;
  activePetManifest: PetManifest;
  pets: PetOption[];
}

export interface DesktopApi {
  getPetStatus(): Promise<{ manifest: PetManifest; mood: PetMood; motion: PetMotionState }>;
  onPetMoodChanged(listener: (mood: PetMood) => void): () => void;
  onPetMotionChanged(listener: (motion: PetMotionState) => void): () => void;
  onPetChanged(listener: () => void): () => void;
  getGatewayStatus(): Promise<{ connected: boolean; endpoint: string; detail?: string }>;
  onGatewayStatusChanged(
    listener: (status: { connected: boolean; endpoint: string; detail?: string }) => void
  ): () => void;
  getAgentIdentity(): Promise<AgentIdentity>;
  getSettings(): Promise<SettingsSnapshot>;
  updateSettings(
    patch: Partial<Pick<SettingsSnapshot, 'activePetId' | 'alwaysOnTop' | 'motionMode' | 'petCalibrations'>>
  ): Promise<SettingsSnapshot>;
  onSettingsChanged(listener: () => void): () => void;
  openCropEditor(state: PetAnimationState): Promise<void>;
  closeCropEditor(): Promise<void>;
  onCropEditorState(listener: (state: PetAnimationState) => void): () => void;
  sendChat(content: string): Promise<ChatSendResult>;
  getChatHistory(): Promise<ChatMessage[]>;
  onChatUpdated(listener: (update: ChatUpdate) => void): () => void;
  openChat(): Promise<void>;
  hideFlyout(): Promise<void>;
  onFlyoutShown(listener: () => void): () => void;
  onFlyoutViewChanged(listener: (view: 'chat' | 'settings') => void): () => void;
}

declare global { interface Window { openclawPet: DesktopApi; } }
