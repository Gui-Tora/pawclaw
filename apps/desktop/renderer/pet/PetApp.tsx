import { useEffect, useState } from 'react';
import type { PetManifest, PetMood } from '@pawclaw/shared';
import { PetRenderer } from './PetRenderer';

export function PetApp() {
  const [pet, setPet] = useState<{ manifest: PetManifest; mood: PetMood }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    window.openclawPet.getPetStatus()
      .then((status) => { if (active) setPet(status); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Pet could not be loaded');
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="pet-shell">
      {pet ? (
        <PetRenderer
          manifest={pet.manifest}
          mood={pet.mood}
          onDoubleClick={() => void window.openclawPet.openChat()}
        />
      ) : <span className="pet-shell__error">{error ?? 'Loading…'}</span>}
      <button
        aria-label="Open settings"
        className="pet-shell__settings"
        title="Settings"
        onClick={() => void window.openclawPet.openSettings()}
      >
        ⚙
      </button>
      <span className="pet-shell__label">{pet?.manifest.name ?? 'PawClaw'}</span>
    </main>
  );
}
