import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { advanceTaskbarPatrol, taskbarTrackForDisplay } from '../dist/index.js';

const display = {
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 },
  workArea: { x: -1920, y: 0, width: 1920, height: 1040 }
};

describe('taskbarTrackForDisplay', () => {
  it('creates a bottom track in DIP coordinates, including negative displays', () => {
    assert.deepEqual(taskbarTrackForDisplay(display, { width: 180, height: 180 }), {
      minX: -1920,
      maxX: -180,
      y: 860
    });
  });

  it('does not pretend auto-hide, top, side, or too-small work areas are horizontal tracks', () => {
    assert.equal(taskbarTrackForDisplay({ ...display, workArea: display.bounds }, { width: 180, height: 180 }), undefined);
    assert.equal(taskbarTrackForDisplay({ ...display, workArea: { ...display.workArea, y: 40, height: 1040 } }, { width: 180, height: 180 }), undefined);
    assert.equal(taskbarTrackForDisplay(display, { width: 1920, height: 180 }), undefined);
  });
});

describe('advanceTaskbarPatrol', () => {
  const track = { minX: 0, maxX: 100, y: 700 };
  const options = { speed: 100, walkDurationMs: 1_000, restDurationMs: 500 };

  it('walks, reflects at each end, and never escapes the track', () => {
    const state = { x: 90, direction: 'right', locomotion: 'walking', phaseRemainingMs: 1_000 };
    assert.deepEqual(advanceTaskbarPatrol(state, 300, track, options), {
      x: 80,
      direction: 'left',
      locomotion: 'walking',
      phaseRemainingMs: 700
    });
  });

  it('transitions deterministically between rest and walk phases', () => {
    const state = { x: 10, direction: 'right', locomotion: 'stationary', phaseRemainingMs: 200 };
    assert.deepEqual(advanceTaskbarPatrol(state, 700, track, options), {
      x: 60,
      direction: 'right',
      locomotion: 'walking',
      phaseRemainingMs: 500
    });
  });

  it('clamps a manually supplied off-track position before advancing', () => {
    const state = { x: -500, direction: 'left', locomotion: 'stationary', phaseRemainingMs: 400 };
    assert.deepEqual(advanceTaskbarPatrol(state, 100, track, options), {
      x: 0,
      direction: 'left',
      locomotion: 'stationary',
      phaseRemainingMs: 300
    });
  });
});
