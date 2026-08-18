import { describe, expect, it } from 'vitest';
import { runIdentity } from './runIdentity';

describe('runIdentity', () => {
  it('is stable for the same run id', () => {
    expect(runIdentity({ runId: 'run-1' })).toEqual(runIdentity({ runId: 'run-1' }));
  });

  it('separates two runs that a stage colour would have merged', () => {
    expect(runIdentity({ runId: 'run-1' }).spine).not.toBe(runIdentity({ runId: 'run-2' }).spine);
  });

  it('never borrows a semantic tone class', () => {
    const tones = ['success', 'danger', 'warning', 'info', 'accent', 'plan', 'neutral'];
    for (let index = 0; index < 40; index += 1) {
      const identity = runIdentity({ runId: `run-${index}` });
      expect(tones.some((tone) => identity.spine.includes(tone))).toBe(false);
      expect(identity.spine.startsWith('bg-run-')).toBe(true);
    }
  });
});
