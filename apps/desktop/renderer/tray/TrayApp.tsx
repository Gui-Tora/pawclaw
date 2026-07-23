import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Monotonic counter so an older identity response can never overwrite a
  // newer one when the gateway flaps and two requests are in flight.
  const identityRequest = useRef(0);

  const loadIdentity = useCallback(async () => {
    const requestId = ++identityRequest.current;
    try {
      const nextIdentity = await window.openclawPet.getAgentIdentity();
      if (identityRequest.current === requestId) setIdentity(nextIdentity);
    } catch {
      // Retain the last known identity during brief reconnects.
    }
  }, []);

  const refresh = useCallback(async () => {
    // Fetch independently: a broken pet manifest must not blank the gateway
    // status (or vice versa), and neither failure may reject unhandled.
    const [status, petStatus] = await Promise.allSettled([
      window.openclawPet.getGatewayStatus(),
      window.openclawPet.getPetStatus()
    ]);
    if (status.status === 'fulfilled') {
      setConnected(status.value.connected);
      if (status.value.connected) void loadIdentity();
    }
    if (petStatus.status === 'fulfilled') {
      const next = petStatus.value;
      // The manifest arrives as a fresh object on every IPC round trip; keep
      // the current reference when nothing changed so PetRenderer does not
      // restart its animation from frame 0 on each flyout open.
      setPet((current) =>
        current && current.manifest.id === next.manifest.id && current.mood === next.mood
          ? current
          : next
      );
    }
  }, [loadIdentity]);

  useEffect(() => {
    void refresh();
    const unsubscribeShown = window.openclawPet.onFlyoutShown(() => void refresh());
    const unsubscribeView = window.openclawPet.onFlyoutViewChanged(setView);
    const unsubscribeGateway = window.openclawPet.onGatewayStatusChanged((status) => {
      setConnected(status.connected);
      if (status.connected) void loadIdentity();
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
  }, [loadIdentity, refresh]);

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
        {/* Both views stay mounted: unmounting ChatApp mid-stream would drop
            its in-progress commentary and streaming state for good. */}
        <div className="tray-pane" hidden={view !== 'chat'}>
          <ChatApp assistantName={identity.name} />
        </div>
        <div className="tray-pane" hidden={view !== 'settings'}>
          <SettingsApp />
        </div>
      </div>
    </main>
  );
}
