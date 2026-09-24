import { describe, expect, it } from 'vitest';
import { runWithLimit } from './runWithLimit';

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('runWithLimit', () => {
  it('never runs more than the limit at once', async () => {
    let inFlight = 0;
    let peak = 0;
    const gates = Array.from({ length: 7 }, () => deferred());
    const tasks = gates.map((gate, index) => async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await gate.promise;
      inFlight -= 1;
      return index;
    });
    const run = runWithLimit({ tasks, limit: 3 });
    expect(inFlight).toBe(3);
    for (const gate of gates) {
      gate.resolve();
      await Promise.resolve();
    }
    await expect(run).resolves.toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(peak).toBe(3);
  });

  it('keeps results in task order when tasks finish out of order', async () => {
    const slow = deferred();
    const run = runWithLimit({
      tasks: [
        async () => {
          await slow.promise;
          return 'slow';
        },
        async () => 'fast',
      ],
      limit: 2,
    });
    slow.resolve();
    await expect(run).resolves.toEqual(['slow', 'fast']);
  });

  it('resolves an empty list', async () => {
    await expect(runWithLimit({ tasks: [], limit: 4 })).resolves.toEqual([]);
  });
});
