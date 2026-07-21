import type { PetMood } from '@openclaw-pet/shared';

export function PetRenderer({ mood }: { mood: PetMood }) {
  return <div className={`pet pet--${mood}`} aria-label={`Sol is ${mood}`}><span className="pet__ear pet__ear--left" /><span className="pet__ear pet__ear--right" /><span className="pet__eyes">••</span></div>;
}
