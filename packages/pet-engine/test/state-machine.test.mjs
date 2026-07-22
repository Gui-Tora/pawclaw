import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextPetMood } from '../dist/state-machine.js';
import { animationForMood } from '../dist/animation-controller.js';

describe('nextPetMood', () => {
  it('maps gateway and agent events to moods', () => {
    assert.equal(nextPetMood({ type: 'gateway:connected' }), 'idle');
    assert.equal(nextPetMood({ type: 'gateway:disconnected' }), 'offline');
    assert.equal(nextPetMood({ type: 'agent:thinking' }), 'thinking');
    assert.equal(nextPetMood({ type: 'agent:response' }), 'happy');
  });
});

describe('animationForMood', () => {
  it('maps every runtime mood to a manifest animation state', () => {
    assert.equal(animationForMood('idle'), 'idle');
    assert.equal(animationForMood('thinking'), 'think');
    assert.equal(animationForMood('happy'), 'talk');
    assert.equal(animationForMood('busy'), 'walk');
    assert.equal(animationForMood('sleeping'), 'sleep');
    assert.equal(animationForMood('offline'), 'alert');
  });
});
