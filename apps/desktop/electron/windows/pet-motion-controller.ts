import { screen, type BrowserWindow } from 'electron';
import {
  DEFAULT_TASKBAR_PATROL_OPTIONS,
  advanceTaskbarPatrol,
  taskbarTrackForDisplay,
  type TaskbarPatrolState
} from '@pawclaw/pet-engine';
import type { PetMood, PetMotionMode, PetMotionState } from '@pawclaw/shared';

const TICK_INTERVAL_MS = 1000 / 30;
const MAX_ELAPSED_MS = 250;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export class PetMotionController {
  private mode: PetMotionMode;
  private mood: PetMood;
  private patrol: TaskbarPatrolState = {
    x: 0,
    direction: 'right',
    locomotion: 'stationary',
    phaseRemainingMs: DEFAULT_TASKBAR_PATROL_OPTIONS.restDurationMs
  };
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastTick = performance.now();
  private lastState?: PetMotionState;

  constructor(
    private readonly window: BrowserWindow,
    initialMode: PetMotionMode,
    initialMood: PetMood,
    private readonly onStateChanged: (state: PetMotionState) => void,
    private readonly onManualMove?: () => void
  ) {
    this.mode = initialMode;
    this.mood = initialMood;
    this.window.on('closed', () => this.destroy());
    this.window.on('will-move', this.handleManualMove);
    screen.on('display-added', this.reconcile);
    screen.on('display-removed', this.reconcile);
    screen.on('display-metrics-changed', this.reconcile);
    this.setMode(initialMode);
  }

  get state(): PetMotionState {
    return {
      mode: this.mode,
      locomotion: this.mode === 'taskbar' && this.mood === 'idle'
        ? this.patrol.locomotion
        : 'stationary',
      direction: this.patrol.direction
    };
  }

  setMode(mode: PetMotionMode): void {
    this.mode = mode;
    this.lastTick = performance.now();
    if (mode === 'taskbar') {
      this.ensureTimer();
      this.positionOnTrack();
    } else {
      this.stopTimer();
    }
    this.emitState();
  }

  setMood(mood: PetMood): void {
    this.mood = mood;
    this.lastTick = performance.now();
    this.emitState();
  }

  refresh(): void {
    this.reconcile();
  }

  destroy(): void {
    this.stopTimer();
    screen.off('display-added', this.reconcile);
    screen.off('display-removed', this.reconcile);
    screen.off('display-metrics-changed', this.reconcile);
    this.window.removeListener('will-move', this.handleManualMove);
  }

  private readonly reconcile = (): void => {
    this.lastTick = performance.now();
    if (this.mode === 'taskbar') this.positionOnTrack();
    this.emitState();
  };

  private readonly handleManualMove = (): void => {
    if (this.mode !== 'taskbar') return;
    // `will-move` is emitted for native user dragging, not setPosition(). A
    // manual reposition deliberately takes ownership from patrol.
    this.setMode('manual');
    this.onManualMove?.();
  };

  private ensureTimer(): void {
    this.timer ??= setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private track() {
    if (this.window.isDestroyed()) return undefined;
    const bounds = this.window.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: bounds.x + Math.round(bounds.width / 2),
      y: bounds.y + Math.round(bounds.height / 2)
    });
    return taskbarTrackForDisplay(display, bounds);
  }

  private positionOnTrack(): void {
    const track = this.track();
    if (!track || this.window.isDestroyed()) return;
    const currentX = this.patrol.x === 0 ? this.window.getBounds().x : this.patrol.x;
    this.patrol = { ...this.patrol, x: clamp(currentX, track.minX, track.maxX) };
    this.window.setPosition(Math.round(this.patrol.x), Math.round(track.y), false);
  }

  private tick(): void {
    if (this.window.isDestroyed() || this.mode !== 'taskbar') return;
    const now = performance.now();
    const elapsed = Math.min(MAX_ELAPSED_MS, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    const track = this.track();
    if (!track || this.mood !== 'idle') {
      this.emitState();
      return;
    }
    this.patrol = advanceTaskbarPatrol(this.patrol, elapsed, track);
    this.window.setPosition(Math.round(this.patrol.x), Math.round(track.y), false);
    this.emitState();
  }

  private emitState(): void {
    const next = this.state;
    if (this.lastState
      && this.lastState.mode === next.mode
      && this.lastState.locomotion === next.locomotion
      && this.lastState.direction === next.direction) return;
    this.lastState = next;
    this.onStateChanged(next);
  }
}
