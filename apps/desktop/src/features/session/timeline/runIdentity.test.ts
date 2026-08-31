import { describe, expect, it } from 'vitest';
import { runIdentity, runIdentityStroke } from './runIdentity';

describe('runIdentity', () => {
  it('maps a lane index to its palette slot', () => {
    expect(runIdentity({ runId: 'run-1', laneIndex: 0 }).index).toBe(0);
    expect(runIdentity({ runId: 'run-2', laneIndex: 1 }).index).toBe(1);
  });

  it('cycles the five-slot palette', () => {
    expect(runIdentity({ runId: 'run-wrap', laneIndex: 5 })).toEqual(
      runIdentity({ runId: 'run-1', laneIndex: 0 }),
    );
  });

  it('never borrows a semantic tone', () => {
    const tones = ['success', 'danger', 'warning', 'info', 'accent', 'plan', 'neutral'];
    for (let index = 0; index < 40; index += 1) {
      const identity = runIdentity({ runId: `run-${index}`, laneIndex: index });
      expect(tones.some((tone) => identity.stroke.includes(tone))).toBe(false);
      expect(tones.some((tone) => identity.chip.includes(tone))).toBe(false);
      expect(identity.stroke.startsWith('var(--color-run-')).toBe(true);
    }
  });

  it('offers the same identity to a chip as to its lane', () => {
    const identity = runIdentity({ runId: 'run-7', laneIndex: 4 });
    const slot = identity.index + 1;

    expect(identity.stroke).toBe(`var(--color-run-${slot})`);
    expect(identity.chip).toContain(`text-run-${slot}`);
  });

  it('reads a lane stroke back from the index the geometry carries', () => {
    const identity = runIdentity({ runId: 'run-7', laneIndex: 4 });

    expect(runIdentityStroke({ index: identity.index })).toBe(identity.stroke);
  });

  it('falls back to the spine colour when an index has no lane', () => {
    expect(runIdentityStroke({ index: 42 })).toBe('var(--color-border)');
  });
});
