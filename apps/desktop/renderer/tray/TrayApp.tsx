import { useCallback, useEffect, useState } from 'react';
import type { PetManifest, PetMood } from '@pawclaw/shared';
import { ChatApp } from '../chat/ChatApp';
import { PetRenderer } from '../pet/PetRenderer';
import { SettingsApp } from '../settings/SettingsApp';
import type { AgentIdentity } from '../shared/desktop-api';

type FlyoutView = 'chat' | 'settings';

export function TrayApp() {
  const [view, setView] = useState<FlyoutView>('chat');
  const [identity, setIdentity] = useState<AgentIdentity>({ agentId: 'main', name: 'OpenClaw' });
  const [pet, setPet] = useState<{ manifest: PetManifest; mood: PetMood }>();
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    const [status, petStatus] = await Promise.all([
      window.openclawPet.getGatewayStatus(),
      window.openclawPet.getPetStatus()
    ]);
    setConnected(status.connected);
    setPet(petStatus);
    if (status.connected) {
      try {
        setIdentity(await window.openclawPet.getAgentIdentity());
      } catch {
        // Retain the last known identity during brief reconnects.
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribeShown = window.openclawPet.onFlyoutShown(() => void refresh());
    const unsubscribeView = window.openclawPet.onFlyoutViewChanged(setView);
    const unsubscribeGateway = window.openclawPet.onGatewayStatusChanged((status) => {
      setConnected(status.connected);
      if (status.connected) {
        void window.openclawPet.getAgentIdentity().then(setIdentity).catch(() => undefined);
      }
    });
    const unsubscribeMood = window.openclawPet.onPetMoodChanged((mood) => {
      setPet((current) => current ? { ...current, mood } : current);
    });
    const unsubscribePet = window.openclawPet.onPetChanged(() => void refresh());
    return () => {
      unsubscribeShown();
      unsubscribeView();
      unsubscribeGateway();
      unsubscribeMood();
      unsubscribePet();
    };
  }, [refresh]);

  return (
    <main className="tray-shell">
      <header className="tray-header">
        <div className="tray-pet" aria-hidden="true">
          {pet && <PetRenderer manifest={pet.manifest} mood={pet.mood} size={58} />}
        </div>
        <div className="tray-identity">
          <span>{identity.emoji} PawClaw</span>
          <strong>{identity.name}</strong>
          <small className={connected ? 'status status--online' : 'status'}>
            {connected ? 'Conectado' : 'Sin conexión'}
          </small>
        </div>
        <button
          aria-label="Ocultar PawClaw"
          className="tray-close"
          onClick={() => void window.openclawPet.hideFlyout()}
          title="Ocultar"
          type="button"
        >
          ×
        </button>
      </header>

      <nav aria-label="Secciones de PawClaw" className="tray-tabs">
        <button
          aria-current={view === 'chat' ? 'page' : undefined}
          className={view === 'chat' ? 'active' : ''}
          onClick={() => setView('chat')}
          type="button"
        >
          Chat
        </button>
        <button
          aria-current={view === 'settings' ? 'page' : undefined}
          className={view === 'settings' ? 'active' : ''}
          onClick={() => setView('settings')}
          type="button"
        >
          Ajustes
        </button>
      </nav>

      <div className="tray-content">
        {view === 'chat'
          ? <ChatApp assistantName={identity.name} />
          : <SettingsApp />}
      </div>
    </main>
  );
}
