// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from './concurrency';

describe('runWithConcurrency', () => {
  it('runs every item exactly once', async () => {
    const seen: Array<number> = [];

    await runWithConcurrency({
      items: [1, 2, 3, 4, 5],
      limit: 2,
      run: async (item) => {
        seen.push(item);
      },
    });

    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never runs more than the limit at once', async () => {
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency({
      items: [1, 2, 3, 4, 5, 6],
      limit: 2,
      run: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;
      },
    });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('does nothing for an empty list', async () => {
    let calls = 0;

    await runWithConcurrency({
      items: [],
      limit: 4,
      run: async () => {
        calls += 1;
      },
    });

    expect(calls).toBe(0);
  });
});
