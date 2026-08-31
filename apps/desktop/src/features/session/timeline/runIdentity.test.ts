import { describe, expect, it } from 'vitest';
import { runIdentity, runIdentitySeed, runIdentityStroke } from './runIdentity';

describe('runIdentity', () => {
  it('walks the palette with stride two from the seed', () => {
    expect(
      Array.from({ length: 5 }, (_, laneIndex) => runIdentity({ laneIndex, seed: 3 }).index),
    ).toEqual([3, 0, 2, 4, 1]);
    expect(runIdentity({ laneIndex: 5, seed: 3 }).index).toBe(3);
  });

  it('cycles the five-slot palette', () => {
    expect(runIdentity({ laneIndex: 5, seed: 0 })).toEqual(runIdentity({ laneIndex: 0, seed: 0 }));
  });

  it('returns a deterministic seed for a session', () => {
    expect(runIdentitySeed({ sessionId: 'session-1' })).toBe(
      runIdentitySeed({ sessionId: 'session-1' }),
    );
  });

  it('never borrows a semantic tone', () => {
    const tones = ['success', 'danger', 'warning', 'info', 'accent', 'plan', 'neutral'];
    for (let index = 0; index < 40; index += 1) {
      const identity = runIdentity({ laneIndex: index, seed: 0 });
      expect(tones.some((tone) => identity.stroke.includes(tone))).toBe(false);
      expect(tones.some((tone) => identity.chip.includes(tone))).toBe(false);
      expect(identity.stroke.startsWith('var(--color-run-')).toBe(true);
    }
  });

  it('offers the same identity to a chip as to its lane', () => {
    const identity = runIdentity({ laneIndex: 4, seed: 0 });
    const slot = identity.index + 1;

    expect(identity.stroke).toBe(`var(--color-run-${slot})`);
    expect(identity.chip).toContain(`text-run-${slot}`);
  });

  it('reads a lane stroke back from the index the geometry carries', () => {
    const identity = runIdentity({ laneIndex: 4, seed: 0 });

    expect(runIdentityStroke({ index: identity.index })).toBe(identity.stroke);
  });

  it('falls back to the spine colour when an index has no lane', () => {
    expect(runIdentityStroke({ index: 42 })).toBe('var(--color-border)');
  });
});
