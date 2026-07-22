import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { PetAnimationState, PetManifest, PetMood } from '@pawclaw/shared';

const moodAnimations: Record<PetMood, PetAnimationState> = {
  idle: 'idle',
  thinking: 'think',
  happy: 'talk',
  busy: 'walk',
  sleeping: 'sleep',
  offline: 'alert'
};

function assetUrl(petId: string, source: string): string {
  const encodedPath = source.split('/').map(encodeURIComponent).join('/');
  return `pawclaw-pet://${petId}/${encodedPath}`;
}

export function PetRenderer({ manifest, mood }: { manifest: PetManifest; mood: PetMood }) {
  const state = moodAnimations[mood];
  const animation = manifest.animations[state] ?? manifest.animations.idle;
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => assetUrl(manifest.id, animation.src), [animation.src, manifest.id]);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
    if (animation.frames === 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => {
      setFrame((current) => {
        if (current + 1 < animation.frames) return current + 1;
        if (animation.loop) return 0;
        window.clearInterval(interval);
        return animation.frames - 1;
      });
    }, 1000 / animation.fps);
    return () => window.clearInterval(interval);
  }, [animation]);

  const frameWidth = animation.frameWidth * manifest.scale;
  const frameHeight = animation.frameHeight * manifest.scale;
  const sheetWidth = frameWidth * animation.frames;
  const imageStyle: CSSProperties = {
    width: sheetWidth,
    height: frameHeight,
    transform: `translateX(${-frame * frameWidth}px)`
  };

  return (
    <div
      aria-label={`${manifest.name} is ${mood}`}
      className="pet-sprite"
      role="img"
      style={{ width: frameWidth, height: frameHeight }}
    >
      {failed ? (
        <span className="pet-sprite__error">Missing sprite</span>
      ) : (
        <img
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          src={source}
          style={imageStyle}
        />
      )}
    </div>
  );
}
