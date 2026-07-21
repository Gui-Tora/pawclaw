import { useEffect, useState } from 'react';
import type { PetMood } from '@openclaw-pet/shared';
import { PetRenderer } from './PetRenderer';

export function PetApp() {
  const [mood, setMood] = useState<PetMood>('offline');
  useEffect(() => {
    let active = true;
    window.openclawPet.getPetStatus()
      .then((pet) => { if (active) setMood(pet.mood); })
      .catch(() => { if (active) setMood('offline'); });
    return () => { active = false; };
  }, []);

  return (
    <main className="pet-shell" onDoubleClick={() => void window.openclawPet.openChat()}>
      <PetRenderer mood={mood} />
      <button
        aria-label="Open settings"
        className="pet-shell__settings"
        title="Settings"
        onClick={() => void window.openclawPet.openSettings()}
      >
        ⚙
      </button>
      <span className="pet-shell__label">Sol</span>
    </main>
  );
}
