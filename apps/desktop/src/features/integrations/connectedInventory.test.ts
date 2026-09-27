import { describe, expect, it } from 'vitest';
import { connectedInventory } from './connectedInventory';

describe('connectedInventory', () => {
  it('counts the connected integrations against the whole catalog', () => {
    expect(
      connectedInventory({
        connected: { github: true, gitlab: false, linear: true, slack: false },
      }),
    ).toBe('2 of 4 connected');
  });
});
