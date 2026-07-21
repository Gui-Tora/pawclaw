import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextPetMood } from '../dist/state-machine.js';

describe('nextPetMood', () => {
  it('maps gateway and agent events to moods', () => {
    assert.equal(nextPetMood({ type: 'gateway:connected' }), 'idle');
    assert.equal(nextPetMood({ type: 'gateway:disconnected' }), 'offline');
    assert.equal(nextPetMood({ type: 'agent:thinking' }), 'thinking');
    assert.equal(nextPetMood({ type: 'agent:response' }), 'happy');
  });
});
