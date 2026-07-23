import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextPetMood } from '../dist/state-machine.js';
import { animationForMood } from '../dist/animation-controller.js';

describe('nextPetMood', () => {
  it('maps gateway and agent events to moods', () => {
    assert.equal(nextPetMood('idle', { type: 'gateway:connected' }), 'idle');
    assert.equal(nextPetMood('idle', { type: 'gateway:disconnected' }), 'offline');
    assert.equal(nextPetMood('idle', { type: 'agent:thinking' }), 'thinking');
    assert.equal(nextPetMood('idle', { type: 'agent:response' }), 'happy');
  });

  it('keeps offline sticky against non-gateway events', () => {
    assert.equal(nextPetMood('offline', { type: 'user:open-chat' }), 'offline');
    assert.equal(nextPetMood('offline', { type: 'user:idle' }), 'offline');
    assert.equal(nextPetMood('offline', { type: 'agent:thinking' }), 'offline');
    assert.equal(nextPetMood('offline', { type: 'gateway:connected' }), 'idle');
  });

  it('retains the current mood for unknown event types', () => {
    assert.equal(nextPetMood('happy', { type: 'not-a-real-event' }), 'happy');
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
