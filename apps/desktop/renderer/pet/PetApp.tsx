import { useEffect, useState } from 'react';
import { animationForPetState } from '@pawclaw/pet-engine';
import type { PetCalibration, PetManifest, PetMood, PetMotionState } from '@pawclaw/shared';
import { PetRenderer } from './PetRenderer';

export function PetApp() {
  const [pet, setPet] = useState<{
    manifest: PetManifest;
    mood: PetMood;
    motion: PetMotionState;
    calibration?: PetCalibration;
  }>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    const loadPet = () => Promise.allSettled([
      window.openclawPet.getPetStatus(),
      window.openclawPet.getSettings()
    ]).then(([petStatus, settings]) => {
        if (!active) return;
        if (petStatus.status !== 'fulfilled') {
          setError(petStatus.reason instanceof Error ? petStatus.reason.message : 'No se pudo cargar la mascota');
          return;
        }
        const calibration = settings.status === 'fulfilled'
          ? settings.value.petCalibrations[petStatus.value.manifest.id]
          : undefined;
        setPet({ ...petStatus.value, calibration });
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo cargar la mascota');
      });

    void loadPet();
    const unsubscribeMood = window.openclawPet.onPetMoodChanged((mood) => {
      if (active) setPet((current) => current ? { ...current, mood } : current);
    });
    const unsubscribeMotion = window.openclawPet.onPetMotionChanged((motion) => {
      if (active) setPet((current) => current ? { ...current, motion } : current);
    });
    const unsubscribePet = window.openclawPet.onPetChanged(() => void loadPet());
    const unsubscribeSettings = window.openclawPet.onSettingsChanged(() => void loadPet());
    return () => {
      active = false;
      unsubscribeMood();
      unsubscribeMotion();
      unsubscribePet();
      unsubscribeSettings();
    };
  }, []);

  return (
    <main className="pet-shell">
      {pet ? (
        <PetRenderer
          manifest={pet.manifest}
          mood={pet.mood}
          calibration={pet.calibration}
          animationState={animationForPetState(pet.mood, pet.motion)}
          direction={pet.motion.direction}
          onDoubleClick={() => void window.openclawPet.openChat()}
        />
      ) : (
        <span className="pet-shell__error">{error ?? 'Cargando…'}</span>
      )}
    </main>
  );
}
