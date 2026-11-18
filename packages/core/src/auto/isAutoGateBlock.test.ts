import { describe, expect, it } from 'vitest';
import { isAutoGateBlock } from './isAutoGateBlock';
import { AUTO_BLOCK_TEXT } from './turnGate';

describe('isAutoGateBlock', () => {
  it('reads every guard of the turn as a block that waits for the user', () => {
    for (const reason of Object.values(AUTO_BLOCK_TEXT)) {
      expect(isAutoGateBlock({ reason }), reason).toBe(true);
    }
  });

  it('keeps a tree stored at the retired time limit waiting for Retry or a message', () => {
    expect(isAutoGateBlock({ reason: 'This conversation reached its time limit.' })).toBe(true);
  });

  it('leaves a provider problem to the restart retry', () => {
    expect(isAutoGateBlock({ reason: 'Claude is not signed in' })).toBe(false);
    expect(isAutoGateBlock({ reason: null })).toBe(false);
  });
});
