import type { PetDirection, PetLocomotionState } from '@pawclaw/shared';

export interface DesktopRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Minimal, Electron-independent subset of a display used by the motion core. */
export interface DisplayWorkArea {
  bounds: DesktopRectangle;
  workArea: DesktopRectangle;
}

export interface TaskbarTrack {
  minX: number;
  maxX: number;
  y: number;
}

export interface TaskbarPatrolOptions {
  speed: number;
  walkDurationMs: number;
  restDurationMs: number;
}

export interface TaskbarPatrolState {
  x: number;
  direction: PetDirection;
  locomotion: PetLocomotionState;
  phaseRemainingMs: number;
}

export const DEFAULT_TASKBAR_PATROL_OPTIONS: TaskbarPatrolOptions = {
  speed: 110,
  walkDurationMs: 5_000,
  restDurationMs: 2_500
};

/**
 * Returns a horizontal track only for a bottom-reserved work area. Electron's
 * workArea also covers third-party app bars, so callers must treat this as a
 * safe shelf rather than proof that Windows' taskbar is present.
 */
export function taskbarTrackForDisplay(
  display: DisplayWorkArea,
  windowSize: Pick<DesktopRectangle, 'width' | 'height'>
): TaskbarTrack | undefined {
  if (windowSize.width <= 0 || windowSize.height <= 0) return undefined;
  const workBottom = display.workArea.y + display.workArea.height;
  const displayBottom = display.bounds.y + display.bounds.height;
  // Only bottom-reserved space is supported by horizontal sprite sheets. A
  // top/left/right bar must not result in a misleading diagonal or vertical walk.
  if (workBottom >= displayBottom) return undefined;

  const minX = display.workArea.x;
  const maxX = display.workArea.x + display.workArea.width - windowSize.width;
  if (maxX <= minX) return undefined;
  return { minX, maxX, y: workBottom - windowSize.height };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function reflectedPosition(
  x: number,
  direction: PetDirection,
  distance: number,
  track: TaskbarTrack
): Pick<TaskbarPatrolState, 'x' | 'direction'> {
  if (track.maxX <= track.minX) return { x: track.minX, direction };
  let next = clamp(x, track.minX, track.maxX);
  let nextDirection = direction;
  let remaining = Math.max(0, distance);

  // A long frame after an OS stall can cross several edges. Consume the
  // remaining distance instead of allowing the window to escape the track.
  while (remaining > 0) {
    const boundary = nextDirection === 'right' ? track.maxX : track.minX;
    const edgeDistance = Math.abs(boundary - next);
    if (edgeDistance === 0) {
      nextDirection = nextDirection === 'right' ? 'left' : 'right';
      continue;
    }
    if (remaining < edgeDistance) {
      next += nextDirection === 'right' ? remaining : -remaining;
      remaining = 0;
    } else {
      next = boundary;
      remaining -= edgeDistance;
      nextDirection = nextDirection === 'right' ? 'left' : 'right';
    }
  }
  return { x: next, direction: nextDirection };
}

/**
 * Advances a deterministic walk/rest cycle. The caller supplies monotonic
 * elapsed time and may cap it after resume; this function never uses timers.
 */
export function advanceTaskbarPatrol(
  state: TaskbarPatrolState,
  elapsedMs: number,
  track: TaskbarTrack,
  options: TaskbarPatrolOptions = DEFAULT_TASKBAR_PATROL_OPTIONS
): TaskbarPatrolState {
  let next: TaskbarPatrolState = {
    ...state,
    x: clamp(state.x, track.minX, track.maxX),
    phaseRemainingMs: Math.max(0, state.phaseRemainingMs)
  };
  let remainingMs = Math.max(0, elapsedMs);
  const walkDuration = Math.max(1, options.walkDurationMs);
  const restDuration = Math.max(1, options.restDurationMs);
  const speed = Math.max(0, options.speed);

  while (remainingMs > 0) {
    if (next.phaseRemainingMs === 0) {
      const walking = next.locomotion !== 'walking';
      next = {
        ...next,
        locomotion: walking ? 'walking' : 'stationary',
        phaseRemainingMs: walking ? walkDuration : restDuration
      };
    }

    const slice = Math.min(remainingMs, next.phaseRemainingMs);
    if (next.locomotion === 'walking' && speed > 0) {
      const position = reflectedPosition(next.x, next.direction, speed * slice / 1_000, track);
      next = { ...next, ...position };
    }
    next = { ...next, phaseRemainingMs: next.phaseRemainingMs - slice };
    remainingMs -= slice;
  }
  return next;
}
