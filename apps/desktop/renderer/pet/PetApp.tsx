import { useEffect, useState } from 'react';
import type { PetManifest, PetMood } from '@pawclaw/shared';
import { PetRenderer } from './PetRenderer';

export function PetApp() {
  const [pet, setPet] = useState<{ manifest: PetManifest; mood: PetMood }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const loadPet = () => window.openclawPet.getPetStatus()
      .then((status) => {
        if (!active) return;
        setPet(status);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la mascota');
      });

    void loadPet();
    const unsubscribeMood = window.openclawPet.onPetMoodChanged((mood) => {
      if (active) setPet((current) => current ? { ...current, mood } : current);
    });
    const unsubscribePet = window.openclawPet.onPetChanged(() => void loadPet());
    return () => {
      active = false;
      unsubscribeMood();
      unsubscribePet();
    };
  }, []);

  return (
    <main className="pet-shell">
      {pet ? (
        <PetRenderer
          manifest={pet.manifest}
          mood={pet.mood}
          onDoubleClick={() => void window.openclawPet.openChat()}
        />
      ) : (
        <span className="pet-shell__error">{error ?? 'Cargando…'}</span>
      )}
      <button
        aria-label="Abrir ajustes"
        className="pet-shell__settings"
        onClick={() => void window.openclawPet.openSettings()}
        title="Ajustes"
      >
        ⚙
      </button>
      <span className="pet-shell__label">{pet?.manifest.name ?? 'PawClaw'}</span>
    </main>
  );
}
