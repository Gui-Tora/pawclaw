import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSpriteLayout } from '../dist/index.js';

const animation = {
  src: 'sprites/idle.png',
  frameWidth: 16,
  frameHeight: 12,
  frames: 4,
  fps: 4,
  loop: true,
  layout: {
    crop: { top: 1, right: 2, bottom: 3, left: 4 },
    offsetX: -1,
    anchorX: 8,
    groundY: 10
  }
};

describe('resolveSpriteLayout', () => {
  it('uses the full frame and stable defaults when no layout is supplied', () => {
    assert.deepEqual(resolveSpriteLayout({ ...animation, layout: undefined }), {
      crop: { top: 0, right: 0, bottom: 0, left: 0 },
      viewWidth: 16,
      viewHeight: 12,
      offsetX: 0,
      offsetY: 0,
      anchorX: 8,
      groundY: 12
    });
  });

  it('merges a user override over author defaults without mutating either', () => {
    const override = { offsetY: 2, crop: { top: 0, right: 1, bottom: 0, left: 1 } };
    assert.deepEqual(resolveSpriteLayout(animation, override), {
      crop: { top: 0, right: 1, bottom: 0, left: 1 },
      viewWidth: 14,
      viewHeight: 12,
      offsetX: -1,
      offsetY: 2,
      anchorX: 8,
      groundY: 10
    });
    assert.deepEqual(animation.layout.crop, { top: 1, right: 2, bottom: 3, left: 4 });
  });

  it('clamps persisted values that no longer fit a changed frame', () => {
    assert.deepEqual(resolveSpriteLayout({ ...animation, layout: undefined }, {
      crop: { top: 99, right: 99, bottom: 99, left: 99 },
      offsetX: 9999,
      offsetY: -9999,
      anchorX: 99,
      groundY: 99
    }), {
      crop: { top: 11, right: 0, bottom: 0, left: 15 },
      viewWidth: 1,
      viewHeight: 1,
      offsetX: 4096,
      offsetY: -4096,
      anchorX: 16,
      groundY: 12
    });
  });
});
