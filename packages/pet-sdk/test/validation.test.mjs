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

  it('rejects unknown states and missing idle animations', () => {
    assert.equal(validateManifest({ ...validManifest, animations: { unknown: validManifest.animations.idle } }), false);
    assert.equal(validateManifest({ ...validManifest, animations: {} }), false);
  });

  it('rejects unsafe paths and invalid frame metadata', () => {
    assert.equal(validateManifest({ ...validManifest, animations: { idle: { ...validManifest.animations.idle, src: '../secret.png' } } }), false);
    assert.equal(validateManifest({ ...validManifest, animations: { idle: { ...validManifest.animations.idle, frames: 0 } } }), false);
  });
});
