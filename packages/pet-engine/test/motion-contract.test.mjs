import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  animationForPetState,
  canPetWalk,
  isMovementSuppressedByMood
} from '../dist/index.js';

const walkingOnTaskbar = {
  mode: 'taskbar',
  locomotion: 'walking',
  direction: 'right'
};

describe('pet motion contract', () => {
  it('allows automatic walking only while taskbar mode is walking from idle', () => {
    assert.equal(canPetWalk('idle', walkingOnTaskbar), true);
    assert.equal(canPetWalk('idle', { ...walkingOnTaskbar, mode: 'manual' }), false);
    assert.equal(canPetWalk('idle', { ...walkingOnTaskbar, mode: 'disabled' }), false);
    assert.equal(canPetWalk('idle', { ...walkingOnTaskbar, locomotion: 'stationary' }), false);
  });

  it('gives reactive moods priority over a requested walk', () => {
    assert.equal(isMovementSuppressedByMood('thinking'), true);
    assert.equal(isMovementSuppressedByMood('happy'), true);
    assert.equal(isMovementSuppressedByMood('sleeping'), true);
    assert.equal(isMovementSuppressedByMood('offline'), true);
    assert.equal(isMovementSuppressedByMood('idle'), false);

    assert.equal(animationForPetState('thinking', walkingOnTaskbar), 'think');
    assert.equal(animationForPetState('happy', walkingOnTaskbar), 'talk');
    assert.equal(animationForPetState('sleeping', walkingOnTaskbar), 'sleep');
    assert.equal(animationForPetState('offline', walkingOnTaskbar), 'alert');
  });

  it('uses walk only when the window is actually eligible to move', () => {
    assert.equal(animationForPetState('idle', walkingOnTaskbar), 'walk');
    assert.equal(
      animationForPetState('idle', { ...walkingOnTaskbar, locomotion: 'stationary' }),
      'idle'
    );
    assert.equal(
      animationForPetState('idle', { ...walkingOnTaskbar, mode: 'manual' }),
      'idle'
    );
  });
});
