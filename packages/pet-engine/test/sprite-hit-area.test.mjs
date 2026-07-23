import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spriteHitArea } from '../dist/index.js';

const manifest = {
  id: 'sol',
  name: 'Sol',
  species: 'cat',
  scale: 1,
  animations: {
    idle: {
      src: 'sprites/idle.png',
      frameWidth: 128,
      frameHeight: 128,
      frames: 4,
      fps: 3,
      loop: true,
      layout: { crop: { top: 8, right: 12, bottom: 10, left: 4 }, offsetX: 3, offsetY: -2 }
    }
  }
};

describe('spriteHitArea', () => {
  it('centres the calibrated viewport on the stage and keeps a drag margin', () => {
    assert.deepEqual(spriteHitArea(manifest, undefined, { width: 180, height: 180 }), {
      x: 29,
      y: 60,
      width: 128,
      height: 120
    });
  });

  it('uses a user scale override and clips the shape to the stage', () => {
    assert.deepEqual(spriteHitArea(manifest, { scale: 2 }, { width: 180, height: 180 }), {
      x: 0,
      y: 0,
      width: 180,
      height: 180
    });
  });
});
