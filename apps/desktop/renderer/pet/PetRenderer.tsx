import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { animationForMood } from '@pawclaw/pet-engine';
import type { PetManifest, PetMood } from '@pawclaw/shared';

function assetUrl(petId: string, source: string): string {
  const encodedPath = source.split('/').map(encodeURIComponent).join('/');
  return `pawclaw-pet://${petId}/${encodedPath}`;
}

interface PetRendererProps {
  manifest: PetManifest;
  mood: PetMood;
  onDoubleClick?(): void;
  size?: number;
}

export function PetRenderer({ manifest, mood, onDoubleClick, size }: PetRendererProps) {
  const state = animationForMood(mood);
  const animation = manifest.animations[state] ?? manifest.animations.idle;
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => assetUrl(manifest.id, animation.src), [animation.src, manifest.id]);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
    if (animation.frames === 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const interval = window.setInterval(() => {
      // Pure updater: React may replay it, so no side effects in here. For
      // non-looping animations the frame simply holds at the last value
      // (same-state updates bail out without re-rendering).
      setFrame((current) => {
        const next = current + 1;
        if (next < animation.frames) return next;
        return animation.loop ? 0 : current;
      });
    }, 1000 / animation.fps);
    return () => window.clearInterval(interval);
    // Depend on the animation's values, not its identity: each IPC round trip
    // delivers a fresh manifest object and must not restart the animation.
  }, [animation.frames, animation.fps, animation.loop, animation.src]);

  const scale = size ? size / Math.max(animation.frameWidth, animation.frameHeight) : manifest.scale;
  // Round per-frame dimensions so fractional scales cannot accumulate
  // sub-pixel drift that bleeds adjacent sprite-sheet frames into view.
  const frameWidth = Math.round(animation.frameWidth * scale);
  const frameHeight = Math.round(animation.frameHeight * scale);
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
      onDoubleClick={onDoubleClick}
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
