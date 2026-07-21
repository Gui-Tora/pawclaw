import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateManifest } from '../dist/validation.js';

const validManifest = {
  id: 'sol',
  name: 'Sol',
  version: '0.1.0',
  entry: 'assets/sol.svg',
  supportedStates: ['idle', 'thinking']
};

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    assert.equal(validateManifest(validManifest), true);
  });

  it('rejects unknown and duplicate moods', () => {
    assert.equal(validateManifest({ ...validManifest, supportedStates: ['idle', 'unknown'] }), false);
    assert.equal(validateManifest({ ...validManifest, supportedStates: ['idle', 'idle'] }), false);
  });

  it('rejects unsafe entry paths and malformed versions', () => {
    assert.equal(validateManifest({ ...validManifest, entry: '../secret.svg' }), false);
    assert.equal(validateManifest({ ...validManifest, version: 'latest' }), false);
  });
});
