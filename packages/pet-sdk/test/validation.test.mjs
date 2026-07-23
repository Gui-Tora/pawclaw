import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateManifest } from '../dist/validation.js';

const validManifest = {
  id: 'sol',
  name: 'Sol',
  species: 'cat',
  scale: 1,
  animations: {
    idle: {
      src: 'assets/sol.svg',
      frameWidth: 128,
      frameHeight: 128,
      frames: 1,
      fps: 1,
      loop: true
    }
  }
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    assert.equal(validateManifest(validManifest), true);
  });

  it('accepts optional per-animation layout metadata', () => {
    const layout = {
      crop: { top: 2, right: 3, bottom: 4, left: 5 },
      offsetX: -2,
      offsetY: 1,
      anchorX: 64,
      groundY: 120
    };
    assert.equal(validateManifest({
      ...validManifest,
      animations: { idle: { ...validManifest.animations.idle, layout } }
    }), true);
  });

  it('rejects unknown states and missing idle animations', () => {
    assert.equal(validateManifest({ ...validManifest, animations: { unknown: validManifest.animations.idle } }), false);
    assert.equal(validateManifest({ ...validManifest, animations: {} }), false);
  });

  it('rejects unsafe paths and invalid frame metadata', () => {
    assert.equal(validateManifest({ ...validManifest, animations: { idle: { ...validManifest.animations.idle, src: '../secret.png' } } }), false);
    assert.equal(validateManifest({ ...validManifest, animations: { idle: { ...validManifest.animations.idle, frames: 0 } } }), false);
  });

  it('rejects drive-relative and backslash-separated paths', () => {
    for (const src of ['D:secret.png', 'D:\\secret.png', 'sprites\\idle.png', '/absolute.png']) {
      assert.equal(
        validateManifest({ ...validManifest, animations: { idle: { ...validManifest.animations.idle, src } } }),
        false,
        `expected rejection for ${src}`
      );
    }
  });

  it('rejects oversized string fields', () => {
    assert.equal(validateManifest({ ...validManifest, name: 'x'.repeat(257) }), false);
    assert.equal(validateManifest({ ...validManifest, species: 'x'.repeat(257) }), false);
  });

  it('rejects impossible or malformed layout metadata', () => {
    const withLayout = (layout) => ({
      ...validManifest,
      animations: { idle: { ...validManifest.animations.idle, layout } }
    });
    assert.equal(validateManifest(withLayout({ crop: { top: 0, right: 64, bottom: 0, left: 64 } })), false);
    assert.equal(validateManifest(withLayout({ crop: { top: 0, right: 0, bottom: 0, left: 0, extra: 1 } })), false);
    assert.equal(validateManifest(withLayout({ anchorX: 129 })), false);
    assert.equal(validateManifest(withLayout({ groundY: -1 })), false);
    assert.equal(validateManifest(withLayout({ offsetX: 1.5 })), false);
  });
});
