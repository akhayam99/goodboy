// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createDedupeByKey } from './createDedupeByKey';

type Deferred = {
  readonly promise: Promise<string>;
  readonly resolve: (value: string) => void;
  readonly reject: (error: Error) => void;
};

const deferred = (): Deferred => {
  let resolve: Deferred['resolve'] = () => undefined;
  let reject: Deferred['reject'] = () => undefined;
  const promise = new Promise<string>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

describe('createDedupeByKey', () => {
  it('runs one task for callers that share a key and gives them the same answer', async () => {
    const dedupe = createDedupeByKey<string>();
    const pending = deferred();
    const task = vi.fn(() => pending.promise);
    const first = dedupe.run({ key: 'a', task });
    const second = dedupe.run({ key: 'a', task });
    pending.resolve('done');
    await expect(Promise.all([first, second])).resolves.toEqual(['done', 'done']);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('runs a task for each key', async () => {
    const dedupe = createDedupeByKey<string>();
    const task = vi.fn(async () => 'x');
    await Promise.all([dedupe.run({ key: 'a', task }), dedupe.run({ key: 'b', task })]);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('starts a new task once the first one settled', async () => {
    const dedupe = createDedupeByKey<string>();
    const task = vi.fn(async () => 'x');
    await dedupe.run({ key: 'a', task });
    expect(dedupe.size()).toBe(0);
    await dedupe.run({ key: 'a', task });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('forgets the key after a failure, so a retry runs again', async () => {
    const dedupe = createDedupeByKey<string>();
    const pending = deferred();
    const failing = dedupe.run({ key: 'a', task: () => pending.promise });
    pending.reject(new Error('offline'));
    await expect(failing).rejects.toThrow('offline');
    expect(dedupe.size()).toBe(0);
    await expect(dedupe.run({ key: 'a', task: async () => 'back' })).resolves.toBe('back');
  });
});
