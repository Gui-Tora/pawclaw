import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { animationForMood, resolveSpriteLayout } from '@pawclaw/pet-engine';
import type {
  PetAnimationDefinition,
  PetAnimationState,
  PetCalibration,
  PetDirection,
  PetManifest,
  PetMood
} from '@pawclaw/shared';

function assetUrl(petId: string, source: string): string {
  const encodedPath = source.split('/').map(encodeURIComponent).join('/');
  return `pawclaw-pet://${petId}/${encodedPath}`;
}

interface PetRendererProps {
  manifest: PetManifest;
  mood: PetMood;
  animationState?: PetAnimationState;
  calibration?: PetCalibration;
  direction?: PetDirection;
  frame?: number;
  playing?: boolean;
  onDoubleClick?(): void;
  size?: number;
}

interface SpritePlayerProps {
  animation: PetAnimationDefinition;
  calibration?: PetCalibration;
  direction: PetDirection;
  frame?: number;
  onDoubleClick?(): void;
  petId: string;
  playing: boolean;
  size?: number;
  state: PetAnimationState;
}

export function SpritePlayer({
  animation,
  calibration,
  direction,
  frame: controlledFrame,
  onDoubleClick,
  petId,
  playing,
  size,
  state
}: SpritePlayerProps) {
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = useMemo(() => assetUrl(petId, animation.src), [animation.src, petId]);
  const layout = useMemo(
    () => resolveSpriteLayout(animation, calibration?.animations?.[state]),
    [animation, calibration?.animations, state]
  );
  const renderedFrame = controlledFrame === undefined
    ? frame
    : Math.min(Math.max(0, Math.trunc(controlledFrame)), animation.frames - 1);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
    // Animation identity changes reset the local timeline. Pausing playback or
    // selecting a controlled frame deliberately keeps the current frame.
  }, [animation.frames, animation.fps, animation.loop, animation.src]);

  useEffect(() => {
    if (controlledFrame !== undefined
      || !playing
      || animation.frames === 1
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
  }, [animation.frames, animation.fps, animation.loop, controlledFrame, playing]);

  const scale = size
    ? size / Math.max(layout.viewWidth, layout.viewHeight)
    : calibration?.scale ?? 1;
  // Round per-frame dimensions so fractional scales cannot accumulate
  // sub-pixel drift that bleeds adjacent sprite-sheet frames into view.
  const frameWidth = Math.round(animation.frameWidth * scale);
  const frameHeight = Math.round(animation.frameHeight * scale);
  const cropLeft = Math.round(layout.crop.left * scale);
  const cropTop = Math.round(layout.crop.top * scale);
  const viewWidth = Math.round(layout.viewWidth * scale);
  const viewHeight = Math.round(layout.viewHeight * scale);
  const sheetWidth = frameWidth * animation.frames;
  const imageStyle: CSSProperties = {
    width: sheetWidth,
    height: frameHeight,
    transform: `translate(${-renderedFrame * frameWidth - cropLeft}px, ${-cropTop}px)`
  };
  const containerStyle: CSSProperties = {
    width: viewWidth,
    height: viewHeight,
    transform: `translate(${Math.round(layout.offsetX * scale)}px, ${Math.round(layout.offsetY * scale)}px) scaleX(${(direction === 'left') !== Boolean(calibration?.flipX) ? -1 : 1})`
  };

  return (
    <div
      aria-label={`${state} animation`}
      className="pet-sprite"
      onDoubleClick={onDoubleClick}
      role="img"
      style={containerStyle}
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

export function PetRenderer({
  manifest,
  mood,
  animationState,
  calibration,
  direction = 'right',
  frame,
  onDoubleClick,
  playing = true,
  size
}: PetRendererProps) {
  const state = animationState ?? animationForMood(mood);
  const animation = manifest.animations[state] ?? manifest.animations.idle;
  const resolvedCalibration = calibration
    ? { ...calibration, scale: calibration.scale ?? manifest.scale }
    : { scale: manifest.scale };

  return (
    <SpritePlayer
      animation={animation}
      calibration={resolvedCalibration}
      direction={direction}
      frame={frame}
      onDoubleClick={onDoubleClick}
      petId={manifest.id}
      playing={playing}
      size={size}
      state={state}
    />
  );
}
